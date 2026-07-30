-- ============================================================
-- Migration 119 — Professional visual templates for Carta digital
-- ============================================================

ALTER TABLE public.store_carta_settings
  ADD COLUMN template_key text NOT NULL DEFAULT 'signature',
  ADD COLUMN navigation_mode text NOT NULL DEFAULT 'continuous',
  ADD COLUMN show_category_descriptions boolean NOT NULL DEFAULT true,
  ADD COLUMN category_order uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN product_order uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD CONSTRAINT store_carta_template_key_valid
    CHECK (template_key IN ('signature', 'gallery', 'minimal')),
  ADD CONSTRAINT store_carta_navigation_mode_valid
    CHECK (navigation_mode IN ('continuous', 'paginated'));

COMMENT ON COLUMN public.store_carta_settings.template_key IS
  'Visual layout selected by the owner: signature, gallery, or minimal.';
COMMENT ON COLUMN public.store_carta_settings.navigation_mode IS
  'Whether all categories flow continuously or customers browse one category page at a time.';
COMMENT ON COLUMN public.store_carta_settings.category_order IS
  'Carta-only category ordering; independent from the ecommerce catalog order.';
COMMENT ON COLUMN public.store_carta_settings.product_order IS
  'Carta-only product ordering; independent from the ecommerce catalog order.';

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
  pr.main_image_url,
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
WHERE s.status = 'active'
  AND cs.enabled = true;

COMMENT ON VIEW public.public_carta_pages IS
  'Public rows for the visual Carta digital, including its selected template and carta-specific ordering.';

GRANT SELECT ON public.public_carta_pages TO anon, authenticated;
