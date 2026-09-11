-- ============================================================
-- Migration 156 — Customer book and voluntary storefront capture
--
-- This is an optional, store-scoped module. Existing orders keep their
-- current shape and behavior; customer records are created only when the
-- platform module is enabled for a store. Public capture is disabled by
-- default and can never read customer data back to an anonymous visitor.
-- ============================================================

-- ── 1. Per-store entitlements and public capture settings ───

ALTER TABLE public.store_limits
  ADD COLUMN IF NOT EXISTS can_use_customer_book boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_use_customer_capture boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.store_customer_settings (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                   uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  capture_enabled            boolean NOT NULL DEFAULT false,
  collect_phone              boolean NOT NULL DEFAULT false,
  capture_title              text NOT NULL DEFAULT 'Recibe novedades y beneficios',
  capture_description        text NOT NULL DEFAULT 'Déjanos tus datos y te enviaremos beneficios de esta empresa.',
  incentive_text             text,
  success_message            text NOT NULL DEFAULT 'Gracias. Guardamos tus datos y tendremos en cuenta tus preferencias.',
  email_marketing_enabled    boolean NOT NULL DEFAULT true,
  whatsapp_marketing_enabled boolean NOT NULL DEFAULT false,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_customer_settings_title_length CHECK (char_length(btrim(capture_title)) BETWEEN 1 AND 140),
  CONSTRAINT store_customer_settings_description_length CHECK (char_length(btrim(capture_description)) BETWEEN 1 AND 500),
  CONSTRAINT store_customer_settings_incentive_length CHECK (incentive_text IS NULL OR char_length(incentive_text) <= 300),
  CONSTRAINT store_customer_settings_success_length CHECK (char_length(btrim(success_message)) BETWEEN 1 AND 300)
);

DROP TRIGGER IF EXISTS store_customer_settings_updated_at ON public.store_customer_settings;
CREATE TRIGGER store_customer_settings_updated_at
  BEFORE UPDATE ON public.store_customer_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.store_customer_settings (store_id)
SELECT s.id
FROM public.stores s
ON CONFLICT (store_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_store_customer_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.store_customer_settings (store_id)
  VALUES (NEW.id)
  ON CONFLICT (store_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stores_customer_settings_after_insert ON public.stores;
CREATE TRIGGER stores_customer_settings_after_insert
  AFTER INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.ensure_store_customer_settings();
REVOKE ALL ON FUNCTION public.ensure_store_customer_settings() FROM PUBLIC;

-- ── 2. Canonical customer records ───────────────────────────

CREATE TABLE IF NOT EXISTS public.customers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  full_name         text NOT NULL DEFAULT 'Sin nombre',
  email             text,
  phone             text,
  normalized_email  text,
  normalized_phone  text,
  status            text NOT NULL DEFAULT 'active',
  source            text NOT NULL DEFAULT 'manual',
  notes             text,
  first_order_at    timestamptz,
  last_order_at     timestamptz,
  order_count       integer NOT NULL DEFAULT 0,
  total_spent       numeric(12,2) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_status_valid CHECK (status IN ('active', 'archived')),
  CONSTRAINT customers_source_valid CHECK (source IN ('order', 'storefront_form', 'manual', 'import', 'mixed')),
  CONSTRAINT customers_order_count_valid CHECK (order_count >= 0),
  CONSTRAINT customers_total_spent_valid CHECK (total_spent >= 0),
  CONSTRAINT customers_name_length CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 200),
  CONSTRAINT customers_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT customers_store_email_unique UNIQUE (store_id, normalized_email),
  CONSTRAINT customers_store_phone_unique UNIQUE (store_id, normalized_phone)
);

