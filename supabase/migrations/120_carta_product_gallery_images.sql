-- ============================================================
-- Migration 120 — Use the real product gallery in Carta digital
-- ============================================================
-- `product_images` is the source of truth used by the ecommerce. Carta
-- previously read only products.main_image_url, which can be null for
-- products whose image was uploaded to the gallery. Rebuild the view with
-- the same primary-image fallback used by public_product_pages.

DROP VIEW public.public_carta_pages;

CREATE VIEW public.public_carta_pages
  WITH (security_invoker = false)
AS
SELECT
  s.slug                                       AS store_slug,
  s.name                                       AS store_name,
  s.logo_url,
  s.currency,
  cs.title,
  cs.subtitle,
  cs.template_key                              AS carta_template_key,
  cs.navigation_mode                          AS carta_navigation_mode,
  cs.show_category_descriptions,
  t.mode                                       AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  pr.id                                        AS product_id,
  pr.name                                      AS product_name,
  pr.short_description,
  COALESCE(img.image_url, pr.main_image_url)   AS main_image_url,
  COALESCE(pr.carta_price, pr.regular_price)   AS effective_price,
  CASE
    WHEN pr.id = ANY(cs.product_order)
      THEN array_position(cs.product_order, pr.id) - 1
    ELSE 10000 + pr.sort_order
  END                                          AS product_sort_order,
  cat.id                                       AS category_id,
  cat.name                                     AS category_name,
  cat.slug                                     AS category_slug,
  cat.description                              AS category_description,
  cat.image_url                                AS category_image_url,
  CASE
    WHEN cat.id = ANY(cs.category_order)
      THEN array_position(cs.category_order, cat.id) - 1
    ELSE 10000 + COALESCE(cat.sort_order, 0)
  END                                          AS category_sort_order
FROM public.store_carta_settings cs
JOIN public.stores s
  ON s.id = cs.store_id
LEFT JOIN public.store_theme_settings t
  ON t.store_id = s.id
JOIN public.products pr
  ON pr.store_id = s.id
  AND pr.show_in_carta = true
  AND pr.status = 'active'
LEFT JOIN public.store_product_categories cat
  ON cat.id = pr.category_id
LEFT JOIN LATERAL (
  SELECT pi.image_url
  FROM public.product_images pi
  WHERE pi.product_id = pr.id
    AND pi.variant_id IS NULL
    AND pi.option_value_id IS NULL
  ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
  LIMIT 1
) img ON true
WHERE s.status = 'active'
  AND cs.enabled = true;

COMMENT ON VIEW public.public_carta_pages IS
  'Public Carta digital rows using the selected visual template, carta-only ordering, and each product gallery primary image.';

GRANT SELECT ON public.public_carta_pages TO anon, authenticated;
