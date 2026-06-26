-- ============================================================
-- Migration 016 — Campaign Offer Landings
-- Extends offers table to support two countdown modes:
--   fixed_window: fecha/hora fija de inicio y fin
--   per_visitor:  X minutos desde la primera visita del usuario
-- Creates campaign_offer_sessions for visitor tracking
-- Creates public views for landing pages and store homepage
-- ============================================================

-- ── 1. Rename timer_type → countdown_mode ───────────────────

ALTER TABLE public.offers RENAME COLUMN timer_type TO countdown_mode;

-- Update existing 'fixed_date' values to 'fixed_window'
UPDATE public.offers SET countdown_mode = 'fixed_window' WHERE countdown_mode = 'fixed_date';

-- Drop old constraint, add extended constraint
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_timer_type_valid;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_countdown_mode_valid
  CHECK (countdown_mode IN ('fixed_window', 'per_visitor'));

-- ── 2. Make ends_at nullable (per_visitor has no global end date) ──

ALTER TABLE public.offers ALTER COLUMN ends_at DROP NOT NULL;

-- Update dates check: ends_at can now be null
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_dates_valid;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_dates_valid
  CHECK (
    ends_at IS NULL
    OR starts_at IS NULL
    OR ends_at > starts_at
  );

-- ── 3. Add new campaign columns ──────────────────────────────

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS duration_minutes    INTEGER,
  ADD COLUMN IF NOT EXISTS show_countdown      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_visible_in_store BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order          INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.offers
  ADD CONSTRAINT offers_duration_valid
  CHECK (duration_minutes IS NULL OR duration_minutes > 0);

-- ── 4. Update index for new ends_at nullability ──────────────

DROP INDEX IF EXISTS idx_offers_status_ends_at;
CREATE INDEX idx_offers_status_ends_at ON public.offers(store_id, status, ends_at)
  WHERE status = 'active';

-- ── 5. Create campaign_offer_sessions ────────────────────────

CREATE TABLE IF NOT EXISTS public.campaign_offer_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id      uuid        NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  visitor_token text        NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  claim_code    text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT campaign_sessions_unique          UNIQUE (offer_id, visitor_token),
  CONSTRAINT campaign_sessions_claim_unique    UNIQUE (claim_code),
  CONSTRAINT campaign_sessions_expires_valid   CHECK (expires_at > first_seen_at)
);

CREATE TRIGGER campaign_offer_sessions_updated_at
  BEFORE UPDATE ON public.campaign_offer_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_campaign_sessions_offer ON public.campaign_offer_sessions(offer_id);
CREATE INDEX idx_campaign_sessions_token ON public.campaign_offer_sessions(offer_id, visitor_token);

ALTER TABLE public.campaign_offer_sessions ENABLE ROW LEVEL SECURITY;
-- No direct public policies — access only via SECURITY DEFINER RPC

-- ── 6. RPC: get_or_create_campaign_offer_session ─────────────

CREATE OR REPLACE FUNCTION public.get_or_create_campaign_offer_session(
  p_offer_id      uuid,
  p_visitor_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer        offers%ROWTYPE;
  v_session      campaign_offer_sessions%ROWTYPE;
  v_expires_at   timestamptz;
  v_claim_code   text;
  v_attempt      int := 0;
BEGIN
  -- Validate token
  IF p_visitor_token IS NULL OR length(trim(p_visitor_token)) < 8 THEN
    RETURN json_build_object('error', 'Token inválido');
  END IF;

  -- Load offer (any non-archived status)
  SELECT * INTO v_offer
  FROM offers
  WHERE id = p_offer_id
    AND status <> 'archived'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Oferta no encontrada');
  END IF;

  -- Return existing session if found
  SELECT * INTO v_session
  FROM campaign_offer_sessions
  WHERE offer_id = p_offer_id
    AND visitor_token = p_visitor_token;

  IF FOUND THEN
    RETURN row_to_json(v_session);
  END IF;

  -- Compute expires_at
  IF v_offer.countdown_mode = 'per_visitor' THEN
    v_expires_at := now() + (COALESCE(v_offer.duration_minutes, 60) * INTERVAL '1 minute');
  ELSE
    v_expires_at := COALESCE(v_offer.ends_at, now() + INTERVAL '24 hours');
  END IF;

  -- Insert with unique claim_code (retry up to 5 times)
  LOOP
    v_attempt := v_attempt + 1;
    v_claim_code := 'PROMO-'
      || upper(substring(encode(gen_random_bytes(3), 'hex') FROM 1 FOR 4))
      || '-'
      || upper(substring(encode(gen_random_bytes(3), 'hex') FROM 1 FOR 4));

    BEGIN
      INSERT INTO campaign_offer_sessions (
        offer_id,
        visitor_token,
        first_seen_at,
        expires_at,
        claim_code
      ) VALUES (
        p_offer_id,
        p_visitor_token,
        now(),
        v_expires_at,
        v_claim_code
      )
      RETURNING * INTO v_session;

      RETURN row_to_json(v_session);
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt >= 5 THEN
          RETURN json_build_object('error', 'No se pudo generar código único');
        END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_campaign_offer_session(uuid, text)
  TO anon, authenticated;

-- ── 7. Update anon RLS policy for offers ─────────────────────
-- Old policy checked ends_at > now() which breaks for per_visitor (ends_at IS NULL)

DROP POLICY IF EXISTS "offers_select_public_active" ON public.offers;

CREATE POLICY "offers_select_public_active" ON public.offers
  FOR SELECT TO anon
  USING (
    status = 'active'
    AND (ends_at IS NULL OR ends_at > now())
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.status = 'active'
    )
  );