CREATE INDEX IF NOT EXISTS customers_store_created_idx
  ON public.customers (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customers_store_last_order_idx
  ON public.customers (store_id, last_order_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS customers_store_name_idx
  ON public.customers (store_id, lower(full_name));

DROP TRIGGER IF EXISTS customers_updated_at ON public.customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 3. Current preferences and append-only consent evidence ─

CREATE TABLE IF NOT EXISTS public.customer_preferences (
  customer_id                  uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  email_marketing_status       text NOT NULL DEFAULT 'unknown',
  whatsapp_marketing_status    text NOT NULL DEFAULT 'unknown',
  email_consent_at             timestamptz,
  whatsapp_consent_at          timestamptz,
  email_revoked_at             timestamptz,
  whatsapp_revoked_at          timestamptz,
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_preferences_email_status_valid CHECK (email_marketing_status IN ('unknown', 'subscribed', 'unsubscribed')),
  CONSTRAINT customer_preferences_whatsapp_status_valid CHECK (whatsapp_marketing_status IN ('unknown', 'subscribed', 'unsubscribed'))
);

CREATE TABLE IF NOT EXISTS public.customer_consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  channel         text NOT NULL,
  purpose         text NOT NULL DEFAULT 'commercial',
  granted         boolean NOT NULL,
  source          text NOT NULL,
  policy_version  text,
  captured_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_consents_channel_valid CHECK (channel IN ('email', 'whatsapp')),
  CONSTRAINT customer_consents_purpose_valid CHECK (purpose = 'commercial'),
  CONSTRAINT customer_consents_source_length CHECK (char_length(btrim(source)) BETWEEN 1 AND 80),
  CONSTRAINT customer_consents_policy_length CHECK (policy_version IS NULL OR char_length(policy_version) <= 120)
);

CREATE INDEX IF NOT EXISTS customer_consents_customer_idx
  ON public.customer_consents (customer_id, captured_at DESC);

-- ── 4. Link orders without changing checkout behavior ───────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_customer_id_idx
  ON public.orders (store_id, customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- Customer phone identity uses the same E.164 normalizer already used by the
-- WhatsApp module. Existing orders retain their 10-digit snapshot values.
CREATE OR REPLACE FUNCTION public.normalize_customer_identity_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_country text;
BEGIN
  NEW.full_name := COALESCE(NULLIF(btrim(NEW.full_name), ''), 'Sin nombre');
  NEW.normalized_email := public.normalize_transactional_email(NEW.email);

  IF NULLIF(btrim(NEW.email), '') IS NOT NULL AND NEW.normalized_email IS NULL THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER_EMAIL';
  END IF;

  SELECT country INTO v_country FROM public.stores WHERE id = NEW.store_id;
  NEW.normalized_phone := public.normalize_whatsapp_phone(NEW.phone, COALESCE(v_country, 'CO'));

  IF NULLIF(btrim(NEW.phone), '') IS NOT NULL AND NEW.normalized_phone IS NULL THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER_PHONE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_normalize_identity ON public.customers;
CREATE TRIGGER customers_normalize_identity
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.normalize_customer_identity_fields();

-- Internal identity upsert used by orders and the two controlled entry
-- points below. It locks the store/contact key so concurrent checkouts do not
-- create duplicates.
CREATE OR REPLACE FUNCTION public.upsert_store_customer(
  p_store_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := public.normalize_transactional_email(p_email);
  v_phone text;
  v_customer_id uuid;
  v_email_customer_id uuid;
  v_phone_customer_id uuid;
  v_country text;
  v_source text := CASE WHEN p_source IN ('order', 'storefront_form', 'manual', 'import', 'mixed') THEN p_source ELSE 'manual' END;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.store_limits
    WHERE store_id = p_store_id AND can_use_customer_book = true
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_BOOK_DISABLED';
  END IF;

  SELECT country INTO v_country FROM public.stores WHERE id = p_store_id;
  v_phone := public.normalize_whatsapp_phone(p_phone, COALESCE(v_country, 'CO'));

  IF NULLIF(btrim(p_email), '') IS NOT NULL AND v_email IS NULL THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER_EMAIL';
  END IF;
  IF NULLIF(btrim(p_phone), '') IS NOT NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER_PHONE';
  END IF;
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'CUSTOMER_CONTACT_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_store_id::text || ':' || COALESCE(v_email, v_phone), 156
  ));

  IF v_email IS NOT NULL THEN
    SELECT id INTO v_email_customer_id
    FROM public.customers
    WHERE store_id = p_store_id AND normalized_email = v_email
    LIMIT 1;
  END IF;

  IF v_phone IS NOT NULL THEN
    SELECT id INTO v_phone_customer_id
    FROM public.customers
    WHERE store_id = p_store_id AND normalized_phone = v_phone
    LIMIT 1;
  END IF;

  v_customer_id := COALESCE(v_email_customer_id, v_phone_customer_id);

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      store_id, full_name, email, phone, notes, source
    ) VALUES (
      p_store_id,
      COALESCE(NULLIF(btrim(p_full_name), ''), 'Sin nombre'),
      NULLIF(btrim(p_email), ''),
      NULLIF(btrim(p_phone), ''),
      NULLIF(btrim(p_notes), ''),
      v_source
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers c
    SET
      full_name = CASE
        WHEN c.full_name IS NULL OR btrim(c.full_name) = '' OR c.full_name = 'Sin nombre'
          THEN COALESCE(NULLIF(btrim(p_full_name), ''), c.full_name)
        ELSE c.full_name
      END,
      email = CASE
        WHEN v_email IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.customers other
           WHERE other.store_id = p_store_id
             AND other.normalized_email = v_email
             AND other.id <> c.id
         ) THEN COALESCE(NULLIF(btrim(p_email), ''), c.email)
        ELSE c.email
      END,
      phone = CASE
        WHEN v_phone IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.customers other
           WHERE other.store_id = p_store_id
             AND other.normalized_phone = v_phone
             AND other.id <> c.id
         ) THEN COALESCE(NULLIF(btrim(p_phone), ''), c.phone)
        ELSE c.phone
      END,
      notes = CASE
        WHEN NULLIF(btrim(p_notes), '') IS NOT NULL THEN p_notes ELSE c.notes END,
      status = CASE WHEN p_source = 'order' THEN 'active' ELSE c.status END,
      source = CASE WHEN c.source = v_source OR c.source = 'mixed' THEN c.source ELSE 'mixed' END
    WHERE c.id = v_customer_id;
  END IF;

  INSERT INTO public.customer_preferences (customer_id)
  VALUES (v_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;

  RETURN v_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_store_customer(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_store_customer(uuid, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.link_customer_to_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.customer_id IS NULL
     AND EXISTS (
       SELECT 1 FROM public.store_limits
       WHERE store_id = NEW.store_id AND can_use_customer_book = true
     ) THEN
    BEGIN
      NEW.customer_id := public.upsert_store_customer(
        NEW.store_id, NEW.customer_name, NEW.customer_email, NEW.customer_phone, 'order', NULL
      );
    EXCEPTION WHEN OTHERS THEN
      -- CRM enrichment must never reject a valid order. The order snapshot
      -- remains authoritative and can be linked later from administration.
      NEW.customer_id := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_link_customer ON public.orders;
CREATE TRIGGER orders_link_customer
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.link_customer_to_new_order();

CREATE OR REPLACE FUNCTION public.refresh_customer_order_summary(p_customer_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.customers c
  SET
    first_order_at = summary.first_order_at,
    last_order_at = summary.last_order_at,
    order_count = summary.order_count,
    total_spent = summary.total_spent
  FROM (
    SELECT
      o.customer_id,
      MIN(o.created_at) FILTER (WHERE o.status <> 'cancelled') AS first_order_at,
      MAX(o.created_at) FILTER (WHERE o.status <> 'cancelled') AS last_order_at,
      COUNT(*) FILTER (WHERE o.status <> 'cancelled')::integer AS order_count,
      COALESCE(SUM(o.total_amount) FILTER (
        WHERE o.status <> 'cancelled' AND o.payment_status NOT IN ('failed', 'expired', 'refunded')
      ), 0)::numeric(12,2) AS total_spent
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
    GROUP BY o.customer_id
  ) summary
  WHERE c.id = summary.customer_id;

  UPDATE public.customers
  SET first_order_at = NULL, last_order_at = NULL, order_count = 0, total_spent = 0
  WHERE id = p_customer_id
    AND NOT EXISTS (SELECT 1 FROM public.orders WHERE customer_id = p_customer_id);
$$;

CREATE OR REPLACE FUNCTION public.refresh_customer_order_summary_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM public.refresh_customer_order_summary(OLD.customer_id);
    END IF;
  ELSE
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM public.refresh_customer_order_summary(NEW.customer_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS NOT NULL AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
      PERFORM public.refresh_customer_order_summary(OLD.customer_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS orders_refresh_customer_summary ON public.orders;
CREATE TRIGGER orders_refresh_customer_summary
  AFTER INSERT OR UPDATE OF customer_id, status, total_amount, payment_status OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.refresh_customer_order_summary_trigger();

-- Backfills historical orders only when an authorized user enables the book.
CREATE OR REPLACE FUNCTION public.backfill_store_customers(p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_customer_id uuid;
  v_count integer := 0;
BEGIN
  IF NOT (public.is_platform_admin() OR public.has_store_role(p_store_id, ARRAY['owner', 'admin'])) THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS';
  END IF;

  FOR v_order IN
    SELECT * FROM public.orders WHERE store_id = p_store_id AND customer_id IS NULL ORDER BY created_at
  LOOP
    v_customer_id := public.upsert_store_customer(
      p_store_id, v_order.customer_name, v_order.customer_email, v_order.customer_phone, 'order', NULL
    );
    UPDATE public.orders SET customer_id = v_customer_id WHERE id = v_order.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_store_customers(uuid) TO authenticated, service_role;

-- ── 5. Controlled public and admin entry points ─────────────

CREATE OR REPLACE FUNCTION public.capture_store_contact(
  p_store_slug text,
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_marketing_email_opt_in boolean DEFAULT false,
  p_marketing_whatsapp_opt_in boolean DEFAULT false,
  p_source text DEFAULT 'storefront_form'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_store_id uuid;
  v_store_status text;
  v_book_enabled boolean;
  v_capture_enabled boolean;
  v_email_enabled boolean;
  v_whatsapp_enabled boolean;
  v_privacy_policy text;
  v_policy_version text;
  v_customer_id uuid;
  v_email text := public.normalize_transactional_email(p_email);
  v_phone text;
  v_country text;
  v_consent_source text := 'storefront_form';
BEGIN
  SELECT s.id, s.status, COALESCE(sl.can_use_customer_book, false),
         COALESCE(sl.can_use_customer_capture, false),
         COALESCE(settings.capture_enabled, false),
         COALESCE(settings.email_marketing_enabled, true),
         COALESCE(settings.whatsapp_marketing_enabled, false),
         s.country,
         policies.privacy_policy,
         to_char(policies.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  INTO v_store_id, v_store_status, v_book_enabled, v_capture_enabled,
       v_email_enabled, v_whatsapp_enabled, v_country, v_privacy_policy, v_policy_version
  FROM public.stores s
  LEFT JOIN public.store_limits sl ON sl.store_id = s.id
  LEFT JOIN public.store_customer_settings settings ON settings.store_id = s.id
  LEFT JOIN public.store_policies policies ON policies.store_id = s.id
  WHERE s.slug = lower(trim(p_store_slug));

  IF v_store_id IS NULL OR v_store_status <> 'active' THEN RAISE EXCEPTION 'STORE_NOT_FOUND'; END IF;
  IF NOT v_book_enabled OR NOT v_capture_enabled THEN RAISE EXCEPTION 'CUSTOMER_CAPTURE_DISABLED'; END IF;
  IF NULLIF(btrim(v_privacy_policy), '') IS NULL THEN RAISE EXCEPTION 'PRIVACY_POLICY_REQUIRED'; END IF;
  IF v_email IS NULL AND NULLIF(btrim(p_phone), '') IS NULL THEN RAISE EXCEPTION 'CUSTOMER_CONTACT_REQUIRED'; END IF;
  IF v_email IS NULL AND NULLIF(btrim(p_email), '') IS NOT NULL THEN RAISE EXCEPTION 'INVALID_CUSTOMER_EMAIL'; END IF;

  v_phone := public.normalize_whatsapp_phone(p_phone, COALESCE(v_country, 'CO'));
  IF NULLIF(btrim(p_phone), '') IS NOT NULL AND v_phone IS NULL THEN RAISE EXCEPTION 'INVALID_CUSTOMER_PHONE'; END IF;
  IF p_marketing_email_opt_in AND v_email IS NULL THEN RAISE EXCEPTION 'CUSTOMER_EMAIL_REQUIRED'; END IF;
  IF p_marketing_email_opt_in AND NOT v_email_enabled THEN RAISE EXCEPTION 'EMAIL_CAPTURE_DISABLED'; END IF;
  IF p_marketing_whatsapp_opt_in AND NOT v_whatsapp_enabled THEN RAISE EXCEPTION 'WHATSAPP_CAPTURE_DISABLED'; END IF;
  IF NOT p_marketing_email_opt_in AND NOT p_marketing_whatsapp_opt_in THEN RAISE EXCEPTION 'MARKETING_CONSENT_REQUIRED'; END IF;
  IF p_marketing_whatsapp_opt_in AND v_phone IS NULL THEN RAISE EXCEPTION 'CUSTOMER_PHONE_REQUIRED'; END IF;

  v_customer_id := public.upsert_store_customer(
    v_store_id, p_full_name, p_email, p_phone, 'storefront_form', NULL
  );

  INSERT INTO public.customer_preferences (customer_id)
  VALUES (v_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;

  IF p_marketing_email_opt_in THEN
    UPDATE public.customer_preferences
    SET email_marketing_status = 'subscribed', email_consent_at = now(), email_revoked_at = NULL, updated_at = now()
    WHERE customer_id = v_customer_id;
    INSERT INTO public.customer_consents (store_id, customer_id, channel, granted, source, policy_version)
    VALUES (v_store_id, v_customer_id, 'email', true, v_consent_source, v_policy_version);
  END IF;

  IF p_marketing_whatsapp_opt_in THEN
    UPDATE public.customer_preferences
    SET whatsapp_marketing_status = 'subscribed', whatsapp_consent_at = now(), whatsapp_revoked_at = NULL, updated_at = now()
    WHERE customer_id = v_customer_id;
    INSERT INTO public.customer_consents (store_id, customer_id, channel, granted, source, policy_version)
    VALUES (v_store_id, v_customer_id, 'whatsapp', true, v_consent_source, v_policy_version);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.capture_store_contact(text, text, text, text, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_store_contact(text, text, text, text, boolean, boolean, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_store_customer(
  p_store_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id uuid;
  v_customer public.customers;
BEGIN
  IF NOT (public.is_platform_admin() OR public.has_store_role(p_store_id, ARRAY['owner', 'admin'])) THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.store_limits
    WHERE store_id = p_store_id AND can_use_customer_book = true
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_BOOK_DISABLED';
  END IF;

  v_customer_id := public.upsert_store_customer(p_store_id, p_full_name, p_email, p_phone, 'manual', p_notes);
  SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id;
  RETURN v_customer;
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_customer(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_store_customer(uuid, text, text, text, text) TO authenticated, service_role;

-- ── 6. RLS and grants ───────────────────────────────────────

ALTER TABLE public.store_customer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_customer_settings_select_members" ON public.store_customer_settings
  FOR SELECT TO authenticated USING (public.is_platform_admin() OR public.is_store_member(store_id));
CREATE POLICY "store_customer_settings_write_managers" ON public.store_customer_settings
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.is_platform_admin() OR public.has_store_role(store_id, ARRAY['owner', 'admin']));

CREATE POLICY "customers_select_members" ON public.customers
  FOR SELECT TO authenticated USING (public.is_platform_admin() OR public.has_store_role(store_id, ARRAY['owner', 'admin']));
CREATE POLICY "customers_update_managers" ON public.customers
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.is_platform_admin() OR public.has_store_role(store_id, ARRAY['owner', 'admin']));

CREATE POLICY "customer_preferences_select_managers" ON public.customer_preferences
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_id AND (public.is_platform_admin() OR public.has_store_role(c.store_id, ARRAY['owner', 'admin']))
  ));
CREATE POLICY "customer_consents_select_managers" ON public.customer_consents
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, ARRAY['owner', 'admin']));

REVOKE ALL ON public.store_customer_settings FROM anon;
GRANT SELECT ON public.store_customer_settings TO authenticated;
GRANT UPDATE (
  capture_enabled, collect_phone, capture_title, capture_description,
  incentive_text, success_message, email_marketing_enabled, whatsapp_marketing_enabled
) ON public.store_customer_settings TO authenticated;
GRANT ALL PRIVILEGES ON public.store_customer_settings TO service_role;

REVOKE ALL ON public.customers FROM anon;
GRANT SELECT ON public.customers TO authenticated;
GRANT UPDATE (full_name, email, phone, status, notes) ON public.customers TO authenticated;
GRANT ALL PRIVILEGES ON public.customers TO service_role;
REVOKE ALL ON public.customer_preferences FROM anon;
GRANT SELECT ON public.customer_preferences TO authenticated;
GRANT ALL PRIVILEGES ON public.customer_preferences TO service_role;
REVOKE ALL ON public.customer_consents FROM anon;
GRANT SELECT ON public.customer_consents TO authenticated;
GRANT ALL PRIVILEGES ON public.customer_consents TO service_role;

-- ── 7. Add opt-in configuration to public store metadata ────

CREATE OR REPLACE VIEW public.public_store_pages
  WITH (security_invoker = false)
AS
SELECT
  s.id                              AS store_id,
  s.slug                            AS store_slug,
  s.name                            AS store_name,
  s.slogan,
  s.business_type,
  s.description,
  s.logo_url,
  s.favicon_url,
  s.hero_enabled,
  s.hero_title,
  s.hero_subtitle,
  s.hero_cta_label,
  s.hero_image_url,
  s.hero_background_image_url,
  s.whatsapp_number,
  s.support_email,
  s.country,
  s.city,
  s.currency,
  t.mode                            AS theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  t.header_settings,
  COALESCE(t.whatsapp_button_enabled, true) AS whatsapp_button_enabled,
  t.whatsapp_button_color,
  p.shipping_policy,
  p.returns_policy,
  p.warranty_policy,
  p.privacy_policy,
  p.terms_and_conditions,
  CASE WHEN l.is_public THEN l.address_line   ELSE NULL END AS location_address,
  CASE WHEN l.is_public THEN l.neighborhood   ELSE NULL END AS location_neighborhood,
  CASE WHEN l.is_public THEN l.city           ELSE NULL END AS location_city,
  CASE WHEN l.is_public THEN l.department     ELSE NULL END AS location_department,
  CASE WHEN l.is_public THEN l.country        ELSE NULL END AS location_country,
  CASE WHEN l.is_public THEN l.latitude       ELSE NULL END AS location_latitude,
  CASE WHEN l.is_public THEN l.longitude      ELSE NULL END AS location_longitude,
  c.catalog_type,
  c.business_category,
  c.commerce_mode,
  c.delivery_mode,
  c.allows_pickup,
  c.allows_local_delivery,
  c.allows_national_shipping,
  c.whatsapp_checkout_enabled,
  c.web_order_enabled,
  c.cash_on_delivery_enabled,
  c.online_checkout_enabled,
  c.default_order_method,
  c.local_delivery_notes,
  c.shipping_notes,
  c.local_delivery_base_fee,
  c.local_delivery_free_from,
  c.national_shipping_base_fee,
  c.national_shipping_free_from,
  public.store_requires_whatsapp_order_consent(s.id) AS whatsapp_order_updates_required,
  COALESCE(t.whatsapp_button_layout, 'floating') AS whatsapp_button_layout,
  (
    COALESCE(sl.can_use_carta, false)
    AND COALESCE(cs.enabled, false)
  ) AS carta_enabled,
  (
    COALESCE(sl.can_use_carta, false)
    AND COALESCE(cs.enabled, false)
    AND COALESCE(cs.listed_in_storefront, false)
  ) AS carta_listed,
  COALESCE(sl.can_use_partner_codes, false) AS partner_codes_enabled,
  (
    COALESCE(sl.can_use_customer_book, false)
    AND COALESCE(sl.can_use_customer_capture, false)
    AND COALESCE(customer_settings.capture_enabled, false)
    AND (
      COALESCE(customer_settings.email_marketing_enabled, true)
      OR COALESCE(customer_settings.whatsapp_marketing_enabled, false)
    )
    AND NULLIF(btrim(p.privacy_policy), '') IS NOT NULL
  ) AS customer_capture_enabled,
  customer_settings.capture_title AS customer_capture_title,
  customer_settings.capture_description AS customer_capture_description,
  customer_settings.incentive_text AS customer_capture_incentive_text,
  customer_settings.success_message AS customer_capture_success_message,
  customer_settings.collect_phone AS customer_capture_collect_phone,
  customer_settings.email_marketing_enabled AS customer_email_marketing_enabled,
  customer_settings.whatsapp_marketing_enabled AS customer_whatsapp_marketing_enabled
FROM public.stores s
LEFT JOIN public.store_theme_settings t ON t.store_id = s.id
LEFT JOIN public.store_policies p ON p.store_id = s.id
LEFT JOIN LATERAL (
  SELECT * FROM public.store_locations
  WHERE store_id = s.id AND is_primary = true AND is_active = true
  LIMIT 1
) l ON true
LEFT JOIN public.store_commerce_settings c ON c.store_id = s.id
LEFT JOIN public.store_carta_settings cs ON cs.store_id = s.id
LEFT JOIN public.store_limits sl ON sl.store_id = s.id
LEFT JOIN public.store_customer_settings customer_settings ON customer_settings.store_id = s.id
WHERE s.status = 'active';

GRANT SELECT ON public.public_store_pages TO anon, authenticated;

COMMENT ON TABLE public.customers IS
  'Optional store-scoped customer book. Order snapshots remain authoritative for historical order data.';
COMMENT ON TABLE public.customer_consents IS
  'Append-only evidence of commercial communication consent and revocation by channel.';
