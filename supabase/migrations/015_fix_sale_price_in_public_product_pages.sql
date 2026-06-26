-- ============================================================
-- Migration 015 — Restore sale_price in public_product_pages
--
-- Migration 014 accidentally omitted p.sale_price when it
-- recreated the view. This migration restores it while
-- keeping the LATERAL join for main_image_url from 014.
-- ============================================================

DROP VIEW IF EXISTS public_product_pages;

CREATE VIEW public_product_pages AS
SELECT
  s.slug              AS store_slug,
  s.name              AS store_name,
  s.whatsapp_number   AS store_whatsapp_number,
  s.logo_url,
  t.mode              AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  p.id                AS product_id,
  p.slug              AS product_slug,
  p.name              AS product_name,
  p.description,
  p.short_description,
  p.product_type,
  p.regular_price,
  p.compare_at_price,
  p.sale_price,
  p.stock,
  p.is_featured,
  p.is_available,
  p.preparation_time_minutes,
  COALESCE(img.image_url, p.main_image_url) AS main_image_url,
  p.category
FROM products p
JOIN stores s ON s.id = p.store_id
LEFT JOIN store_theme_settings t ON t.store_id = s.id
LEFT JOIN LATERAL (
  SELECT image_url
  FROM product_images
  WHERE product_id = p.id
  ORDER BY
    is_primary DESC,
    sort_order  ASC,
    created_at  ASC
  LIMIT 1
) img ON true
WHERE p.status      = 'active'
  AND p.is_available = true
  AND s.status      = 'active';

GRANT SELECT ON public_product_pages TO anon, authenticated;
