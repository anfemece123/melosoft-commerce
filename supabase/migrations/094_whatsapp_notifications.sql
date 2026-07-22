-- ============================================================
-- Migration 094 — WhatsApp order notifications (Meta Cloud API)
--
-- Adds a persistent, idempotent notification queue for transactional
-- WhatsApp messages tied to orders, plus per-store configuration and
-- customer consent tracking. Only the "order_received" event is wired
-- to fire automatically in this migration — every other event_type is
-- accepted by the CHECK constraints and exposed as a settings toggle,
-- but nothing enqueues them yet. That is intentional: this migration
-- only automates the one notification the real order flow already has
-- a single, unambiguous, non-duplicated trigger point for (the moment
-- `orders` gets its row, from either create_store_order or
-- wompi-webhook). "order_confirmed" is deliberately left unwired — the
-- existing OrderConfirmDialog flow (manual wa.me click-to-chat) already
-- covers that moment and firing an automated message on top of it would
-- double-notify the customer.
--
-- Delivery model (Modelo A per CLAUDE.md decision): every store sends
-- from Melosoft's own central WhatsApp Business number. No per-store
-- Meta credentials are stored — store_whatsapp_settings.sender_mode
-- exists so a future migration can add per-store credential storage
-- (Modelo B) without reshaping this table. Central credentials
-- (META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID, etc.) live
-- only as Supabase secrets, read by the send-whatsapp-notification Edge
-- Function — never in this database.
--
-- Depends on: 001 (handle_updated_at), 004 (is_platform_admin,
-- is_store_member, has_store_role), 025/030/090 (orders, checkout_sessions,
-- create_store_order), 030 (payment_transactions columns + unique
-- constraint on provider_reference), 091 (checkout_sessions columns,
-- inventory_movements checkout_reserved/checkout_released), 092
-- (checkout_sessions 'paid_stock_unavailable' status).
--
-- Sections 9-10 also replace part of wompi-webhook's and
-- whatsapp-webhook's logic with two new SECURITY DEFINER functions
-- (create_order_from_wompi_approved_session, apply_whatsapp_status_event)
-- so that the Wompi order-creation race and the WhatsApp delivery-status
-- state machine are both enforced transactionally in Postgres rather
-- than as read-then-write logic split across separate Edge Function
-- calls — see each section's own header comment for the full rationale.
-- ============================================================

-- ============================================================
-- 1. Phone normalization — shared by the trigger below and reusable by
--    any future caller. Returns NULL (never raises) for anything it
--    can't confidently normalize, so callers can treat NULL as "skip,
--    don't send" without a try/catch.
--
--    Only Colombia gets country-specific handling (the only market this
--    platform serves today per store.country default). Numbers that
--    already look like full E.164 (start with '+' or are 11+ digits) are
--    passed through digit-stripped with a leading '+'. This is
--    intentionally conservative — a number this function can't validate
--    returns NULL rather than guessing a country code, per the
--    requirement to never send to an unvalidated number.
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_phone(
  p_phone   text,
  p_country text DEFAULT 'CO'
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits text;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' THEN
    RETURN NULL;
  END IF;

  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  IF upper(COALESCE(p_country, 'CO')) = 'CO' THEN
    -- 10-digit Colombian mobile: 3XXXXXXXXX
    IF length(v_digits) = 10 AND left(v_digits, 1) = '3' THEN
      RETURN '+57' || v_digits;
    END IF;
    -- Already has the country code: 57 + 10-digit mobile
    IF length(v_digits) = 12 AND left(v_digits, 2) = '57' AND substring(v_digits from 3 for 1) = '3' THEN
      RETURN '+' || v_digits;
    END IF;
    -- Leading trunk 0 + 57 + mobile (uncommon but seen in free-text input)
    IF length(v_digits) = 13 AND left(v_digits, 1) = '0' AND substring(v_digits from 2 for 2) = '57' THEN
      RETURN '+' || substring(v_digits from 2);
    END IF;
    -- Leading trunk 0 + 10-digit mobile
    IF length(v_digits) = 11 AND left(v_digits, 1) = '0' AND substring(v_digits from 2 for 1) = '3' THEN
      RETURN '+57' || substring(v_digits from 2);
    END IF;
    RETURN NULL;
  END IF;

  -- Non-Colombian store: accept only input that already looks like a
  -- full international number (avoids guessing a country code for a
  -- country this platform doesn't have explicit rules for yet).
  IF length(v_digits) BETWEEN 8 AND 15 THEN
    RETURN '+' || v_digits;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.normalize_whatsapp_phone(text, text) IS
  'Normalizes a phone number to E.164 for WhatsApp. Returns NULL for anything it cannot confidently validate — never guesses.';

-- ============================================================
-- 2. store_whatsapp_settings — one row per store, config only.
--    No Meta credentials here (Modelo A uses the central Melosoft
--    number) — see migration header.
-- ============================================================

CREATE TABLE public.store_whatsapp_settings (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                        uuid        NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled                         boolean     NOT NULL DEFAULT false,
  sender_mode                     text        NOT NULL DEFAULT 'central',
  -- The only event actually wired to fire automatically (see migration
  -- header). Every other *_enabled column below is stored and shown in
  -- the panel for forward-compatibility, but nothing reads them yet.
  customer_order_confirmation_enabled boolean NOT NULL DEFAULT true,
  order_confirmed_enabled         boolean     NOT NULL DEFAULT false,
  payment_approved_enabled        boolean     NOT NULL DEFAULT false,
  payment_declined_enabled        boolean     NOT NULL DEFAULT false,
  order_preparing_enabled         boolean     NOT NULL DEFAULT false,
  order_ready_for_pickup_enabled  boolean     NOT NULL DEFAULT false,
  order_shipped_enabled           boolean     NOT NULL DEFAULT false,
  order_delivered_enabled         boolean     NOT NULL DEFAULT false,
  order_cancelled_enabled         boolean     NOT NULL DEFAULT false,
  locale                          text        NOT NULL DEFAULT 'es_CO',
  timezone                        text        NOT NULL DEFAULT 'America/Bogota',
  final_message                   text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_whatsapp_settings_sender_mode_valid CHECK (sender_mode IN ('central', 'dedicated')),
  CONSTRAINT store_whatsapp_settings_final_message_length CHECK (char_length(final_message) <= 300)
);

COMMENT ON TABLE public.store_whatsapp_settings IS
  'Per-store WhatsApp notification configuration. No Meta credentials — Modelo A sends from the central Melosoft number.';
COMMENT ON COLUMN public.store_whatsapp_settings.sender_mode IS
  'central = sent from Melosoft''s shared number (Modelo A, only mode implemented). dedicated = reserved for Modelo B (per-store Embedded Signup number), not yet functional.';

CREATE TRIGGER store_whatsapp_settings_updated_at
  BEFORE UPDATE ON public.store_whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.store_whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_whatsapp_settings_select_platform_admin" ON public.store_whatsapp_settings
  FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE POLICY "store_whatsapp_settings_insert_platform_admin" ON public.store_whatsapp_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());

CREATE POLICY "store_whatsapp_settings_update_platform_admin" ON public.store_whatsapp_settings
  FOR UPDATE TO authenticated USING (public.is_platform_admin());

CREATE POLICY "store_whatsapp_settings_select_owner_admin" ON public.store_whatsapp_settings
  FOR SELECT TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']));

CREATE POLICY "store_whatsapp_settings_insert_owner_admin" ON public.store_whatsapp_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_store_role(store_id, array['owner', 'admin']));

