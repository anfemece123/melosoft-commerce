-- ============================================================
-- Migration 028 — Add product_image_url_snapshot to order_items
-- Updates create_store_order to capture product image at order time.
-- Depends on: 026
-- ============================================================

-- ── 1. New column ─────────────────────────────────────────────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_image_url_snapshot text;

-- ── 2. Index for orders admin queries ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_store_date
  ON public.orders (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_store_status_date
  ON public.orders (store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

-- ── 3. Update create_store_order to capture image snapshot ────
-- Replaces the version from migration 026 (same signature, adds image capture)

CREATE OR REPLACE FUNCTION public.create_store_order(
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
  p_store_location_id     uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id            uuid;
  v_store_status        text;
  v_web_order_enabled   boolean;
  v_cod_enabled         boolean;
  v_order_id            uuid;
  v_order_number        text;
  v_subtotal            numeric := 0;
  v_item                jsonb;
  v_item_product_id     uuid;
  v_product_name        text;
  v_product_slug        text;
  v_product_main_image  text;
  v_active_price        numeric;
  v_qty                 integer;
  v_line_total          numeric;
  v_customization_note  text;
  v_image_url           text;
  i                     integer;
BEGIN
  SELECT s.id, s.status, scs.web_order_enabled, scs.cash_on_delivery_enabled
  INTO v_store_id, v_store_status, v_web_order_enabled, v_cod_enabled
  FROM stores s
  JOIN store_commerce_settings scs ON scs.store_id = s.id
  WHERE s.slug = p_store_slug;

  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND'; END IF;
  IF v_store_status != 'active' THEN RAISE EXCEPTION 'STORE_INACTIVE'; END IF;
  IF NOT v_web_order_enabled THEN RAISE EXCEPTION 'WEB_ORDERS_DISABLED'; END IF;
  IF NOT v_cod_enabled THEN RAISE EXCEPTION 'COD_DISABLED'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'NO_ITEMS'; END IF;

  IF p_store_location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM store_locations
      WHERE id = p_store_location_id AND store_id = v_store_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'INVALID_LOCATION';
    END IF;
  END IF;

  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-'
    || upper(substring(gen_random_uuid()::text, 1, 6));

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
    'web', 'cash_on_delivery',
    0, 0, 0, 0,
    'COP', 'pending', 'pending'
  )
  RETURNING id INTO v_order_id;

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

    -- Capture primary product image at order time
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
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'total_amount', v_subtotal,
    'status',       'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_store_order(
  text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid
) TO anon, authenticated;
