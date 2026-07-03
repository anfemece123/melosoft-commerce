-- ============================================================
-- Migration 030 — Wompi Checkout Integration
-- Adds events_secret to store_payment_settings,
-- enriches payment_transactions, updates create_store_order
-- to support online payment method.
-- Depends on: 025, 026, 028
--
-- NOTE: public_store_pages is NOT recreated here.
-- Migration 026 already exposes cash_on_delivery_enabled,
-- online_checkout_enabled, and web_order_enabled in that view.
-- ============================================================

-- ── 1. Add events_secret to store_payment_settings ───────────
-- Used to validate Wompi webhook events server-side.
-- Never exposed to the frontend — only read by Edge Functions
-- via the service_role key which bypasses RLS.

ALTER TABLE public.store_payment_settings
  ADD COLUMN IF NOT EXISTS events_secret text;

-- ── 2. Enrich payment_transactions ───────────────────────────
-- checkout_url: the Wompi web checkout URL given to the customer.
-- amount_in_cents: integer cents sent to Wompi (authoritative).
-- paid_at: timestamp when payment was confirmed as approved.

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS checkout_url    text,
  ADD COLUMN IF NOT EXISTS amount_in_cents integer,
  ADD COLUMN IF NOT EXISTS paid_at         timestamptz;

-- Unique constraint on provider_reference for idempotent upserts.
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_provider_reference_unique;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_provider_reference_unique
    UNIQUE (provider_reference);

-- ── 3. Drop all existing signatures of create_store_order ────
-- Previous migrations (025, 026, 028) left a 13-param version.
-- This migration adds p_payment_method as a 14th param, which
-- would create an overload and make any GRANT without explicit
-- signature fail with SQLSTATE 42725.
-- We drop every overload first, then create the single final version.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_store_order'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', fn.signature);
  END LOOP;
END $$;

-- ── 4. Create the single final version of create_store_order ─
-- Incorporates everything from 026 (location validation),
-- 028 (product_image_url_snapshot), and new Wompi support
-- (p_payment_method, online checkout validation).

CREATE FUNCTION public.create_store_order(
  p_store_slug            text,
  p_customer_name         text,
  p_customer_phone        text,
  p_customer_email        text    DEFAULT NULL,
  p_fulfillment_method    text    DEFAULT 'delivery',
  p_shipping_address      text    DEFAULT NULL,
  p_city                  text    DEFAULT NULL,
  p_department            text    DEFAULT NULL,
  p_delivery_neighborhood text    DEFAULT NULL,
  p_delivery_reference    text    DEFAULT NULL,
  p_notes                 text    DEFAULT NULL,
  p_items                 jsonb   DEFAULT '[]'::jsonb,
  p_store_location_id     uuid    DEFAULT NULL,
  p_payment_method        text    DEFAULT 'cash_on_delivery'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id                uuid;
  v_store_status            text;
  v_web_order_enabled       boolean;
  v_cod_enabled             boolean;
  v_online_checkout_enabled boolean;
  v_order_id                uuid;
  v_order_number            text;
  v_subtotal                numeric := 0;
  v_item                    jsonb;
  v_item_product_id         uuid;
  v_product_name            text;
  v_product_slug            text;
  v_product_main_image      text;
  v_active_price            numeric;
  v_qty                     integer;
  v_line_total              numeric;
  v_customization_note      text;
  v_image_url               text;
  i                         integer;
BEGIN
  -- Validate store exists and is active
  SELECT s.id, s.status,
         scs.web_order_enabled,
         scs.cash_on_delivery_enabled,
         scs.online_checkout_enabled
  INTO v_store_id, v_store_status,
       v_web_order_enabled,
       v_cod_enabled,
       v_online_checkout_enabled
  FROM stores s
  JOIN store_commerce_settings scs ON scs.store_id = s.id
  WHERE s.slug = p_store_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORE_NOT_FOUND';
  END IF;

  IF v_store_status != 'active' THEN
    RAISE EXCEPTION 'STORE_INACTIVE';
  END IF;

  IF NOT v_web_order_enabled THEN
    RAISE EXCEPTION 'WEB_ORDERS_DISABLED';
  END IF;

  -- Validate payment method
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

  -- Validate location belongs to this store (if provided)
  IF p_store_location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM store_locations
      WHERE id = p_store_location_id AND store_id = v_store_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'INVALID_LOCATION';
    END IF;
  END IF;

  -- Generate human-readable order number
  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-'
    || upper(substring(gen_random_uuid()::text, 1, 6));

  -- Insert order header
  INSERT INTO orders (
    store_id, order_number, store_location_id,
    customer_name, customer_phone, customer_email,
    fulfillment_method, shipping_address, city, department,
    delivery_neighborhood, delivery_reference, notes,
    source, payment_method,
    subtotal, shipping_amount, discount_amount, total_amount,
    currency, status, payment_status
  ) VALUES (
    v_store_id, v_order_number, p_store_location_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_fulfillment_method, p_shipping_address, p_city, p_department,
    p_delivery_neighborhood, p_delivery_reference, p_notes,
    'web', p_payment_method,
    0, 0, 0, 0,
    'COP', 'pending', 'pending'
  )
  RETURNING id INTO v_order_id;

  -- Process items with server-side price validation
  FOR i IN 0 .. (jsonb_array_length(p_items) - 1)
  LOOP
    v_item            := p_items -> i;
    v_item_product_id := (v_item ->> 'product_id')::uuid;
    v_qty             := (v_item ->> 'quantity')::integer;
    v_customization_note := v_item ->> 'customization_notes';

    SELECT p.id, p.name, p.slug, COALESCE(p.sale_price, p.regular_price), p.main_image_url
    INTO v_item_product_id, v_product_name, v_product_slug, v_active_price, v_product_main_image
    FROM products p
    WHERE p.id = v_item_product_id
      AND p.store_id = v_store_id
      AND p.status = 'active'
      AND p.is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_PRODUCT:%', v_item ->> 'product_id';
    END IF;

    -- Capture primary product image at order time (snapshot)
    SELECT COALESCE(
      (SELECT pi.image_url FROM product_images pi
       WHERE pi.product_id = v_item_product_id
       ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
       LIMIT 1),
      v_product_main_image
    ) INTO v_image_url;

    v_line_total := v_active_price * v_qty;
    v_subtotal   := v_subtotal + v_line_total;

    INSERT INTO order_items (
      order_id, product_id,
      product_name_snapshot, product_slug_snapshot, product_image_url_snapshot,
      name, quantity, unit_price, total_price,
      customer_note
    ) VALUES (
      v_order_id, v_item_product_id,
      v_product_name, v_product_slug, v_image_url,
      v_product_name, v_qty, v_active_price, v_line_total,
      v_customization_note
    );
  END LOOP;

  UPDATE orders
  SET subtotal = v_subtotal, total_amount = v_subtotal
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id',       v_order_id,
    'order_number',   v_order_number,
    'total_amount',   v_subtotal,
    'payment_method', p_payment_method,
    'status',         'pending'
  );
END;
$$;

-- Explicit signature to avoid SQLSTATE 42725 if overloads ever reappear.
GRANT EXECUTE ON FUNCTION public.create_store_order(
  text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid, text
) TO anon, authenticated;

-- ── 5. Grants for new payment columns ────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.store_payment_settings TO authenticated;
GRANT ALL PRIVILEGES ON public.store_payment_settings TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
GRANT ALL PRIVILEGES ON public.payment_transactions TO service_role;
