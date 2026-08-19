-- ============================================================
-- Migration 145 — Partner discount codes and commissions
--
-- The module is entitlement-gated by store_limits.can_use_partner_codes.
-- A partner owns one or more codes. A code contains independent discount
-- and commission rules. Orders and online checkout sessions keep snapshots
-- of the commercial terms so historical reporting remains stable even when
-- a code is edited later.
-- ============================================================

-- ── 1. Platform-controlled module entitlement ───────────────

ALTER TABLE public.store_limits
  ADD COLUMN IF NOT EXISTS can_use_partner_codes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.store_limits.can_use_partner_codes IS
  'Platform-admin entitlement for influencer/partner discount codes and commissions.';

-- ── 2. Partners and codes ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.store_partners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text,
  phone       text,
  notes       text,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_partners_name_valid CHECK (char_length(btrim(name)) BETWEEN 2 AND 160),
  CONSTRAINT store_partners_status_valid CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT store_partners_store_id_id_unique UNIQUE (store_id, id)
);

CREATE INDEX IF NOT EXISTS idx_store_partners_store_id
  ON public.store_partners(store_id);

DROP TRIGGER IF EXISTS store_partners_updated_at ON public.store_partners;
CREATE TRIGGER store_partners_updated_at
  BEFORE UPDATE ON public.store_partners
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.store_partner_codes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                 uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  partner_id               uuid NOT NULL,
  code                     text NOT NULL,
  discount_type            text NOT NULL DEFAULT 'percentage',
  discount_value           numeric(12,2) NOT NULL,
  max_discount_amount      numeric(12,2),
  min_subtotal             numeric(12,2) NOT NULL DEFAULT 0,
  commission_type          text NOT NULL DEFAULT 'percentage',
  commission_value         numeric(12,2) NOT NULL,
  starts_at                timestamptz,
  ends_at                  timestamptz,
  usage_limit              integer,
  usage_limit_per_customer integer,
  status                   text NOT NULL DEFAULT 'active',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_partner_codes_code_valid CHECK (code = upper(btrim(code)) AND code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  CONSTRAINT store_partner_codes_discount_type_valid CHECK (discount_type IN ('percentage', 'fixed')),
  CONSTRAINT store_partner_codes_discount_value_valid CHECK (
    discount_value >= 0 AND (discount_type <> 'percentage' OR discount_value <= 100)
  ),
  CONSTRAINT store_partner_codes_max_discount_valid CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0),
  CONSTRAINT store_partner_codes_min_subtotal_valid CHECK (min_subtotal >= 0),
  CONSTRAINT store_partner_codes_commission_type_valid CHECK (commission_type IN ('percentage', 'fixed')),
  CONSTRAINT store_partner_codes_commission_value_valid CHECK (
    commission_value >= 0 AND (commission_type <> 'percentage' OR commission_value <= 100)
  ),
  CONSTRAINT store_partner_codes_dates_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT store_partner_codes_usage_valid CHECK (
    (usage_limit IS NULL OR usage_limit > 0) AND
    (usage_limit_per_customer IS NULL OR usage_limit_per_customer > 0)
  ),
  CONSTRAINT store_partner_codes_status_valid CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT store_partner_codes_store_partner_fk
    FOREIGN KEY (store_id, partner_id)
    REFERENCES public.store_partners(store_id, id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS store_partner_codes_store_code_unique
  ON public.store_partner_codes(store_id, lower(code));
CREATE INDEX IF NOT EXISTS idx_store_partner_codes_partner_id
  ON public.store_partner_codes(partner_id);
CREATE INDEX IF NOT EXISTS idx_store_partner_codes_store_status
  ON public.store_partner_codes(store_id, status);

DROP TRIGGER IF EXISTS store_partner_codes_updated_at ON public.store_partner_codes;
CREATE TRIGGER store_partner_codes_updated_at
  BEFORE UPDATE ON public.store_partner_codes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.store_partners IS
  'Influencers, affiliates and other commercial partners belonging to a store.';
COMMENT ON TABLE public.store_partner_codes IS
  'Discount and commission rules for a store partner code.';

-- ── 3. Historical attribution and online reservations ───────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS partner_code_id uuid REFERENCES public.store_partner_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_code text,
  ADD COLUMN IF NOT EXISTS partner_name text;

CREATE INDEX IF NOT EXISTS idx_orders_partner_code_id
  ON public.orders(partner_code_id)
  WHERE partner_code_id IS NOT NULL;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS partner_code_id uuid REFERENCES public.store_partner_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_code_snapshot text,
  ADD COLUMN IF NOT EXISTS partner_name_snapshot text,
  ADD COLUMN IF NOT EXISTS partner_discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_commission_base_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_commission_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.partner_code_redemptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                 uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  partner_code_id          uuid NOT NULL REFERENCES public.store_partner_codes(id) ON DELETE RESTRICT,
  partner_code_snapshot    text NOT NULL,
  partner_name_snapshot    text NOT NULL,
  checkout_session_id      uuid UNIQUE REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  order_id                 uuid UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_phone           text,
  customer_email           text,
  subtotal_amount          numeric(12,2) NOT NULL,
  discount_amount          numeric(12,2) NOT NULL DEFAULT 0,
  commission_base_amount   numeric(12,2) NOT NULL DEFAULT 0,
  commission_amount        numeric(12,2) NOT NULL DEFAULT 0,
  currency                 text NOT NULL DEFAULT 'COP',
  status                   text NOT NULL DEFAULT 'reserved',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT partner_code_redemptions_target_check CHECK (
    checkout_session_id IS NOT NULL OR order_id IS NOT NULL OR status IN ('released', 'cancelled')
  ),
  CONSTRAINT partner_code_redemptions_amounts_check CHECK (
    subtotal_amount >= 0 AND discount_amount >= 0 AND
    commission_base_amount >= 0 AND commission_amount >= 0
  ),
  CONSTRAINT partner_code_redemptions_status_valid CHECK (
    status IN ('reserved', 'redeemed', 'released', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_partner_code_redemptions_code_status
  ON public.partner_code_redemptions(partner_code_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_code_redemptions_store_id
  ON public.partner_code_redemptions(store_id);

DROP TRIGGER IF EXISTS partner_code_redemptions_updated_at ON public.partner_code_redemptions;
CREATE TRIGGER partner_code_redemptions_updated_at
  BEFORE UPDATE ON public.partner_code_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.partner_commissions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id               uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  partner_id             uuid NOT NULL REFERENCES public.store_partners(id) ON DELETE RESTRICT,
  partner_code_id        uuid NOT NULL REFERENCES public.store_partner_codes(id) ON DELETE RESTRICT,
  partner_code_snapshot  text NOT NULL,
  partner_name_snapshot  text NOT NULL,
  order_id               uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  redemption_id          uuid REFERENCES public.partner_code_redemptions(id) ON DELETE SET NULL,
  commission_base_amount numeric(12,2) NOT NULL,
  commission_amount      numeric(12,2) NOT NULL,
  currency               text NOT NULL DEFAULT 'COP',
  status                 text NOT NULL DEFAULT 'pending',
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT partner_commissions_amounts_check CHECK (
    commission_base_amount >= 0 AND commission_amount >= 0
  ),
  CONSTRAINT partner_commissions_status_valid CHECK (
    status IN ('pending', 'approved', 'paid', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_store_status
  ON public.partner_commissions(store_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_id
  ON public.partner_commissions(partner_id);

DROP TRIGGER IF EXISTS partner_commissions_updated_at ON public.partner_commissions;
CREATE TRIGGER partner_commissions_updated_at
  BEFORE UPDATE ON public.partner_commissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.partner_code_redemptions IS
  'Atomic code reservations for online checkout and final redemptions for orders.';
COMMENT ON TABLE public.partner_commissions IS
  'Immutable commercial result of a partner-attributed order; status tracks settlement.';

-- ── 4. RLS ──────────────────────────────────────────────────

ALTER TABLE public.store_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_partner_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_partners_select_platform_admin ON public.store_partners;
CREATE POLICY store_partners_select_platform_admin ON public.store_partners
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS store_partners_manage_platform_admin ON public.store_partners;
CREATE POLICY store_partners_manage_platform_admin ON public.store_partners
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS store_partners_select_member ON public.store_partners;
CREATE POLICY store_partners_select_member ON public.store_partners
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS store_partners_manage_member ON public.store_partners;
CREATE POLICY store_partners_manage_member ON public.store_partners
  FOR ALL TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']))
  WITH CHECK (public.has_store_role(store_id, array['owner', 'admin']));

DROP POLICY IF EXISTS store_partner_codes_select_member ON public.store_partner_codes;
DROP POLICY IF EXISTS store_partner_codes_select_platform_admin ON public.store_partner_codes;
CREATE POLICY store_partner_codes_select_platform_admin ON public.store_partner_codes
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS store_partner_codes_manage_platform_admin ON public.store_partner_codes;
CREATE POLICY store_partner_codes_manage_platform_admin ON public.store_partner_codes
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
CREATE POLICY store_partner_codes_select_member ON public.store_partner_codes
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS store_partner_codes_manage_member ON public.store_partner_codes;
CREATE POLICY store_partner_codes_manage_member ON public.store_partner_codes
  FOR ALL TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']))
  WITH CHECK (public.has_store_role(store_id, array['owner', 'admin']));

DROP POLICY IF EXISTS partner_code_redemptions_select_member ON public.partner_code_redemptions;
DROP POLICY IF EXISTS partner_code_redemptions_select_platform_admin ON public.partner_code_redemptions;
CREATE POLICY partner_code_redemptions_select_platform_admin ON public.partner_code_redemptions
  FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY partner_code_redemptions_select_member ON public.partner_code_redemptions
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));

DROP POLICY IF EXISTS partner_commissions_select_member ON public.partner_commissions;
DROP POLICY IF EXISTS partner_commissions_select_platform_admin ON public.partner_commissions;
CREATE POLICY partner_commissions_select_platform_admin ON public.partner_commissions
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS partner_commissions_manage_platform_admin ON public.partner_commissions;
CREATE POLICY partner_commissions_manage_platform_admin ON public.partner_commissions
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
CREATE POLICY partner_commissions_select_member ON public.partner_commissions
  FOR SELECT TO authenticated USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS partner_commissions_manage_member ON public.partner_commissions;
CREATE POLICY partner_commissions_manage_member ON public.partner_commissions
  FOR UPDATE TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']))
  WITH CHECK (public.has_store_role(store_id, array['owner', 'admin']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_partner_codes TO authenticated;
GRANT SELECT ON public.partner_code_redemptions, public.partner_commissions TO authenticated;
GRANT UPDATE (status, notes) ON public.partner_commissions TO authenticated;
GRANT ALL ON public.store_partners, public.store_partner_codes,
  public.partner_code_redemptions, public.partner_commissions TO service_role;

-- ── 5. Shared pricing helpers ───────────────────────────────

CREATE OR REPLACE FUNCTION public.normalize_partner_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(btrim(COALESCE(p_code, '')));
$$;

CREATE OR REPLACE FUNCTION public.calculate_partner_discount(
  p_subtotal numeric,
  p_discount_type text,
  p_discount_value numeric,
  p_max_discount_amount numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round(LEAST(
    GREATEST(COALESCE(p_subtotal, 0), 0),
    CASE
      WHEN p_discount_type = 'percentage'
        THEN GREATEST(COALESCE(p_subtotal, 0), 0) * COALESCE(p_discount_value, 0) / 100
      ELSE COALESCE(p_discount_value, 0)
    END,
    COALESCE(p_max_discount_amount, 999999999999.99)
  ), 2);
$$;

CREATE OR REPLACE FUNCTION public.calculate_partner_commission(
  p_base_amount numeric,
  p_commission_type text,
  p_commission_value numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round(LEAST(
    GREATEST(COALESCE(p_base_amount, 0), 0),
    CASE
      WHEN p_commission_type = 'percentage'
        THEN GREATEST(COALESCE(p_base_amount, 0), 0) * COALESCE(p_commission_value, 0) / 100
      ELSE COALESCE(p_commission_value, 0)
    END
  ), 2);
$$;

-- ── 6. Public code preview ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.preview_partner_code(
  p_store_slug text,
  p_code text,
  p_subtotal numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_store_id uuid;
  v_enabled boolean;
  v_code record;
  v_normalized_code text := public.normalize_partner_code(p_code);
  v_discount numeric;
  v_used integer;
BEGIN
  SELECT s.id, COALESCE(sl.can_use_partner_codes, false)
    INTO v_store_id, v_enabled
  FROM public.stores s
  LEFT JOIN public.store_limits sl ON sl.store_id = s.id
  WHERE s.slug = p_store_slug AND s.status = 'active';

  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND'; END IF;
  IF NOT v_enabled THEN RAISE EXCEPTION 'PARTNER_CODES_DISABLED'; END IF;
  IF v_normalized_code = '' OR p_subtotal IS NULL OR p_subtotal <= 0 THEN
    RAISE EXCEPTION 'PARTNER_CODE_INVALID';
  END IF;

  SELECT pc.*, sp.name AS partner_name
    INTO v_code
  FROM public.store_partner_codes pc
  JOIN public.store_partners sp ON sp.id = pc.partner_id
  WHERE pc.store_id = v_store_id
    AND lower(pc.code) = lower(v_normalized_code)
    AND pc.status = 'active'
    AND sp.status = 'active';

  IF NOT FOUND THEN RAISE EXCEPTION 'PARTNER_CODE_INVALID'; END IF;
  IF v_code.starts_at IS NOT NULL AND now() < v_code.starts_at THEN RAISE EXCEPTION 'PARTNER_CODE_NOT_STARTED'; END IF;
  IF v_code.ends_at IS NOT NULL AND now() >= v_code.ends_at THEN RAISE EXCEPTION 'PARTNER_CODE_EXPIRED'; END IF;
  IF p_subtotal < v_code.min_subtotal THEN RAISE EXCEPTION 'PARTNER_CODE_MINIMUM_NOT_MET'; END IF;

  SELECT count(*)::integer INTO v_used
  FROM public.partner_code_redemptions r
  WHERE r.partner_code_id = v_code.id AND r.status IN ('reserved', 'redeemed');
  IF v_code.usage_limit IS NOT NULL AND v_used >= v_code.usage_limit THEN
    RAISE EXCEPTION 'PARTNER_CODE_USAGE_LIMIT_REACHED';
  END IF;

  v_discount := public.calculate_partner_discount(
    p_subtotal, v_code.discount_type, v_code.discount_value, v_code.max_discount_amount
  );

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_code.code,
    'partner_name', v_code.partner_name,
    'discount_type', v_code.discount_type,
    'discount_value', v_code.discount_value,
    'discount_amount', v_discount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_partner_code(text, text, numeric) TO anon, authenticated;

-- ── 7. Atomic online reservation ────────────────────────────

CREATE OR REPLACE FUNCTION public.reserve_partner_code_for_checkout(
  p_checkout_session_id uuid,
  p_code text,
  p_customer_phone text,
  p_customer_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_code record;
  v_redemption record;
  v_normalized_code text := public.normalize_partner_code(p_code);
  v_discount numeric;
  v_commission_base numeric;
  v_commission numeric;
  v_used integer;
  v_customer_used integer;
BEGIN
  SELECT * INTO v_session
  FROM public.checkout_sessions
  WHERE id = p_checkout_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHECKOUT_SESSION_NOT_FOUND'; END IF;

  SELECT * INTO v_redemption
  FROM public.partner_code_redemptions
  WHERE checkout_session_id = p_checkout_session_id
  FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'valid', true,
      'code', v_session.partner_code_snapshot,
      'partner_name', v_session.partner_name_snapshot,
      'discount_amount', v_session.partner_discount_amount,
      'commission_base_amount', v_session.partner_commission_base_amount,
      'commission_amount', v_session.partner_commission_amount
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.store_limits
    WHERE store_id = v_session.store_id AND can_use_partner_codes = true
  ) THEN
    RAISE EXCEPTION 'PARTNER_CODES_DISABLED';
  END IF;

  SELECT pc.*, sp.name AS partner_name
    INTO v_code
  FROM public.store_partner_codes pc
  JOIN public.store_partners sp ON sp.id = pc.partner_id
  WHERE pc.store_id = v_session.store_id
    AND lower(pc.code) = lower(v_normalized_code)
    AND pc.status = 'active'
    AND sp.status = 'active'
  FOR UPDATE OF pc;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTNER_CODE_INVALID'; END IF;
  IF v_code.starts_at IS NOT NULL AND now() < v_code.starts_at THEN RAISE EXCEPTION 'PARTNER_CODE_NOT_STARTED'; END IF;
  IF v_code.ends_at IS NOT NULL AND now() >= v_code.ends_at THEN RAISE EXCEPTION 'PARTNER_CODE_EXPIRED'; END IF;
  IF v_session.subtotal_amount < v_code.min_subtotal THEN RAISE EXCEPTION 'PARTNER_CODE_MINIMUM_NOT_MET'; END IF;

  SELECT count(*)::integer INTO v_used
  FROM public.partner_code_redemptions r
  WHERE r.partner_code_id = v_code.id AND r.status IN ('reserved', 'redeemed');
  IF v_code.usage_limit IS NOT NULL AND v_used >= v_code.usage_limit THEN
    RAISE EXCEPTION 'PARTNER_CODE_USAGE_LIMIT_REACHED';
  END IF;

  IF v_code.usage_limit_per_customer IS NOT NULL THEN
    SELECT count(*)::integer INTO v_customer_used
    FROM public.partner_code_redemptions r
    WHERE r.partner_code_id = v_code.id
      AND r.status IN ('reserved', 'redeemed')
      AND (
        (p_customer_phone IS NOT NULL AND r.customer_phone = p_customer_phone)
        OR (p_customer_email IS NOT NULL AND lower(r.customer_email) = lower(p_customer_email))
      );
    IF v_customer_used >= v_code.usage_limit_per_customer THEN
      RAISE EXCEPTION 'PARTNER_CODE_CUSTOMER_LIMIT_REACHED';
    END IF;
  END IF;

  v_discount := public.calculate_partner_discount(
    v_session.subtotal_amount, v_code.discount_type, v_code.discount_value, v_code.max_discount_amount
  );
  v_commission_base := greatest(v_session.subtotal_amount - v_discount, 0);
  v_commission := public.calculate_partner_commission(
    v_commission_base, v_code.commission_type, v_code.commission_value
  );

  INSERT INTO public.partner_code_redemptions (
    store_id, partner_code_id, partner_code_snapshot, partner_name_snapshot, checkout_session_id,
    customer_phone, customer_email, subtotal_amount, discount_amount,
    commission_base_amount, commission_amount, currency, status
  ) VALUES (
    v_session.store_id, v_code.id, v_code.code, v_code.partner_name, v_session.id,
    p_customer_phone, p_customer_email, v_session.subtotal_amount, v_discount,
    v_commission_base, v_commission, v_session.currency, 'reserved'
  );

  UPDATE public.checkout_sessions
  SET partner_code_id = v_code.id,
      partner_code_snapshot = v_code.code,
      partner_name_snapshot = v_code.partner_name,
      partner_discount_amount = v_discount,
      partner_commission_base_amount = v_commission_base,
      partner_commission_amount = v_commission,
      total_amount = v_session.subtotal_amount + v_session.shipping_amount - v_discount,
      amount_in_cents = round((v_session.subtotal_amount + v_session.shipping_amount - v_discount) * 100),
      updated_at = now()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_code.code,
    'partner_name', v_code.partner_name,
    'discount_amount', v_discount,
    'commission_base_amount', v_commission_base,
    'commission_amount', v_commission
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_partner_code_for_checkout(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_partner_code_for_checkout(uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_partner_code_for_checkout(p_checkout_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.partner_code_redemptions
  SET status = 'released', updated_at = now()
  WHERE checkout_session_id = p_checkout_session_id AND status = 'reserved';
$$;

REVOKE ALL ON FUNCTION public.release_partner_code_for_checkout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_partner_code_for_checkout(uuid) TO service_role;

-- Also releases a reserved code when an existing Wompi expiration/error path
-- changes the session status. This keeps usage limits accurate even if a
-- future worker forgets to call the explicit release RPC.
CREATE OR REPLACE FUNCTION public.release_partner_code_on_session_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('declined', 'expired', 'error', 'paid_stock_unavailable')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.partner_code_redemptions
    SET status = 'released', updated_at = now()
    WHERE checkout_session_id = NEW.id AND status = 'reserved';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkout_sessions_release_partner_code ON public.checkout_sessions;
CREATE TRIGGER checkout_sessions_release_partner_code
  AFTER UPDATE OF status ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.release_partner_code_on_session_resolution();

CREATE OR REPLACE FUNCTION public.release_partner_code_on_session_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- A redeemed row keeps its order attribution when the checkout session is
  -- eventually purged. Reservations without an order become released before
  -- the FK nulls the session reference, preserving usage-limit accuracy.
  UPDATE public.partner_code_redemptions
  SET status = 'released', updated_at = now()
  WHERE checkout_session_id = OLD.id
    AND order_id IS NULL
    AND status IN ('reserved', 'redeemed');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS checkout_sessions_release_partner_code_before_delete ON public.checkout_sessions;
CREATE TRIGGER checkout_sessions_release_partner_code_before_delete
  BEFORE DELETE ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.release_partner_code_on_session_delete();

-- ── 8. COD attribution ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_partner_code_to_order(
  p_order_id uuid,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_code record;
  v_normalized_code text := public.normalize_partner_code(p_code);
  v_discount numeric;
  v_commission_base numeric;
  v_commission numeric;
  v_used integer;
  v_customer_used integer;
  v_redemption_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_normalized_code = '' THEN
    RETURN jsonb_build_object('discount_amount', 0, 'total_amount', v_order.total_amount);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.store_limits
    WHERE store_id = v_order.store_id AND can_use_partner_codes = true
  ) THEN
    RAISE EXCEPTION 'PARTNER_CODES_DISABLED';
  END IF;

  SELECT pc.*, sp.name AS partner_name
    INTO v_code
  FROM public.store_partner_codes pc
  JOIN public.store_partners sp ON sp.id = pc.partner_id
  WHERE pc.store_id = v_order.store_id
    AND lower(pc.code) = lower(v_normalized_code)
    AND pc.status = 'active'
    AND sp.status = 'active'
  FOR UPDATE OF pc;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTNER_CODE_INVALID'; END IF;
  IF v_code.starts_at IS NOT NULL AND now() < v_code.starts_at THEN RAISE EXCEPTION 'PARTNER_CODE_NOT_STARTED'; END IF;
  IF v_code.ends_at IS NOT NULL AND now() >= v_code.ends_at THEN RAISE EXCEPTION 'PARTNER_CODE_EXPIRED'; END IF;
  IF v_order.subtotal < v_code.min_subtotal THEN RAISE EXCEPTION 'PARTNER_CODE_MINIMUM_NOT_MET'; END IF;

  SELECT count(*)::integer INTO v_used
  FROM public.partner_code_redemptions r
  WHERE r.partner_code_id = v_code.id AND r.status IN ('reserved', 'redeemed');
  IF v_code.usage_limit IS NOT NULL AND v_used >= v_code.usage_limit THEN
    RAISE EXCEPTION 'PARTNER_CODE_USAGE_LIMIT_REACHED';
  END IF;

  IF v_code.usage_limit_per_customer IS NOT NULL THEN
    SELECT count(*)::integer INTO v_customer_used
    FROM public.partner_code_redemptions r
    WHERE r.partner_code_id = v_code.id
      AND r.status IN ('reserved', 'redeemed')
      AND (
        (v_order.customer_phone IS NOT NULL AND r.customer_phone = v_order.customer_phone)
        OR (v_order.customer_email IS NOT NULL AND lower(r.customer_email) = lower(v_order.customer_email))
      );
    IF v_customer_used >= v_code.usage_limit_per_customer THEN
      RAISE EXCEPTION 'PARTNER_CODE_CUSTOMER_LIMIT_REACHED';
    END IF;
  END IF;

  v_discount := public.calculate_partner_discount(
    v_order.subtotal, v_code.discount_type, v_code.discount_value, v_code.max_discount_amount
  );
  v_commission_base := greatest(v_order.subtotal - v_discount, 0);
  v_commission := public.calculate_partner_commission(
    v_commission_base, v_code.commission_type, v_code.commission_value
  );

  UPDATE public.orders
  SET discount_amount = v_discount,
      total_amount = greatest(v_order.subtotal + v_order.shipping_amount - v_discount, 0),
      partner_code_id = v_code.id,
      partner_code = v_code.code,
      partner_name = v_code.partner_name,
      updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.partner_code_redemptions (
    store_id, partner_code_id, partner_code_snapshot, partner_name_snapshot, order_id,
    customer_phone, customer_email,
    subtotal_amount, discount_amount, commission_base_amount, commission_amount,
    currency, status
  ) VALUES (
    v_order.store_id, v_code.id, v_code.code, v_code.partner_name, v_order.id,
    v_order.customer_phone, v_order.customer_email,
    v_order.subtotal, v_discount, v_commission_base, v_commission,
    v_order.currency, 'redeemed'
  ) RETURNING id INTO v_redemption_id;

  INSERT INTO public.partner_commissions (
    store_id, partner_id, partner_code_id, partner_code_snapshot, partner_name_snapshot,
    order_id, redemption_id,
    commission_base_amount, commission_amount, currency, status
  ) VALUES (
    v_order.store_id, v_code.partner_id, v_code.id, v_code.code, v_code.partner_name,
    v_order.id, v_redemption_id,
    v_commission_base, v_commission, v_order.currency, 'pending'
  );

  RETURN jsonb_build_object(
    'discount_amount', v_discount,
    'commission_amount', v_commission,
    'total_amount', greatest(v_order.subtotal + v_order.shipping_amount - v_discount, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_partner_code_to_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_partner_code_to_order(uuid, text) TO service_role;

-- ── 9. Online order finalization wrapper ────────────────────
-- Rename the existing, thoroughly tested implementation to a private base
-- function. The public signature remains unchanged for the webhook, while
-- this wrapper attaches the partner ledger atomically after the base creates
-- the order and links inventory reservations.

ALTER FUNCTION public.create_store_order(
  text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid, text, boolean, text
) RENAME TO create_store_order_base;

CREATE OR REPLACE FUNCTION public.create_store_order(
  p_store_slug            text,
  p_customer_name         text,
  p_customer_phone        text,
  p_customer_email        text    DEFAULT NULL,
  p_fulfillment_method    text    DEFAULT 'local_delivery',
  p_shipping_address      text    DEFAULT NULL,
  p_city                  text    DEFAULT NULL,
  p_department            text    DEFAULT NULL,
  p_delivery_neighborhood text    DEFAULT NULL,
  p_delivery_reference    text    DEFAULT NULL,
  p_notes                 text    DEFAULT NULL,
  p_items                 jsonb   DEFAULT '[]'::jsonb,
  p_store_location_id     uuid    DEFAULT NULL,
  p_payment_method        text    DEFAULT 'cash_on_delivery',
  p_whatsapp_consent      boolean DEFAULT false,
  p_whatsapp_consent_source text  DEFAULT 'checkout_web',
  p_partner_code          text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_order_id uuid;
BEGIN
  v_result := public.create_store_order_base(
    p_store_slug, p_customer_name, p_customer_phone, p_customer_email,
    p_fulfillment_method, p_shipping_address, p_city, p_department,
    p_delivery_neighborhood, p_delivery_reference, p_notes, p_items,
    p_store_location_id, p_payment_method, p_whatsapp_consent,
    p_whatsapp_consent_source
  );

  IF p_partner_code IS NOT NULL AND btrim(p_partner_code) <> '' THEN
    v_order_id := (v_result ->> 'order_id')::uuid;
    PERFORM public.apply_partner_code_to_order(v_order_id, p_partner_code);
    v_result := jsonb_set(
      v_result,
      '{total_amount}',
      to_jsonb((SELECT total_amount FROM public.orders WHERE id = v_order_id))
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_order_base(
  text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid, text, boolean, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_order(
  text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid, text, boolean, text, text
) TO anon, authenticated;

-- ── 10. Online Wompi wrapper and session finalization ────────

CREATE OR REPLACE FUNCTION public.finalize_partner_code_for_order(
  p_checkout_session_id uuid,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_redemption record;
BEGIN
  SELECT * INTO v_session FROM public.checkout_sessions WHERE id = p_checkout_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.partner_code_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_redemption
  FROM public.partner_code_redemptions
  WHERE checkout_session_id = p_checkout_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.orders
  SET discount_amount = v_session.partner_discount_amount,
      total_amount = greatest(v_session.subtotal_amount + v_session.shipping_amount - v_session.partner_discount_amount, 0),
      partner_code_id = v_session.partner_code_id,
      partner_code = v_session.partner_code_snapshot,
      partner_name = v_session.partner_name_snapshot,
      updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.partner_code_redemptions
  SET order_id = p_order_id, status = 'redeemed', updated_at = now()
  WHERE id = v_redemption.id AND status = 'reserved';

  INSERT INTO public.partner_commissions (
    store_id, partner_id, partner_code_id, partner_code_snapshot, partner_name_snapshot,
    order_id, redemption_id,
    commission_base_amount, commission_amount, currency, status
  )
  SELECT v_session.store_id, pc.partner_id, v_session.partner_code_id,
         v_session.partner_code_snapshot, v_session.partner_name_snapshot,
         p_order_id, v_redemption.id,
         v_session.partner_commission_base_amount, v_session.partner_commission_amount,
         v_session.currency, 'pending'
  FROM public.store_partner_codes pc
  WHERE pc.id = v_session.partner_code_id
  ON CONFLICT (order_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_partner_code_for_order(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_partner_code_for_order(uuid, uuid) TO service_role;

ALTER FUNCTION public.create_order_from_wompi_approved_session(uuid, text, text, jsonb)
  RENAME TO create_order_from_wompi_approved_session_base;

CREATE OR REPLACE FUNCTION public.create_order_from_wompi_approved_session(
  p_checkout_session_id  uuid,
  p_wompi_transaction_id text,
  p_payment_method_type  text,
  p_raw_event            jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_order_id uuid;
  v_outcome text;
BEGIN
  v_result := public.create_order_from_wompi_approved_session_base(
    p_checkout_session_id, p_wompi_transaction_id, p_payment_method_type, p_raw_event
  );
  v_outcome := v_result ->> 'outcome';
  IF v_outcome IN ('created', 'already_created') THEN
    v_order_id := (v_result ->> 'order_id')::uuid;
    PERFORM public.finalize_partner_code_for_order(p_checkout_session_id, v_order_id);
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_from_wompi_approved_session_base(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_order_from_wompi_approved_session(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_from_wompi_approved_session(uuid, text, text, jsonb)
  TO service_role;

-- ── 11. Cancellation reverses pending attribution ───────────

CREATE OR REPLACE FUNCTION public.sync_partner_commission_on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.partner_commissions
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id AND status IN ('pending', 'approved');
    UPDATE public.partner_code_redemptions
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id AND status = 'redeemed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_sync_partner_commission ON public.orders;
CREATE TRIGGER orders_sync_partner_commission
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_partner_commission_on_order_status();

-- ── 12. Atomic partner/code creation for the admin panel ────

CREATE OR REPLACE FUNCTION public.create_store_partner_code(
  p_store_id                  uuid,
  p_partner_name              text,
  p_partner_email             text DEFAULT NULL,
  p_partner_phone             text DEFAULT NULL,
  p_partner_notes             text DEFAULT NULL,
  p_code                      text DEFAULT NULL,
  p_discount_type             text DEFAULT 'percentage',
  p_discount_value            numeric DEFAULT 0,
  p_max_discount_amount       numeric DEFAULT NULL,
  p_min_subtotal              numeric DEFAULT 0,
  p_commission_type           text DEFAULT 'percentage',
  p_commission_value          numeric DEFAULT 0,
  p_starts_at                 timestamptz DEFAULT NULL,
  p_ends_at                   timestamptz DEFAULT NULL,
  p_usage_limit               integer DEFAULT NULL,
  p_usage_limit_per_customer integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_partner_id uuid;
  v_code_id uuid;
  v_code text := public.normalize_partner_code(p_code);
BEGIN
  IF NOT (public.is_platform_admin() OR public.has_store_role(p_store_id, array['owner', 'admin'])) THEN
    RAISE EXCEPTION 'INSUFFICIENT_PRIVILEGE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.store_limits
    WHERE store_id = p_store_id AND can_use_partner_codes = true
  ) THEN
    RAISE EXCEPTION 'PARTNER_CODES_DISABLED';
  END IF;
  IF v_code = '' THEN RAISE EXCEPTION 'PARTNER_CODE_REQUIRED'; END IF;

  INSERT INTO public.store_partners (store_id, name, email, phone, notes)
  VALUES (p_store_id, btrim(p_partner_name), nullif(btrim(p_partner_email), ''), nullif(btrim(p_partner_phone), ''), p_partner_notes)
  RETURNING id INTO v_partner_id;

  INSERT INTO public.store_partner_codes (
    store_id, partner_id, code, discount_type, discount_value,
    max_discount_amount, min_subtotal, commission_type, commission_value,
    starts_at, ends_at, usage_limit, usage_limit_per_customer
  ) VALUES (
    p_store_id, v_partner_id, v_code, p_discount_type, p_discount_value,
    p_max_discount_amount, p_min_subtotal, p_commission_type, p_commission_value,
    p_starts_at, p_ends_at, p_usage_limit, p_usage_limit_per_customer
  ) RETURNING id INTO v_code_id;

  RETURN jsonb_build_object('partner_id', v_partner_id, 'code_id', v_code_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_partner_code(uuid, text, text, text, text, text, text, numeric, numeric, numeric, text, numeric, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_partner_code(uuid, text, text, text, text, text, text, numeric, numeric, numeric, text, numeric, timestamptz, timestamptz, integer, integer) TO authenticated, service_role;

-- ── 13. Latest public storefront view + grants ──────────────
-- This is the latest shape from migration 117 with the new entitlement
-- appended, preserving all existing PostgREST column positions.

CREATE OR REPLACE VIEW public.public_store_pages
  WITH (security_invoker = false)
AS
SELECT
  s.id AS store_id,
  s.slug AS store_slug,
  s.name AS store_name,
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
  t.mode AS theme_mode,
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
  CASE WHEN l.is_public THEN l.address_line ELSE NULL END AS location_address,
  CASE WHEN l.is_public THEN l.neighborhood ELSE NULL END AS location_neighborhood,
  CASE WHEN l.is_public THEN l.city ELSE NULL END AS location_city,
  CASE WHEN l.is_public THEN l.department ELSE NULL END AS location_department,
  CASE WHEN l.is_public THEN l.country ELSE NULL END AS location_country,
  CASE WHEN l.is_public THEN l.latitude ELSE NULL END AS location_latitude,
  CASE WHEN l.is_public THEN l.longitude ELSE NULL END AS location_longitude,
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
  COALESCE(cs.enabled, false) AS carta_enabled,
  COALESCE(cs.listed_in_storefront, false) AS carta_listed,
  COALESCE(sl.can_use_partner_codes, false) AS partner_codes_enabled
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
WHERE s.status = 'active';

GRANT SELECT ON public.public_store_pages TO anon, authenticated;