-- ── 8. Recreate public_offer_pages view (drop + create) ──────

DROP VIEW IF EXISTS public.public_offer_pages;

CREATE VIEW public.public_offer_pages AS
SELECT
  s.slug                AS store_slug,
  s.name                AS store_name,
  s.whatsapp_number     AS store_whatsapp_number,
  s.logo_url,
  t.mode                AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  o.id                  AS offer_id,
  o.slug                AS offer_slug,
  o.title,
  o.subtitle,
  o.description,
  o.regular_price,
  o.offer_price,
  o.starts_at,
  o.ends_at,
  o.duration_minutes,
  o.countdown_mode,
  o.show_countdown,
  o.is_visible_in_store,
  o.sort_order,
  o.status,
  o.whatsapp_number     AS offer_whatsapp_number,
  o.whatsapp_message,
  o.cta_label,
  o.hero_image_url,
  o.terms_and_conditions,
  pr.name               AS product_name,
  pr.slug               AS product_slug,
  COALESCE(pimg.image_url, pr.main_image_url) AS product_main_image_url
FROM public.offers o
JOIN public.stores s ON s.id = o.store_id
LEFT JOIN public.store_theme_settings t ON t.store_id = s.id
LEFT JOIN public.products pr ON pr.id = o.product_id
LEFT JOIN LATERAL (
  SELECT image_url
  FROM public.product_images
  WHERE product_id = pr.id
  ORDER BY is_primary DESC, sort_order ASC, created_at ASC
  LIMIT 1
) pimg ON true
WHERE s.status = 'active'
  AND o.status <> 'archived';

GRANT SELECT ON public.public_offer_pages TO anon, authenticated;

-- ── 9. Create public_store_campaign_offers view ───────────────

DROP VIEW IF EXISTS public.public_store_campaign_offers;

CREATE VIEW public.public_store_campaign_offers AS
SELECT
  o.id,
  o.store_id,
  s.slug              AS store_slug,
  o.slug              AS offer_slug,
  o.title,
  o.subtitle,
  o.offer_price,
  o.regular_price,
  o.countdown_mode,
  o.starts_at,
  o.ends_at,
  o.duration_minutes,
  o.show_countdown,
  o.sort_order,
  o.hero_image_url,
  pr.name             AS product_name,
  pr.slug             AS product_slug,
  COALESCE(pimg.image_url, pr.main_image_url) AS product_main_image_url
FROM public.offers o
JOIN public.stores s ON s.id = o.store_id
LEFT JOIN public.products pr ON pr.id = o.product_id
LEFT JOIN LATERAL (
  SELECT image_url
  FROM public.product_images
  WHERE product_id = pr.id
  ORDER BY is_primary DESC, sort_order ASC, created_at ASC
  LIMIT 1
) pimg ON true
WHERE s.status = 'active'
  AND o.status = 'active'
  AND o.is_visible_in_store = true
  AND (o.ends_at IS NULL OR o.ends_at > now());

GRANT SELECT ON public.public_store_campaign_offers TO anon, authenticated;

-- ── 10. Grants ───────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_offer_sessions TO authenticated;