CREATE POLICY "store_whatsapp_settings_update_owner_admin" ON public.store_whatsapp_settings
  FOR UPDATE TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']));

GRANT SELECT, INSERT, UPDATE ON public.store_whatsapp_settings TO authenticated;
GRANT ALL ON public.store_whatsapp_settings TO service_role;

-- ============================================================
-- 3. whatsapp_notifications — the persistent, idempotent queue.
--    order_id is nullable only for 'test_message' rows (owner/admin
--    sending themselves a test from the panel — see
--    enqueue_test_whatsapp_notification below); every real order event
--    has order_id set, and the partial unique index below is what
--    actually enforces "never send the same event twice for the same
--    order" — application code never needs to duplicate that check.
--
--    Status taxonomy — three distinct reasons a message never reaches a
--    customer, deliberately not collapsed into one:
--      - skipped:            WhatsApp disabled, the event disabled, or no
--                             consent. No row is ever written for this —
--                             it is not an error, there is nothing
--                             actionable to show, and cluttering the
--                             queue with expected non-sends would make
--                             genuine failures harder to spot.
--      - invalid_recipient:  the phone could not be normalized to a
--                             sendable E.164 number. A row IS written
--                             (visible in the panel — a bad phone is a
--                             data-quality issue worth surfacing to the
--                             store owner) but Meta is NEVER called, no
--                             delivery attempt is consumed, and it can
--                             never be retried into existence.
--      - failed:              a real attempt was made — Meta was called
--                             (send-whatsapp-notification) and either
--                             rejected the message or the outcome could
--                             not be confirmed after exhausting retries.
-- ============================================================

