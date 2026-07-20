-- ============================================================
-- Migration 046 — Variants in checkout + public_product_pages
--
-- 1. order_items gains variant_id + label/sku snapshots.
-- 2. create_store_order's p_items elements accept an optional
--    "variant_id" key. Its function SIGNATURE is unchanged (the
--    field lives inside the existing p_items jsonb, not as a new
--    parameter), so this is a plain CREATE OR REPLACE — no need
--    to drop overloads like migration 030 had to. When variant_id
--    is absent/null, behavior is byte-for-byte identical to the
--    030 version (backward compatible for every existing product).
-- 3. public_product_pages gains has_variants/size_chart/variants/
--    variant_options, additively — facet_values is untouched.
-- ============================================================

-- ── 1. order_items — variant snapshot columns ────────────────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_label_snapshot text,
  ADD COLUMN IF NOT EXISTS variant_sku_snapshot text;

-- ── 2. create_store_order — variant-aware item resolution ────

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
    v_item_variant_id := NULLIF(v_item ->> 'variant_id', '')::uuid;
    v_qty             := (v_item ->> 'quantity')::integer;
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
    v_variant_sku   := NULL;
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

    -- Capture image at order time (snapshot) — variant image takes
    -- priority over the product's own general image.
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
    v_subtotal   := v_subtotal + v_line_total;

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

-- Explicit signature — unchanged from migration 030, so the existing
-- grant remains valid, but re-asserted here for clarity.
GRANT EXECUTE ON FUNCTION public.create_store_order(
  text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid, text
) TO anon, authenticated;

-- ── 3. public_product_pages — additive variant columns ────────
-- Based verbatim on migration 041's definition (adds track_inventory);
-- facet_values / collections computation is untouched.

DROP VIEW IF EXISTS public.public_product_pages;

CREATE VIEW public.public_product_pages AS
SELECT
  s.slug                                    AS store_slug,
  s.name                                    AS store_name,
  s.whatsapp_number                         AS store_whatsapp_number,
  s.logo_url,
  t.mode                                    AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  c.whatsapp_checkout_enabled,
  c.web_order_enabled,
  c.allows_pickup,
  c.allows_local_delivery,
  c.commerce_mode,
  c.catalog_type,
  pr.id                                     AS product_id,
  pr.slug                                   AS product_slug,
  pr.name                                   AS product_name,
  pr.description,
  pr.short_description,
  pr.description_sections,
  pr.product_type,
  pr.regular_price,
  pr.compare_at_price,
  pr.sale_price,
  pr.stock,
  pr.track_inventory,
  pr.is_featured,
  pr.is_available,
  pr.preparation_time_minutes,
  pr.allows_special_instructions,
  pr.special_instructions_label,
  pr.special_instructions_placeholder,
  pr.special_instructions_max_length,
  COALESCE(img.image_url, pr.main_image_url) AS main_image_url,
  pr.category,
  pr.category_id,
  cat.name                                  AS category_name,
  cat.slug                                  AS category_slug,
  cat.parent_id                             AS category_parent_id,
  COALESCE(collections.items, '[]'::jsonb)  AS collections,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'facet_id',    pfv.facet_id,
          'facet_name',  pfv.facet_name,
          'facet_slug',  pfv.facet_slug,
          'input_type',  pfv.input_type,
          'value_id',    pfv.facet_value_id,
          'value',       pfv.value,
          'value_slug',  pfv.value_slug
        )
        ORDER BY pfv.facet_name, pfv.value
      )
      FROM public.public_product_facet_values pfv
      WHERE pfv.product_id = pr.id
    ),
    '[]'::jsonb
  )                                          AS facet_values,
  pr.has_variants,
  sc.size_chart,
  COALESCE(voptions.items, '[]'::jsonb)     AS variant_options,
  COALESCE(variants.items, '[]'::jsonb)     AS variants
FROM public.products pr
JOIN public.stores s
  ON s.id = pr.store_id
LEFT JOIN public.store_theme_settings t
  ON t.store_id = s.id
LEFT JOIN public.store_commerce_settings c
  ON c.store_id = s.id
LEFT JOIN public.store_product_categories cat
  ON cat.id = pr.category_id
LEFT JOIN LATERAL (
  SELECT pi.image_url
  FROM public.product_images pi
  WHERE pi.product_id = pr.id AND pi.variant_id IS NULL
  ORDER BY pi.is_primary DESC, pi.sort_order ASC
  LIMIT 1
) img ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',   col.id,
      'name', col.name,
      'slug', col.slug
    )
    ORDER BY col.sort_order ASC, col.name ASC, col.id ASC
  ) AS items
  FROM public.product_collections pc
  JOIN public.store_product_collections col
    ON col.id = pc.collection_id
  WHERE pc.product_id = pr.id
    AND col.is_active = true
) collections ON true
LEFT JOIN LATERAL (
  SELECT jsonb_build_object(
    'id',        psc.id,
    'name',      psc.name,
    'chartType', psc.chart_type,
    'unit',      psc.unit,
    'content',   psc.content
  ) AS size_chart
  FROM public.product_size_charts psc
  WHERE psc.id = pr.size_chart_id AND psc.is_active = true
) sc ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',                vo.id,
      'name',              vo.name,
      'type',              vo.type,
      'useAsPublicFilter', vo.use_as_public_filter,
      'sortOrder',         vo.sort_order,
      'values', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',              vov.id,
            'value',           vov.value,
            'normalizedValue', vov.normalized_value,
            'colorHex',        vov.color_hex
          ) ORDER BY vov.sort_order, vov.value
        )
        FROM public.product_variant_option_values vov
        WHERE vov.option_id = vo.id AND vov.is_active = true
      ), '[]'::jsonb)
    ) ORDER BY vo.sort_order, vo.name
  ) AS items
  FROM public.product_variant_options vo
  WHERE vo.product_id = pr.id AND vo.is_active = true
) voptions ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',             pv.id,
      'sku',            pv.sku,
      'price',          pv.price,
      'compareAtPrice', pv.compare_at_price,
      'stockQuantity',  pv.stock_quantity,
      'stockPolicy',    pv.stock_policy,
      'isDefault',      pv.is_default,
      'imageUrl', COALESCE(
        (SELECT vi.image_url FROM public.product_images vi
         WHERE vi.variant_id = pv.id
         ORDER BY vi.is_primary DESC, vi.sort_order ASC
         LIMIT 1),
        img.image_url,
        pr.main_image_url
      ),
      'optionValues', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'optionId',   psv.option_id,
            'optionName', vo2.name,
            'valueId',    psv.option_value_id,
            'value',      vov2.value
          ) ORDER BY vo2.sort_order
        )
        FROM public.product_variant_selected_values psv
        JOIN public.product_variant_options vo2 ON vo2.id = psv.option_id
        JOIN public.product_variant_option_values vov2 ON vov2.id = psv.option_value_id
        WHERE psv.variant_id = pv.id
      ), '[]'::jsonb)
    ) ORDER BY pv.position, pv.created_at
  ) AS items
  FROM public.product_variants pv
  WHERE pv.product_id = pr.id AND pv.status = 'active'
) variants ON true
WHERE pr.status       = 'active'
  AND pr.is_available = true
  AND s.status        = 'active';

GRANT SELECT ON public.public_product_pages TO anon, authenticated;
