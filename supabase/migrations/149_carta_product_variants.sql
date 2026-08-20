-- ============================================================
-- Migration 149 — Show all product variants in the digital menu
--
-- The Carta view previously exposed one effective product price only. This
-- keeps the same one-row-per-product contract and adds a safe JSON list of
-- every active sales variant, including its label, price and availability.
-- ============================================================

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
  cs.navigation_mode                           AS carta_navigation_mode,
  cs.show_category_descriptions,
  cs.cover_layout,
  cs.cover_product_ids,
  cs.cover_image_url,
  cs.cover_background_image_url,
  cs.show_logo,
  cs.show_product_descriptions,
  cs.category_heading_alignment,
  cs.product_image_mode,
  cs.category_image_modes,
  cs.category_image_selections,
  cs.category_image_positions,
  cs.category_image_sizes,
  cs.product_image_positions,
  t.mode                                        AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  pr.id                                         AS product_id,
  pr.name                                       AS product_name,
  pr.short_description,
  COALESCE(img.image_url, pr.main_image_url)    AS main_image_url,
  COALESCE(pr.carta_price, pr.regular_price)    AS effective_price,
  COALESCE(variants.items, '[]'::jsonb)         AS variants,
  CASE
    WHEN pr.id = ANY(cs.product_order)
      THEN array_position(cs.product_order, pr.id) - 1
    ELSE 10000 + pr.sort_order
  END                                           AS product_sort_order,
  cat.id                                        AS category_id,
  cat.name                                      AS category_name,
  cat.slug                                      AS category_slug,
  cat.description                               AS category_description,
  cat.image_url                                 AS category_image_url,
  CASE
    WHEN cat.id = ANY(cs.category_order)
      THEN array_position(cs.category_order, cat.id) - 1
    ELSE 10000 + COALESCE(cat.sort_order, 0)
  END                                           AS category_sort_order
FROM public.store_carta_settings cs
JOIN public.stores s ON s.id = cs.store_id
LEFT JOIN public.store_theme_settings t ON t.store_id = s.id
JOIN public.products pr
  ON pr.store_id = s.id
  AND pr.show_in_carta = true
  AND pr.status = 'active'
LEFT JOIN public.store_product_categories cat ON cat.id = pr.category_id
LEFT JOIN LATERAL (
  SELECT pi.image_url
  FROM public.product_images pi
  WHERE pi.product_id = pr.id
    AND pi.variant_id IS NULL
    AND pi.option_value_id IS NULL
  ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
  LIMIT 1
) img ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pv.id,
      'sku', pv.sku,
      'price', COALESCE(pv.price, pr.carta_price, pr.regular_price),
      'compareAtPrice', pv.compare_at_price,
      'stockQuantity', pv.stock_quantity,
      'stockPolicy', pv.stock_policy,
      'isDefault', pv.is_default,
      'isAvailable', (pv.stock_policy = 'allow_backorder' OR pv.stock_quantity > 0),
      'imageUrl', (
        SELECT vi.image_url
        FROM public.product_images vi
        WHERE vi.variant_id = pv.id
        ORDER BY vi.is_primary DESC, vi.sort_order ASC, vi.created_at ASC
        LIMIT 1
      ),
      'optionValues', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'optionId', psv.option_id,
            'optionName', vo.name,
            'valueId', psv.option_value_id,
            'value', vov.value
          ) ORDER BY vo.sort_order, vov.sort_order, vov.value
        )
        FROM public.product_variant_selected_values psv
        JOIN public.product_variant_options vo
          ON vo.id = psv.option_id
          AND vo.product_id = pr.id
          AND vo.is_active = true
        JOIN public.product_variant_option_values vov
          ON vov.id = psv.option_value_id
          AND vov.option_id = vo.id
          AND vov.is_active = true
        WHERE psv.variant_id = pv.id
      ), '[]'::jsonb)
    ) ORDER BY pv.position, pv.created_at, pv.id
  ) AS items
  FROM public.product_variants pv
  WHERE pv.product_id = pr.id
    AND pv.status = 'active'
) variants ON true
WHERE s.status = 'active'
  AND cs.enabled = true;

GRANT SELECT ON public.public_carta_pages TO anon, authenticated;

COMMENT ON VIEW public.public_carta_pages IS
  'Public Carta rows with all active sales variants per product, including each variant label, price and availability.';