CREATE TABLE public.whatsapp_notifications (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id              uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  channel               text        NOT NULL DEFAULT 'whatsapp',
  event_type            text        NOT NULL,
  recipient_phone       text        NOT NULL,
  template_name         text        NOT NULL,
  template_language     text        NOT NULL DEFAULT 'es_CO',
  -- Assembled, already-sanitized template variables (positional array,
  -- matches Meta's {{1}}..{{n}} template params) — built by the Edge
  -- Function at send time from the order's current state, not cached
  -- here at enqueue time, so a slow-to-process row still reflects
  -- reality. NULL until the worker fills it in right before calling Meta.
  template_params       jsonb,
  status                text        NOT NULL DEFAULT 'queued',
  provider              text        NOT NULL DEFAULT 'meta_cloud_api',
  provider_message_id   text,
  attempts              integer     NOT NULL DEFAULT 0,
  max_attempts          integer     NOT NULL DEFAULT 5,
  next_attempt_at       timestamptz NOT NULL DEFAULT now(),
  locked_at             timestamptz,
  locked_by             text,
  is_permanent_failure  boolean     NOT NULL DEFAULT false,
  -- Sanitized only: error category/code + a short human message. Never
  -- the raw Meta response body (may contain the recipient's phone/name
  -- echoed back, or other PII we don't need to retain twice).
  last_error_category   text,
  last_error_code        text,
  last_error_message     text,
  queued_at             timestamptz NOT NULL DEFAULT now(),
  sent_at               timestamptz,
  delivered_at          timestamptz,
  read_at               timestamptz,
  failed_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT whatsapp_notifications_channel_valid CHECK (channel IN ('whatsapp')),
  CONSTRAINT whatsapp_notifications_event_type_valid CHECK (event_type IN (
    'order_received', 'order_confirmed', 'payment_approved', 'payment_declined',
    'order_preparing', 'order_ready_for_pickup', 'order_shipped', 'order_delivered',
    'order_cancelled', 'test_message'
  )),
  -- 'invalid_recipient' is distinct from 'failed': it means Meta was
  -- NEVER called (the phone was unusable before any send attempt), vs
  -- 'failed' which means the provider was called and rejected the
  -- message. See enqueue_whatsapp_order_notification's header comment
  -- for the full taxonomy (skipped / invalid_recipient / failed).
  CONSTRAINT whatsapp_notifications_status_valid CHECK (status IN (
    'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'invalid_recipient'
  )),
  CONSTRAINT whatsapp_notifications_attempts_valid CHECK (attempts >= 0 AND attempts <= max_attempts + 1),
  CONSTRAINT whatsapp_notifications_test_requires_no_order CHECK (
    (event_type = 'test_message') = (order_id IS NULL)
  )
);

COMMENT ON TABLE public.whatsapp_notifications IS
  'Persistent, idempotent queue for transactional WhatsApp notifications. Never store tokens, full Meta responses, or unsanitized errors here.';
COMMENT ON COLUMN public.whatsapp_notifications.last_error_message IS
  'Sanitized human-readable message only — never the raw provider response body.';

-- Idempotency: never enqueue (and therefore never send) the same event
-- for the same order twice. Partial (order_id IS NOT NULL) so
-- test_message rows, which always have order_id NULL, are never
-- constrained by it — repeated test sends are expected and rate-limited
-- separately by enqueue_test_whatsapp_notification.
CREATE UNIQUE INDEX whatsapp_notifications_idempotent_uq
  ON public.whatsapp_notifications (store_id, order_id, event_type, channel)
  WHERE order_id IS NOT NULL;

-- Processing lookup: rows a worker should claim next.
CREATE INDEX whatsapp_notifications_pending_idx
  ON public.whatsapp_notifications (next_attempt_at)
  WHERE status = 'queued';

-- Recovery of rows stuck 'sending' past their lock (worker crashed
-- mid-call) — the claim function below re-claims anything locked more
-- than a couple of minutes ago.
CREATE INDEX whatsapp_notifications_locked_idx
  ON public.whatsapp_notifications (locked_at)
  WHERE status = 'sending';

CREATE INDEX whatsapp_notifications_store_created_idx
  ON public.whatsapp_notifications (store_id, created_at DESC);

CREATE INDEX whatsapp_notifications_provider_message_id_idx
  ON public.whatsapp_notifications (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TRIGGER whatsapp_notifications_updated_at
  BEFORE UPDATE ON public.whatsapp_notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

-- No policy grants anon/authenticated INSERT/UPDATE/DELETE at all — every
-- write happens through SECURITY DEFINER functions (the order trigger,
-- the test-send RPC) or the service_role Edge Function. Read-only for
-- store staff, matching payment_transactions' pattern.

CREATE POLICY "whatsapp_notifications_select_platform_admin" ON public.whatsapp_notifications
  FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE POLICY "whatsapp_notifications_select_owner_admin" ON public.whatsapp_notifications
  FOR SELECT TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']));

CREATE POLICY "whatsapp_notifications_select_staff" ON public.whatsapp_notifications
  FOR SELECT TO authenticated
  USING (public.has_store_role(store_id, array['staff']));

GRANT SELECT ON public.whatsapp_notifications TO authenticated;
GRANT ALL ON public.whatsapp_notifications TO service_role;

-- ============================================================
-- 4. Consent columns — orders is the record of what the customer
--    actually agreed to at the moment they placed the order.
--    checkout_sessions gets the same columns because the Wompi flow
--    captures consent at checkout time (create-wompi-payment), before
--    an order exists at all — wompi-webhook copies it across when the
--    order is finally created on APPROVED.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS whatsapp_consent         boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at       timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_source   text,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_version  text;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS whatsapp_consent         boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at       timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_source   text,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_version  text;

COMMENT ON COLUMN public.orders.whatsapp_consent IS
  'Customer opted in to transactional WhatsApp updates for this order at checkout. Separate from any future marketing consent.';

-- ============================================================
-- 5. create_store_order — two new trailing parameters (both DEFAULT'd).
--    Adding parameters changes the function's argument-type signature,
--    so CREATE OR REPLACE alone would create a second overload instead
--    of replacing migration 090's version (Postgres keys function
--    identity on name + input types, not on defaults) — every other
--    migration touching this function keept the signature byte-for-byte
--    identical specifically to avoid that. This one can't, so the old
--    14-argument overload is dropped explicitly first. Every other line
--    of the body is copied verbatim from 090 — no pricing, stock, or
--    modifier logic changed.
-- ============================================================

DROP FUNCTION IF EXISTS public.create_store_order(
  text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid, text
);

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
  p_whatsapp_consent_source text  DEFAULT 'checkout_web'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_store_id                uuid;
  v_store_status            text;
  v_web_order_enabled       boolean;
  v_cod_enabled             boolean;
  v_online_checkout_enabled boolean;
  v_local_delivery_base_fee numeric := 0;
  v_local_delivery_free_from numeric := NULL;
  v_national_shipping_base_fee numeric := 0;
  v_national_shipping_free_from numeric := NULL;
  v_order_id                uuid;
  v_order_number            text;
  v_subtotal                numeric := 0;
  v_shipping_amount         numeric := 0;
  v_total_amount            numeric := 0;
  v_item                    jsonb;
  v_item_product_id         uuid;
  v_item_variant_id         uuid;
  v_product_name            text;
  v_product_slug            text;
  v_product_main_image      text;
  v_product_regular_price   numeric;
  v_product_sale_price      numeric;
  v_variant_price            numeric;
  v_variant_sku              text;
  v_variant_label             text;
  v_active_price             numeric;
  v_qty                      integer;
  v_line_total                numeric;
  v_customization_note        text;
  v_image_url                 text;
  v_order_item_id              uuid;
  v_customizations             jsonb;
  v_custom                     jsonb;
  v_option_group_id            uuid;
  v_option_item_id             uuid;
  v_opt_price_delta            numeric;
  v_opt_label                  text;
  v_opt_group_name             text;
  v_customization_total        numeric;
  v_has_option_groups          boolean;
  v_has_active_variants        boolean;
  v_group_row                  record;
  v_group_selected_count       integer;
  v_stock_before               integer;
  v_stock_after                integer;
  v_stock_policy               text;
  v_track_inventory            boolean;
  v_whatsapp_consent_at        timestamptz;
  i                         integer;
  j                         integer;
BEGIN
  SELECT s.id, s.status,
         scs.web_order_enabled,
         scs.cash_on_delivery_enabled,
         scs.online_checkout_enabled,
         scs.local_delivery_base_fee,
         scs.local_delivery_free_from,
         scs.national_shipping_base_fee,
         scs.national_shipping_free_from
  INTO v_store_id, v_store_status,
       v_web_order_enabled,
       v_cod_enabled,
       v_online_checkout_enabled,
       v_local_delivery_base_fee,
       v_local_delivery_free_from,
       v_national_shipping_base_fee,
       v_national_shipping_free_from
  FROM stores s
  JOIN store_commerce_settings scs ON scs.store_id = s.id
  WHERE s.slug = p_store_slug;

  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND'; END IF;
  IF v_store_status != 'active' THEN RAISE EXCEPTION 'STORE_INACTIVE'; END IF;
  IF NOT v_web_order_enabled THEN RAISE EXCEPTION 'WEB_ORDERS_DISABLED'; END IF;

  IF p_payment_method NOT IN ('cash_on_delivery', 'online') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;
  IF p_payment_method = 'cash_on_delivery' AND NOT v_cod_enabled THEN
    RAISE EXCEPTION 'COD_DISABLED';
  END IF;
  IF p_payment_method = 'online' AND NOT v_online_checkout_enabled THEN
    RAISE EXCEPTION 'ONLINE_CHECKOUT_DISABLED';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS';
  END IF;

  IF p_store_location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM store_locations
      WHERE id = p_store_location_id AND store_id = v_store_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'INVALID_LOCATION';
    END IF;
  END IF;

  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
  v_whatsapp_consent_at := CASE WHEN p_whatsapp_consent THEN now() ELSE NULL END;

  INSERT INTO orders (
    store_id, order_number, store_location_id,
    customer_name, customer_phone, customer_email,
    fulfillment_method, shipping_address, city, department,
    delivery_neighborhood, delivery_reference, notes,
    source, payment_method,
    subtotal, shipping_amount, discount_amount, total_amount,
    currency, status, payment_status,
    whatsapp_consent, whatsapp_consent_at, whatsapp_consent_source, whatsapp_consent_version
  ) VALUES (
    v_store_id, v_order_number, p_store_location_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_fulfillment_method, p_shipping_address, p_city, p_department,
    p_delivery_neighborhood, p_delivery_reference, p_notes,
    'web', p_payment_method,
    0, 0, 0, 0,
    'COP', 'pending', 'pending',
    p_whatsapp_consent, v_whatsapp_consent_at, p_whatsapp_consent_source, 'v1'
  )
  RETURNING id INTO v_order_id;

  FOR i IN 0 .. (jsonb_array_length(p_items) - 1)
  LOOP
    v_item := p_items -> i;
    v_item_product_id := (v_item ->> 'product_id')::uuid;
    v_item_variant_id := NULLIF(v_item ->> 'variant_id', '')::uuid;
    v_qty := (v_item ->> 'quantity')::integer;
    v_customization_note := v_item ->> 'customization_notes';
    v_customizations := COALESCE(v_item -> 'customizations', '[]'::jsonb);

    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY:%', v_item ->> 'product_id';
    END IF;

    SELECT p.id, p.name, p.slug, p.regular_price, p.sale_price, p.main_image_url
    INTO v_item_product_id, v_product_name, v_product_slug,
         v_product_regular_price, v_product_sale_price, v_product_main_image
    FROM products p
    WHERE p.id = v_item_product_id
      AND p.store_id = v_store_id
      AND p.status = 'active'
      AND p.is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_PRODUCT:%', v_item ->> 'product_id';
    END IF;

    IF v_item_variant_id IS NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM product_variants
        WHERE product_id = v_item_product_id
          AND store_id = v_store_id
          AND status = 'active'
      ) INTO v_has_active_variants;

      IF v_has_active_variants THEN
        RAISE EXCEPTION 'VARIANT_REQUIRED:%', v_item_product_id;
      END IF;
    END IF;

    v_active_price := COALESCE(v_product_sale_price, v_product_regular_price);
    v_variant_sku := NULL;
    v_variant_label := NULL;

    IF v_item_variant_id IS NOT NULL THEN
      SELECT pv.price, pv.sku
      INTO v_variant_price, v_variant_sku
      FROM product_variants pv
      WHERE pv.id = v_item_variant_id
        AND pv.product_id = v_item_product_id
        AND pv.store_id = v_store_id
        AND pv.status = 'active';

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_VARIANT:%', v_item ->> 'variant_id';
      END IF;

      v_active_price := COALESCE(v_variant_price, v_product_sale_price, v_product_regular_price);

      SELECT string_agg(vov.value, ' / ' ORDER BY vo.sort_order)
      INTO v_variant_label
      FROM product_variant_selected_values psv
      JOIN product_variant_options vo ON vo.id = psv.option_id
      JOIN product_variant_option_values vov ON vov.id = psv.option_value_id
      WHERE psv.variant_id = v_item_variant_id;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM product_option_groups
      WHERE product_id = v_item_product_id AND store_id = v_store_id
    ) INTO v_has_option_groups;

    IF jsonb_array_length(v_customizations) > 0 AND NOT v_has_option_groups THEN
      RAISE EXCEPTION 'PRODUCT_HAS_NO_MODIFIERS:%', v_item_product_id;
    END IF;

    v_customization_total := 0;

    FOR j IN 0 .. (jsonb_array_length(v_customizations) - 1)
    LOOP
      v_custom := v_customizations -> j;
      v_option_group_id := NULLIF(v_custom ->> 'option_group_id', '')::uuid;
      v_option_item_id  := NULLIF(v_custom ->> 'option_item_id', '')::uuid;

      IF v_option_group_id IS NULL OR v_option_item_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_MODIFIER_PAYLOAD';
      END IF;

      SELECT poi.price_delta INTO v_opt_price_delta
      FROM product_option_items poi
      JOIN product_option_groups pog ON pog.id = poi.group_id
      WHERE poi.id = v_option_item_id
        AND pog.id = v_option_group_id
        AND pog.product_id = v_item_product_id
        AND poi.store_id = v_store_id
        AND pog.store_id = v_store_id
        AND poi.is_active = true
        AND pog.is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_MODIFIER:%', v_option_item_id;
      END IF;

      v_customization_total := v_customization_total + v_opt_price_delta;
    END LOOP;

    FOR v_group_row IN
      SELECT pog.id, pog.name, pog.is_required, pog.min_select, pog.max_select
      FROM product_option_groups pog
      WHERE pog.product_id = v_item_product_id
        AND pog.store_id = v_store_id
        AND pog.is_active = true
    LOOP
      SELECT count(*) INTO v_group_selected_count
      FROM jsonb_array_elements(v_customizations) c
      WHERE NULLIF(c ->> 'option_group_id', '')::uuid = v_group_row.id;

      IF v_group_row.is_required AND v_group_selected_count < GREATEST(v_group_row.min_select, 1) THEN
        RAISE EXCEPTION 'MODIFIER_GROUP_REQUIRED:%', v_group_row.name;
      END IF;
      IF v_group_row.min_select > 0 AND v_group_selected_count < v_group_row.min_select THEN
        RAISE EXCEPTION 'MODIFIER_GROUP_MIN:%', v_group_row.name;
      END IF;
      IF v_group_row.max_select IS NOT NULL AND v_group_selected_count > v_group_row.max_select THEN
        RAISE EXCEPTION 'MODIFIER_GROUP_MAX:%', v_group_row.name;
      END IF;
    END LOOP;

    v_active_price := v_active_price + v_customization_total;

    SELECT COALESCE(
      (SELECT pi.image_url FROM product_images pi
       WHERE pi.variant_id = v_item_variant_id
       ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
       LIMIT 1),
      (SELECT pi.image_url FROM product_images pi
       WHERE pi.product_id = v_item_product_id AND pi.variant_id IS NULL
       ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
       LIMIT 1),
      v_product_main_image
    ) INTO v_image_url;

    v_line_total := v_active_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    INSERT INTO order_items (
      order_id, product_id, variant_id,
      product_name_snapshot, product_slug_snapshot, product_image_url_snapshot,
      variant_label_snapshot, variant_sku_snapshot,
      name, quantity, unit_price, total_price,
      customer_note
    ) VALUES (
      v_order_id, v_item_product_id, v_item_variant_id,
      v_product_name, v_product_slug, v_image_url,
      v_variant_label, v_variant_sku,
      v_product_name, v_qty, v_active_price, v_line_total,
      v_customization_note
    )
    RETURNING id INTO v_order_item_id;

    FOR j IN 0 .. (jsonb_array_length(v_customizations) - 1)
    LOOP
      v_custom := v_customizations -> j;
      v_option_group_id := (v_custom ->> 'option_group_id')::uuid;
      v_option_item_id  := (v_custom ->> 'option_item_id')::uuid;

      SELECT poi.price_delta, poi.label, pog.name
      INTO v_opt_price_delta, v_opt_label, v_opt_group_name
      FROM product_option_items poi
      JOIN product_option_groups pog ON pog.id = poi.group_id
      WHERE poi.id = v_option_item_id
        AND pog.id = v_option_group_id;

      INSERT INTO order_item_customizations (
        order_item_id, option_group_id, option_item_id,
        option_group_name, option_item_label, price_delta
      ) VALUES (
        v_order_item_id, v_option_group_id, v_option_item_id,
        v_opt_group_name, v_opt_label, v_opt_price_delta
      );
    END LOOP;

    IF v_item_variant_id IS NOT NULL THEN
      SELECT stock_quantity, stock_policy
      INTO v_stock_before, v_stock_policy
      FROM product_variants
      WHERE id = v_item_variant_id AND store_id = v_store_id
      FOR UPDATE;

      IF v_stock_policy = 'deny' AND v_stock_before < v_qty THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_item_variant_id;
      END IF;

      v_stock_after := GREATEST(v_stock_before - v_qty, 0);

      IF v_stock_after <> v_stock_before THEN
        UPDATE product_variants SET stock_quantity = v_stock_after, updated_at = now()
        WHERE id = v_item_variant_id;

        INSERT INTO inventory_movements (
          store_id, product_id, variant_id, order_id, order_item_id,
          movement_type, reason, quantity_change, stock_before, stock_after, created_by
        ) VALUES (
          v_store_id, v_item_product_id, v_item_variant_id, v_order_id, v_order_item_id,
          'order_placed', 'Pedido web/contraentrega', v_stock_after - v_stock_before,
          v_stock_before, v_stock_after, NULL
        );
      END IF;
    ELSE
      SELECT stock, track_inventory
      INTO v_stock_before, v_track_inventory
      FROM products
      WHERE id = v_item_product_id AND store_id = v_store_id
      FOR UPDATE;

      IF v_track_inventory THEN
        IF v_stock_before < v_qty THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_item_product_id;
        END IF;

        v_stock_after := v_stock_before - v_qty;

        UPDATE products SET stock = v_stock_after, updated_at = now()
        WHERE id = v_item_product_id;

        INSERT INTO inventory_movements (
          store_id, product_id, variant_id, order_id, order_item_id,
          movement_type, reason, quantity_change, stock_before, stock_after, created_by
        ) VALUES (
          v_store_id, v_item_product_id, NULL, v_order_id, v_order_item_id,
          'order_placed', 'Pedido web/contraentrega', v_stock_after - v_stock_before,
          v_stock_before, v_stock_after, NULL
        );
      END IF;
    END IF;
  END LOOP;

  IF p_fulfillment_method = 'local_delivery' OR p_fulfillment_method = 'delivery' THEN
    v_shipping_amount := CASE
      WHEN v_local_delivery_free_from IS NOT NULL AND v_subtotal >= v_local_delivery_free_from THEN 0
      ELSE COALESCE(v_local_delivery_base_fee, 0)
    END;
  ELSIF p_fulfillment_method = 'national_shipping' THEN
    v_shipping_amount := CASE
      WHEN v_national_shipping_free_from IS NOT NULL AND v_subtotal >= v_national_shipping_free_from THEN 0
      ELSE COALESCE(v_national_shipping_base_fee, 0)
    END;
  ELSE
    v_shipping_amount := 0;
  END IF;

  v_total_amount := v_subtotal + v_shipping_amount;

  UPDATE orders
  SET subtotal = v_subtotal,
      shipping_amount = v_shipping_amount,
      total_amount = v_total_amount
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id',       v_order_id,
    'order_number',   v_order_number,
    'total_amount',   v_total_amount,
    'payment_method', p_payment_method,
    'status',         'pending'
  );
