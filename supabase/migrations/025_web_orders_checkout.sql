-- ============================================================
-- Migration 025 — Web order checkout flow (COD)
-- Adds tracking columns to orders/order_items, exposes delivery
-- options in product pages view, and creates the secure
-- create_store_order RPC for public checkout.
-- Depends on: 024
-- ============================================================

-- ── 1. New columns on orders ─────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number        text UNIQUE,
  ADD COLUMN IF NOT EXISTS source              text NOT NULL DEFAULT 'web'
    CONSTRAINT orders_source_valid
      CHECK (source IN ('web', 'whatsapp', 'admin')),
  ADD COLUMN IF NOT EXISTS payment_method      text NOT NULL DEFAULT 'cash_on_delivery'
    CONSTRAINT orders_payment_method_valid
      CHECK (payment_method IN ('cash_on_delivery', 'online')),
  ADD COLUMN IF NOT EXISTS fulfillment_method  text NOT NULL DEFAULT 'delivery'
    CONSTRAINT orders_fulfillment_method_valid
      CHECK (fulfillment_method IN ('delivery', 'pickup')),
  ADD COLUMN IF NOT EXISTS delivery_neighborhood text,
  ADD COLUMN IF NOT EXISTS delivery_reference    text,
  ADD COLUMN IF NOT EXISTS metadata              jsonb NOT NULL DEFAULT '{}';

-- ── 2. Snapshot columns on order_items ───────────────────────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name_snapshot text,
  ADD COLUMN IF NOT EXISTS product_slug_snapshot text;

-- ── 3. Recreate public_product_pages — expose delivery options ─

DROP VIEW IF EXISTS public.public_product_pages;

CREATE VIEW public.public_product_pages AS
SELECT
  s.slug                    AS store_slug,
  s.name                    AS store_name,
  s.whatsapp_number         AS store_whatsapp_number,
  s.logo_url,
  -- Theme
  t.mode                    AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  -- Commerce context (for CTA decisions + checkout)
  c.whatsapp_checkout_enabled,
  c.web_order_enabled,
  c.allows_pickup,
  c.allows_local_delivery,
  c.commerce_mode,
  c.catalog_type,
  -- Product fields
  pr.id                     AS product_id,
  pr.slug                   AS product_slug,
  pr.name                   AS product_name,
  pr.description,
  pr.short_description,
  pr.product_type,
  pr.regular_price,
  pr.compare_at_price,
  pr.sale_price,
  pr.stock,
  pr.is_featured,
  pr.is_available,
  pr.preparation_time_minutes,
  COALESCE(img.image_url, pr.main_image_url) AS main_image_url,
  pr.category
FROM public.products pr
JOIN public.stores s ON s.id = pr.store_id
LEFT JOIN public.store_theme_settings     t ON t.store_id = s.id
LEFT JOIN public.store_commerce_settings  c ON c.store_id = s.id
LEFT JOIN LATERAL (
  SELECT image_url
  FROM public.product_images
  WHERE product_id = pr.id
  ORDER BY is_primary DESC, sort_order ASC, created_at ASC
  LIMIT 1
) img ON true
WHERE pr.status       = 'active'
  AND pr.is_available = true
  AND s.status        = 'active';

GRANT SELECT ON public.public_product_pages TO anon, authenticated;

-- ── 4. Secure RPC: create_store_order ────────────────────────
-- SECURITY DEFINER — runs as the function owner (bypasses RLS).
-- Validates the store, checks web_order_enabled + cash_on_delivery_enabled,
-- validates each product belongs to the store, recalculates prices
-- server-side, and inserts orders + order_items atomically.

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
  p_items                 jsonb   DEFAULT '[]'::jsonb
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
  v_active_price        numeric;
  v_qty                 integer;
  v_line_total          numeric;
  v_customization_note  text;
  i                     integer;
BEGIN
  -- Validate store exists and is active
  SELECT s.id, s.status, scs.web_order_enabled, scs.cash_on_delivery_enabled
  INTO v_store_id, v_store_status, v_web_order_enabled, v_cod_enabled
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

  IF NOT v_cod_enabled THEN
    RAISE EXCEPTION 'COD_DISABLED';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS';
  END IF;

  -- Generate human-readable order number
  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-'
    || upper(substring(gen_random_uuid()::text, 1, 6));

  -- Insert order header (totals updated after items loop)
  INSERT INTO orders (
    store_id, order_number,
    customer_name, customer_phone, customer_email,
    fulfillment_method, shipping_address, city, department,
    delivery_neighborhood, delivery_reference, notes,
    source, payment_method,
    subtotal, shipping_amount, discount_amount, total_amount,
    currency, status, payment_status
  ) VALUES (
    v_store_id, v_order_number,
    p_customer_name, p_customer_phone, p_customer_email,
    p_fulfillment_method, p_shipping_address, p_city, p_department,
    p_delivery_neighborhood, p_delivery_reference, p_notes,
    'web', 'cash_on_delivery',
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

    -- Validate product belongs to this store and is active
    SELECT p.id, p.name, p.slug, COALESCE(p.sale_price, p.regular_price)
    INTO v_item_product_id, v_product_name, v_product_slug, v_active_price
    FROM products p
    WHERE p.id = v_item_product_id
      AND p.store_id = v_store_id
      AND p.status = 'active'
      AND p.is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_PRODUCT:%', v_item ->> 'product_id';
    END IF;

    v_line_total := v_active_price * v_qty;
    v_subtotal   := v_subtotal + v_line_total;

    INSERT INTO order_items (
      order_id, product_id,
      product_name_snapshot, product_slug_snapshot,
      name, quantity, unit_price, total_price,
      customer_note
    ) VALUES (
      v_order_id, v_item_product_id,
      v_product_name, v_product_slug,
      v_product_name, v_qty, v_active_price, v_line_total,
      v_customization_note
    );
  END LOOP;

  -- Update order totals with server-validated subtotal
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

-- Allow anon (public checkout) and authenticated (admin/staff) to call
GRANT EXECUTE ON FUNCTION public.create_store_order TO anon, authenticated;
