-- ============================================================
-- Migration 041 — Expose products.track_inventory publicly
--
-- The public storefront cart already supports soft stock validation
-- (trackInventory/stock/isAvailable on CartItem, Fase 1) but had no
-- way to know whether a product tracks inventory at all, because
-- public_product_pages (rebuilt in 040) never selected
-- products.track_inventory. This migration only adds that one
-- column to the view — every other column, join, and filter is
-- carried over unchanged from 040.
-- ============================================================

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
  ) AS facet_values
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
  WHERE pi.product_id = pr.id
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
WHERE s.status = 'active'
  AND pr.status = 'active'
  AND pr.is_available = true;

GRANT SELECT ON public.public_product_pages TO anon, authenticated;