END;
$$;

-- Same grants as before — signature is backward compatible.
GRANT EXECUTE ON FUNCTION public.create_store_order TO anon, authenticated;

-- ============================================================
-- 6. enqueue_whatsapp_order_notification — AFTER INSERT trigger on
--    orders. This is the single authoritative dispatch point: it fires
--    identically whether the row came from create_store_order (COD,
--    invoked directly from the browser) or from
--    create_order_from_wompi_approved_session (service_role, Wompi
--    APPROVED — see section 9). Neither caller has to remember to
--    enqueue anything.
--
--    Deliberately does NOT build template_params here — order_items for
--    this order may not exist yet at the instant this fires (both
--    callers insert order_items in statements *after* the orders INSERT
--    completes). template_params is built by send-whatsapp-notification
--    at send time instead, by querying the order fresh — see that
--    function's header comment for why.
--
--    Failure isolation: the entire body below (everything after the
--    opening BEGIN of the inner block) runs inside a nested
--    BEGIN/EXCEPTION so that ANY error raised while looking up settings,
--    normalizing the phone, or inserting the queue row is caught here
--    and never propagates to the caller. This is deliberately scoped to
--    ONLY this trigger's own secondary logic — it does not, and must
--    not, wrap anything in create_store_order or the orders/order_items
--    INSERTs themselves, which still fail (and roll back) exactly as
--    before on a real error. A pedido is a completed sale; a WhatsApp
--    confirmation is a courtesy on top of it, and a bug in the courtesy
--    must never cost the sale.
--
--    WHEN OTHERS catches every error class Postgres can raise inside
--    this block: constraint violations on the whatsapp_notifications
--    INSERT other than the expected unique_violation (already handled
--    without raising via ON CONFLICT DO NOTHING), unexpected NULLs,
--    type-cast failures, lock/deadlock errors acquired while inserting,
--    or any future bug introduced here. On catch: RETURN NEW immediately
--    (the order commits normally) and record a sanitized diagnostic via
--    RAISE WARNING — order_id, store_id and SQLSTATE only, never
--    SQLERRM (which can echo back the value that caused the error, e.g.
--    a malformed phone/name), never the customer's phone or name. This
--    project has no dedicated technical-audit table today, so a
--    Postgres WARNING (visible in Supabase's Postgres Logs) is the
--    "minimal sanitized log" this trigger falls back to.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_order_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings        record;
  v_store_country    text;
  v_recipient_phone  text;
BEGIN
  BEGIN
    SELECT enabled, customer_order_confirmation_enabled, locale
    INTO v_settings
    FROM store_whatsapp_settings
    WHERE store_id = NEW.store_id;

    -- No settings row, feature disabled, or this specific event disabled
    -- for the store: do nothing. No row is written — an absent
    -- notification for a disabled store is not an error state (this is
    -- the "skipped" case documented in section 2's status taxonomy
    -- comment — it never reaches whatsapp_notifications at all).
    IF NOT FOUND OR NOT v_settings.enabled OR NOT v_settings.customer_order_confirmation_enabled THEN
      RETURN NEW;
    END IF;

    -- No consent: never send, and never enqueue. This is the only place
    -- consent is enforced — the queue itself has no way to hold a message
    -- "pending consent", it simply never gets created. Also "skipped".
    IF NOT NEW.whatsapp_consent THEN
      RETURN NEW;
    END IF;

    SELECT country INTO v_store_country FROM stores WHERE id = NEW.store_id;
    v_recipient_phone := public.normalize_whatsapp_phone(NEW.customer_phone, COALESCE(v_store_country, 'CO'));

    IF v_recipient_phone IS NULL THEN
      -- Invalid or missing phone: record why, visibly, WITHOUT ever
      -- calling Meta and WITHOUT consuming a delivery attempt.
      -- status = 'invalid_recipient' is deliberately its own status, not
      -- 'failed' — 'failed' is reserved for a real attempt the provider
      -- rejected (send-whatsapp-notification calling Meta and getting an
      -- error back). This row is visible in the panel's history but is
      -- never picked up by claim_pending_whatsapp_notifications (it only
      -- claims 'queued'/stale-'sending' rows), so it can never be
      -- retried into existence.
      INSERT INTO whatsapp_notifications (
        store_id, order_id, event_type, recipient_phone, template_name, template_language,
        status, attempts, max_attempts, is_permanent_failure,
        last_error_category, last_error_code, last_error_message, failed_at
      ) VALUES (
        NEW.store_id, NEW.id, 'order_received', COALESCE(NEW.customer_phone, ''), 'melosoft_order_confirmation_v1',
        COALESCE(v_settings.locale, 'es_CO'),
        'invalid_recipient', 0, 0, true,
        'invalid_phone', 'INVALID_PHONE', 'El número de teléfono del pedido no es válido para WhatsApp.', now()
      )
      ON CONFLICT DO NOTHING;
      RETURN NEW;
    END IF;

    INSERT INTO whatsapp_notifications (
      store_id, order_id, event_type, recipient_phone, template_name, template_language, status
    ) VALUES (
      NEW.store_id, NEW.id, 'order_received', v_recipient_phone, 'melosoft_order_confirmation_v1',
      COALESCE(v_settings.locale, 'es_CO'), 'queued'
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'whatsapp_notification_enqueue_failed order_id=% store_id=% sqlstate=%',
      NEW.id, NEW.store_id, SQLSTATE;
    RETURN NEW;
  END;
END;
$$;

CREATE TRIGGER trg_enqueue_whatsapp_order_notification
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_whatsapp_order_notification();

-- ============================================================
-- 7. claim_pending_whatsapp_notifications — atomic claim for the worker
--    (send-whatsapp-notification Edge Function). FOR UPDATE SKIP LOCKED
--    so concurrent invocations never claim the same row twice; also
--    reclaims rows stuck 'sending' for more than 2 minutes (worker
--    crashed/timed out mid-call) instead of leaving them stranded.
--    service_role only — this is a queue internals operation, never
--    exposed to store staff.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_pending_whatsapp_notifications(
  p_limit     integer DEFAULT 20,
  p_worker_id text    DEFAULT 'worker'
)
RETURNS SETOF public.whatsapp_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE whatsapp_notifications
  SET status = 'sending',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id
  WHERE id IN (
    SELECT id FROM whatsapp_notifications
    WHERE (status = 'queued' AND next_attempt_at <= now())
       OR (status = 'sending' AND locked_at < now() - interval '2 minutes')
    ORDER BY next_attempt_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_whatsapp_notifications(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_whatsapp_notifications(integer, text) TO service_role;

-- ============================================================
-- 8. enqueue_test_whatsapp_notification — owner/admin-triggered test
--    send from the settings panel. Rate limited (max 3 per store per
--    rolling hour) to prevent the panel being used as a bulk-send tool.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enqueue_test_whatsapp_notification(
  p_store_id uuid,
  p_phone    text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_store_country   text;
  v_recipient_phone text;
  v_recent_count    integer;
  v_locale          text;
  v_notification_id uuid;
BEGIN
  IF NOT public.has_store_role(p_store_id, array['owner', 'admin']) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT count(*) INTO v_recent_count
  FROM whatsapp_notifications
  WHERE store_id = p_store_id
    AND event_type = 'test_message'
    AND created_at > now() - interval '1 hour';

  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'TEST_RATE_LIMIT_EXCEEDED';
  END IF;

  SELECT country INTO v_store_country FROM stores WHERE id = p_store_id;
  v_recipient_phone := public.normalize_whatsapp_phone(p_phone, COALESCE(v_store_country, 'CO'));

  IF v_recipient_phone IS NULL THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;

  SELECT locale INTO v_locale FROM store_whatsapp_settings WHERE store_id = p_store_id;

  INSERT INTO whatsapp_notifications (
    store_id, order_id, event_type, recipient_phone, template_name, template_language, status
  ) VALUES (
    p_store_id, NULL, 'test_message', v_recipient_phone, 'melosoft_whatsapp_test_v1',
    COALESCE(v_locale, 'es_CO'), 'queued'
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_test_whatsapp_notification(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_test_whatsapp_notification(uuid, text) TO authenticated;

-- ============================================================
-- 9. create_order_from_wompi_approved_session — atomic, idempotent
--    order creation for the Wompi APPROVED path.
--
--    Problem this replaces: wompi-webhook previously read
--    checkout_sessions.order_id, and if NULL, created the order in a
--    separate later statement — a classic check-then-act race. Two
--    concurrent APPROVED deliveries for the same session (a real
--    possibility with any webhook provider's own retry behavior) could
--    both observe order_id IS NULL before either one's INSERT commits,
--    and both create an order.
--
--    Fix: the Edge Function no longer does the read-check-create-update
--    sequence itself across several independent REST calls (which can't
--    share a transaction). It now makes ONE call to this function, which
--    does the entire sequence inside a single Postgres transaction and
--    takes `SELECT ... FOR UPDATE` on the checkout_sessions row FIRST.
--    A second concurrent call for the same session_id blocks on that
--    lock until the first transaction commits, then re-reads order_id
--    under its own lock and finds it already set — it returns the
--    existing order instead of creating a second one. Only one caller
--    ever reaches the INSERT INTO orders for a given session.
--
--    checkout_sessions.order_id also gets a UNIQUE constraint below —
--    but be precise about what each mechanism actually does, because
--    they protect against two DIFFERENT failure modes:
--      - UNIQUE(order_id) prevents two DIFFERENT checkout_sessions from
--        ever pointing at the SAME order. It says nothing at all about
--        one session producing two different orders — two INSERT INTO
--        orders calls for the SAME session would each get their own
--        new, distinct order_id, and neither would violate this
--        constraint, because uniqueness is checked per order_id value,
--        not per session. UNIQUE alone would NOT stop the race this
--        function exists to prevent.
--      - SELECT ... FOR UPDATE on the checkout_sessions row is what
--        actually prevents ONE session from producing two orders: it
--        forces a second concurrent caller to wait, then re-read
--        order_id (now set), before it could ever reach INSERT INTO
--        orders. This is the real guarantee; UNIQUE(order_id) is a
--        backstop for a different, narrower case (some future code path
--        writing order_id directly, outside this function, onto a
--        second session).
--    Both the order INSERT and the checkout_sessions.order_id UPDATE
--    that follows it happen inside this one function — i.e. inside the
--    single Postgres transaction the calling Edge Function's one RPC
--    call runs as. Nothing about "create the order" and "record which
--    session it came from" is ever split across two separate
--    transactions or two separate network calls.
--
--    Every other Wompi validation (webhook signature, amount, currency,
--    provider_reference lookup, mapping Wompi's transaction.status) is
--    UNCHANGED and still happens in wompi-webhook/index.ts before this
--    function is ever called — this function only owns the part that
--    must be transactional: turning one checkout_session into at most
--    one order. The declined/error/voided branch (stock release) is
--    also unchanged and does not call this function.
--
--    Reservation-freshness check (migration 092) and item/customization/
--    inventory-movement-linking logic are carried over verbatim from
--    the previous TypeScript implementation, just translated to
--    PL/pgSQL so they run inside the same locked transaction.
--
--    Trust boundary: this function takes NO store_id, no amount, no
--    payment status, and no customer data as a parameter — every
--    authoritative field (store_id, totals, customer info, items,
--    consent) is read from the checkout_sessions ROW ITSELF, after it is
--    locked. p_wompi_transaction_id/p_payment_method_type/p_raw_event
--    are Wompi-sourced audit/display data only (already extracted from a
--    webhook payload whose signature wompi-webhook verified before ever
--    calling this function) — they are never used to decide what gets
--    created or for how much. A caller cannot use this RPC to create an
--    order for an arbitrary store or amount; it can only ever turn an
--    already-existing, already-validated checkout_session into the
--    order that session's own locked-in snapshot describes.
--
--    Why SECURITY DEFINER here, specifically: not for RLS bypass —
--    service_role (the only role granted EXECUTE, see below) already
--    bypasses RLS and already holds ALL PRIVILEGES on every table this
--    function touches, so a SECURITY INVOKER version would behave
--    identically for its one real caller. It's kept for two concrete
--    reasons: (1) SET search_path = public, pg_temp only pins the
--    resolution path meaningfully for a DEFINER function — keeping this
--    function on the same footing as every other privileged function in
--    this file avoids a one-off exception a future reader would have to
--    puzzle over; (2) it makes the function's own EXECUTE grant the
--    single access-control gate, independent of whatever table-level
--    grants exist or change later. This mirrors migration 091's
--    create_wompi_checkout_reservation and
--    release_wompi_reservation_by_session, the two existing functions
--    this one is a direct sibling of.
-- ============================================================

ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_order_id_unique;
ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_order_id_unique UNIQUE (order_id);

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
  v_session          record;
  v_order_id         uuid;
  v_order_number     text;
  v_now              timestamptz := now();
  v_provider_id      uuid;
  v_snapshot_items   jsonb;
  v_item             jsonb;
  v_customizations   jsonb;
  v_custom           jsonb;
  v_order_item_id    uuid;
  v_reservation_id   uuid;
  i                  integer;
  j                  integer;
BEGIN
  -- The lock: everything about this function's atomicity depends on
  -- this single statement running first and holding the row lock for
  -- the rest of the transaction.
  SELECT * INTO v_session
  FROM checkout_sessions
  WHERE id = p_checkout_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'session_not_found');
  END IF;

  -- Idempotency fast path: another call (the "loser" of a race, or a
  -- genuinely later retried webhook delivery) already created the order.
  IF v_session.order_id IS NOT NULL THEN
    UPDATE checkout_sessions
    SET status = 'approved', wompi_transaction_id = p_wompi_transaction_id, updated_at = v_now
    WHERE id = v_session.id;

    RETURN jsonb_build_object('outcome', 'already_created', 'order_id', v_session.order_id);
  END IF;

  IF v_session.status = 'paid_stock_unavailable' THEN
    RETURN jsonb_build_object('outcome', 'already_flagged', 'checkout_session_id', v_session.id);
  END IF;

  -- Status guard: only a session still awaiting resolution ('created' —
  -- just started, or 'pending' — Wompi returned pending at checkout) may
  -- turn into an order here. A session already marked 'declined',
  -- 'expired', 'error', or 'voided' was already resolved negatively by
  -- an earlier webhook event or the expiration sweep; a late/duplicate/
  -- out-of-order APPROVED arriving afterward for a session in one of
  -- those states must not silently create an order for it. In the
  -- common case this is already caught below by the reservation-
  -- freshness check (releasing a reservation always logs a
  -- 'checkout_released' movement — migration 091/092), but that check
  -- has no signal at all for a session whose items never had stock
  -- tracked (track_inventory=false everywhere), so this explicit guard
  -- closes that gap directly against the session's own status instead
  -- of inferring it indirectly from inventory_movements.
  IF v_session.status NOT IN ('created', 'pending') THEN
    UPDATE checkout_sessions
    SET wompi_transaction_id = p_wompi_transaction_id, updated_at = v_now
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
      'outcome', 'session_already_resolved',
      'checkout_session_id', v_session.id,
      'previous_status', v_session.status
    );
  END IF;

  -- Reservation freshness check (migration 092, unchanged decision): if
  -- this session's reservation was already released (declined webhook
  -- arrived first, or the deferred-expiration sweep reclaimed it), the
  -- stock this payment expected to hold may already be sold elsewhere.
  -- Never create a normal order on top of that and never auto-re-reserve.
  IF EXISTS (
    SELECT 1 FROM inventory_movements
    WHERE checkout_session_id = v_session.id AND movement_type = 'checkout_released'
    LIMIT 1
  ) THEN
    SELECT id INTO v_provider_id FROM payment_providers WHERE code = 'wompi';

    INSERT INTO payment_transactions (
      store_id, order_id, provider_id, provider_reference, provider_transaction_id,
      amount, amount_in_cents, currency, status, payment_method, checkout_url, raw_response, paid_at
    ) VALUES (
      v_session.store_id, NULL, v_provider_id, v_session.provider_reference, p_wompi_transaction_id,
      v_session.total_amount, v_session.amount_in_cents, v_session.currency, 'approved',
      p_payment_method_type, v_session.checkout_url, p_raw_event, v_now
    )
    ON CONFLICT (provider_reference) DO NOTHING;

    UPDATE checkout_sessions
    SET status = 'paid_stock_unavailable', wompi_transaction_id = p_wompi_transaction_id, updated_at = v_now
    WHERE id = v_session.id;

    RETURN jsonb_build_object('outcome', 'requires_manual_review', 'checkout_session_id', v_session.id);
  END IF;

  v_order_number := 'ORD-' || to_char(v_now, 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));

  INSERT INTO orders (
    store_id, store_location_id, order_number,
    customer_name, customer_phone, customer_email,
    fulfillment_method, shipping_address, city, department,
    delivery_neighborhood, delivery_reference, notes,
    source, payment_method,
    subtotal, shipping_amount, discount_amount, total_amount, currency,
    status, payment_status,
    whatsapp_consent, whatsapp_consent_at, whatsapp_consent_source, whatsapp_consent_version
  ) VALUES (
    v_session.store_id, v_session.store_location_id, v_order_number,
    v_session.customer_name, v_session.customer_phone, v_session.customer_email,
    v_session.fulfillment_method, v_session.shipping_address, v_session.city, v_session.department,
    v_session.delivery_neighborhood, v_session.delivery_reference, v_session.notes,
    'web', 'online',
    COALESCE(v_session.subtotal_amount, v_session.total_amount, 0), COALESCE(v_session.shipping_amount, 0), 0,
    v_session.total_amount, v_session.currency,
    'pending', 'paid',
    COALESCE(v_session.whatsapp_consent, false), v_session.whatsapp_consent_at,
    v_session.whatsapp_consent_source, v_session.whatsapp_consent_version
  )
  RETURNING id INTO v_order_id;

  v_snapshot_items := COALESCE(v_session.items_snapshot, '[]'::jsonb);

  FOR i IN 0 .. (jsonb_array_length(v_snapshot_items) - 1)
  LOOP
    v_item := v_snapshot_items -> i;

    INSERT INTO order_items (
      order_id, product_id, variant_id,
      product_name_snapshot, product_slug_snapshot, product_image_url_snapshot,
      variant_label_snapshot, variant_sku_snapshot,
      name, quantity, unit_price, total_price, customer_note
    ) VALUES (
      v_order_id,
      (v_item ->> 'product_id')::uuid,
      NULLIF(v_item ->> 'variant_id', '')::uuid,
      v_item ->> 'product_name', v_item ->> 'product_slug', v_item ->> 'product_image_url',
      v_item ->> 'variant_label', v_item ->> 'variant_sku',
      v_item ->> 'product_name',
      (v_item ->> 'quantity')::integer, (v_item ->> 'unit_price')::numeric, (v_item ->> 'total_price')::numeric,
      v_item ->> 'customization_notes'
    )
    RETURNING id INTO v_order_item_id;

    -- Customizations snapshot (already validated/priced at checkout
    -- time) — inserted verbatim, never re-validated here.
    v_customizations := COALESCE(v_item -> 'customizations', '[]'::jsonb);
    FOR j IN 0 .. (jsonb_array_length(v_customizations) - 1)
    LOOP
      v_custom := v_customizations -> j;
      INSERT INTO order_item_customizations (
        order_item_id, option_group_id, option_item_id, option_group_name, option_item_label, price_delta
      ) VALUES (
        v_order_item_id,
        (v_custom ->> 'option_group_id')::uuid, (v_custom ->> 'option_item_id')::uuid,
        v_custom ->> 'option_group_name', v_custom ->> 'option_item_label',
        (v_custom ->> 'price_delta')::numeric
      );
    END LOOP;

    -- Link this item's still-unlinked 'checkout_reserved' movement (stock
    -- was already decremented at checkout time — never decremented
    -- again here). LIMIT 1 FOR UPDATE SKIP LOCKED claims exactly one
    -- matching movement per item, so repeated product/variant combos
    -- across items (e.g. same variant with different modifiers) each
    -- claim a distinct movement. No match simply means this item never
    -- had stock tracked for it (track_inventory=false) — not an error.
    SELECT id INTO v_reservation_id
    FROM inventory_movements
    WHERE checkout_session_id = v_session.id
      AND movement_type = 'checkout_reserved'
      AND order_id IS NULL
      AND product_id = (v_item ->> 'product_id')::uuid
      AND variant_id IS NOT DISTINCT FROM NULLIF(v_item ->> 'variant_id', '')::uuid
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_reservation_id IS NOT NULL THEN
      UPDATE inventory_movements SET order_id = v_order_id, order_item_id = v_order_item_id
      WHERE id = v_reservation_id;
    END IF;
  END LOOP;

  SELECT id INTO v_provider_id FROM payment_providers WHERE code = 'wompi';

  -- ignoreDuplicates-equivalent: a retried webhook that somehow reached
  -- this far a second time (should be impossible given the lock above,
  -- kept as defense-in-depth) never creates a second transaction row.
  INSERT INTO payment_transactions (
    store_id, order_id, provider_id, provider_reference, provider_transaction_id,
    amount, amount_in_cents, currency, status, payment_method, checkout_url, raw_response, paid_at
  ) VALUES (
    v_session.store_id, v_order_id, v_provider_id, v_session.provider_reference, p_wompi_transaction_id,
    v_session.total_amount, v_session.amount_in_cents, v_session.currency, 'approved',
    p_payment_method_type, v_session.checkout_url, p_raw_event, v_now
  )
  ON CONFLICT (provider_reference) DO NOTHING;

  UPDATE checkout_sessions
  SET status = 'approved', order_id = v_order_id, wompi_transaction_id = p_wompi_transaction_id, updated_at = v_now
  WHERE id = v_session.id;

  RETURN jsonb_build_object('outcome', 'created', 'order_id', v_order_id, 'order_number', v_order_number);
END;
$$;

-- REVOKE ALL FROM PUBLIC already removes any implicit execute privilege
-- for every role (anon and authenticated included, since neither has an
-- explicit grant either). The two REVOKEs below are redundant with that
-- but kept anyway, spelled out explicitly rather than left implicit:
-- this function creates real orders and payment_transactions rows, and
-- its access control should be legible at a glance, not something a
-- reviewer has to reason out from PUBLIC's default ACL semantics. This
-- RPC is never called from the frontend — only wompi-webhook, using the
-- service_role Supabase client, calls it.
REVOKE ALL ON FUNCTION public.create_order_from_wompi_approved_session(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_from_wompi_approved_session(uuid, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_order_from_wompi_approved_session(uuid, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_from_wompi_approved_session(uuid, text, text, jsonb) TO service_role;

-- ============================================================
-- 10. apply_whatsapp_status_event — atomic, explicit state machine for
--     inbound Meta status webhooks (sent/delivered/read/failed).
--     Called once per status event by whatsapp-webhook, replacing the
--     previous plain-rank comparison that lived in TypeScript — moving
--     it here makes it: (a) lockable, via SELECT ... FOR UPDATE, so two
--     concurrent webhook deliveries for the same provider_message_id
--     serialize instead of racing on a read-then-write; and (b)
--     independently testable from SQL, without a live webhook call.
--
--     Transition rules (positive progression ladder: queued(0) <
--     sending(1) < sent(2) < delivered(3) < read(4)):
--       - A positive-ladder status is applied only if its rank is
--         strictly greater than the row's current rank. This makes
--         repeats a no-op, blocks any downgrade/out-of-order arrival
--         (e.g. a late 'sent' after 'read' already landed), and still
--         allows jumping straight to 'delivered' or 'read' even if
--         'sent' was never explicitly recorded first (its rank is just
--         higher than whatever the row is currently at).
--       - 'failed' is NOT part of that ladder — it is applied only when
--         the row's CURRENT status is 'queued', 'sending', or 'sent'.
--         Once a row is 'delivered' or 'read', a later 'failed' event is
--         a no-op — Meta's own status semantics (see
--         developers.facebook.com/documentation/business-messaging/
--         whatsapp/webhooks/reference/messages/status, consulted
--         2026-07) describe 'failed' as reported when the message could
--         not be delivered, which is mutually exclusive with a
--         'delivered'/'read' event already having occurred for the same
--         message id — no case of Meta reporting 'delivered' or 'read'
--         after a prior 'failed' for the same id is documented there or
--         anywhere else this project's audit could find. Recovering
--         FROM 'failed' back into the positive ladder is therefore
--         treated as terminal (a no-op) — the conservative default this
--         migration's own review explicitly allows when official
--         documentation of the opposite behavior can't be found. If
--         Meta's documentation is ever found to say otherwise, this is
--         the one function to change.
--       - Unknown/unrecognized status strings are ignored safely (no
--         match, no row touched, no error).
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_whatsapp_status_event(
  p_provider_message_id text,
  p_new_status           text,
  p_error_code           text DEFAULT NULL,
  p_error_message        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row            whatsapp_notifications%ROWTYPE;
  v_positive_rank  CONSTANT jsonb := '{"queued":0,"sending":1,"sent":2,"delivered":3,"read":4}'::jsonb;
  v_cur_rank       integer;
  v_new_rank       integer;
  v_apply          boolean := false;
  v_now            timestamptz := now();
BEGIN
  IF p_new_status NOT IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed') THEN
    RETURN jsonb_build_object('matched', false, 'applied', false, 'reason', 'unknown_status');
  END IF;

  SELECT * INTO v_row
  FROM whatsapp_notifications
  WHERE provider_message_id = p_provider_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false, 'applied', false, 'reason', 'not_found');
  END IF;

  IF p_new_status = 'failed' THEN
    v_apply := v_row.status IN ('queued', 'sending', 'sent');
  ELSIF v_row.status = 'failed' THEN
    v_apply := false;
  ELSE
    v_cur_rank := COALESCE((v_positive_rank ->> v_row.status)::integer, -1);
    v_new_rank := (v_positive_rank ->> p_new_status)::integer;
    v_apply := v_new_rank > v_cur_rank;
  END IF;

  IF NOT v_apply THEN
    RETURN jsonb_build_object('matched', true, 'applied', false, 'id', v_row.id, 'status', v_row.status);
  END IF;

  UPDATE whatsapp_notifications
  SET status               = p_new_status,
      sent_at              = CASE WHEN p_new_status = 'sent' THEN COALESCE(sent_at, v_now) ELSE sent_at END,
      delivered_at         = CASE WHEN p_new_status = 'delivered' THEN v_now ELSE delivered_at END,
      read_at              = CASE WHEN p_new_status = 'read' THEN v_now ELSE read_at END,
      failed_at            = CASE WHEN p_new_status = 'failed' THEN v_now ELSE failed_at END,
      is_permanent_failure = CASE WHEN p_new_status = 'failed' THEN true ELSE is_permanent_failure END,
      last_error_category  = CASE WHEN p_new_status = 'failed' THEN 'permanent' ELSE last_error_category END,
      last_error_code      = CASE WHEN p_new_status = 'failed' THEN p_error_code ELSE last_error_code END,
      last_error_message   = CASE WHEN p_new_status = 'failed' THEN p_error_message ELSE last_error_message END
  WHERE id = v_row.id;

  RETURN jsonb_build_object('matched', true, 'applied', true, 'id', v_row.id, 'status', p_new_status);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_whatsapp_status_event(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_whatsapp_status_event(text, text, text, text) TO service_role;
