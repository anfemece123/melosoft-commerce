ALTER TABLE public.store_commerce_settings
  ADD COLUMN IF NOT EXISTS local_delivery_base_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS local_delivery_free_from numeric(12,2),
  ADD COLUMN IF NOT EXISTS national_shipping_base_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS national_shipping_free_from numeric(12,2);

ALTER TABLE public.store_commerce_settings
  DROP CONSTRAINT IF EXISTS store_commerce_settings_local_delivery_base_fee_check,
  DROP CONSTRAINT IF EXISTS store_commerce_settings_local_delivery_free_from_check,
  DROP CONSTRAINT IF EXISTS store_commerce_settings_national_shipping_base_fee_check,
  DROP CONSTRAINT IF EXISTS store_commerce_settings_national_shipping_free_from_check;

ALTER TABLE public.store_commerce_settings
  ADD CONSTRAINT store_commerce_settings_local_delivery_base_fee_check CHECK (local_delivery_base_fee >= 0),
  ADD CONSTRAINT store_commerce_settings_local_delivery_free_from_check CHECK (local_delivery_free_from IS NULL OR local_delivery_free_from >= 0),
  ADD CONSTRAINT store_commerce_settings_national_shipping_base_fee_check CHECK (national_shipping_base_fee >= 0),
  ADD CONSTRAINT store_commerce_settings_national_shipping_free_from_check CHECK (national_shipping_free_from IS NULL OR national_shipping_free_from >= 0);

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount numeric NOT NULL DEFAULT 0;

DROP VIEW IF EXISTS public.public_store_pages;

CREATE VIEW public.public_store_pages
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
  p.shipping_policy,
  p.returns_policy,
  p.warranty_policy,
  p.privacy_policy,
  p.terms_and_conditions,
  CASE WHEN l.is_public THEN l.address_line   ELSE NULL END  AS location_address,
  CASE WHEN l.is_public THEN l.neighborhood   ELSE NULL END  AS location_neighborhood,
  CASE WHEN l.is_public THEN l.city           ELSE NULL END  AS location_city,
  CASE WHEN l.is_public THEN l.department     ELSE NULL END  AS location_department,
  CASE WHEN l.is_public THEN l.country        ELSE NULL END  AS location_country,
  CASE WHEN l.is_public THEN l.latitude       ELSE NULL END  AS location_latitude,
  CASE WHEN l.is_public THEN l.longitude      ELSE NULL END  AS location_longitude,
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
  c.national_shipping_free_from
FROM public.stores s
LEFT JOIN public.store_theme_settings    t ON t.store_id = s.id
LEFT JOIN public.store_policies          p ON p.store_id = s.id
LEFT JOIN LATERAL (
  SELECT *
  FROM public.store_locations
  WHERE store_id = s.id AND is_primary = true AND is_active = true
  LIMIT 1
) l ON true
LEFT JOIN public.store_commerce_settings c ON c.store_id = s.id
WHERE s.status = 'active';

GRANT SELECT ON public.public_store_pages TO anon, authenticated;

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
  v_variant_price           numeric;
  v_variant_sku             text;
  v_variant_label           text;
  v_active_price            numeric;
  v_qty                     integer;
  v_line_total              numeric;
  v_customization_note      text;
  v_image_url               text;
  i                         integer;
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

  FOR i IN 0 .. (jsonb_array_length(p_items) - 1)
  LOOP
    v_item := p_items -> i;
    v_item_product_id := (v_item ->> 'product_id')::uuid;
    v_item_variant_id := NULLIF(v_item ->> 'variant_id', '')::uuid;
    v_qty := (v_item ->> 'quantity')::integer;
    v_customization_note := v_item ->> 'customization_notes';

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
    );
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
