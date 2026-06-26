-- ============================================================
-- Migration 024 — Add web_order_enabled to store_commerce_settings
-- Separates web-based orders (cart + COD) from online payment (Wompi).
-- Updates public views to expose web_order_enabled and cash_on_delivery_enabled.
-- Depends on: 022, 023
-- ============================================================

-- 1. Add web_order_enabled column
ALTER TABLE public.store_commerce_settings
  ADD COLUMN IF NOT EXISTS web_order_enabled boolean NOT NULL DEFAULT false;

-- 2. Update default_order_method constraint to allow 'web_order'
ALTER TABLE public.store_commerce_settings
  DROP CONSTRAINT IF EXISTS scs_default_order_method_valid;

ALTER TABLE public.store_commerce_settings
  ADD CONSTRAINT scs_default_order_method_valid CHECK (
    default_order_method IN ('whatsapp', 'web_order', 'online_checkout')
  );

-- 3. Recreate public_store_pages adding web_order_enabled and cash_on_delivery_enabled
DROP VIEW IF EXISTS public.public_store_pages;

CREATE VIEW public.public_store_pages
  WITH (security_invoker = true)
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
  -- Theme
  t.mode                            AS theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  -- Policies
  p.shipping_policy,
  p.returns_policy,
  p.warranty_policy,
  p.privacy_policy,
  p.terms_and_conditions,
  -- Location (only if public)
  CASE WHEN l.is_public THEN l.address_line   ELSE NULL END  AS location_address,
  CASE WHEN l.is_public THEN l.neighborhood   ELSE NULL END  AS location_neighborhood,
  CASE WHEN l.is_public THEN l.city           ELSE NULL END  AS location_city,
  CASE WHEN l.is_public THEN l.department     ELSE NULL END  AS location_department,
  CASE WHEN l.is_public THEN l.country        ELSE NULL END  AS location_country,
  CASE WHEN l.is_public THEN l.latitude       ELSE NULL END  AS location_latitude,
  CASE WHEN l.is_public THEN l.longitude      ELSE NULL END  AS location_longitude,
  -- Commerce settings
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
  c.shipping_notes
FROM public.stores s
LEFT JOIN public.store_theme_settings    t ON t.store_id = s.id
LEFT JOIN public.store_policies          p ON p.store_id = s.id
LEFT JOIN public.store_locations         l ON l.store_id = s.id
LEFT JOIN public.store_commerce_settings c ON c.store_id = s.id
WHERE s.status = 'active';

GRANT SELECT ON public.public_store_pages TO anon, authenticated;


-- 4. Recreate public_product_pages adding web_order_enabled
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
  -- Commerce context for CTA decisions
  c.whatsapp_checkout_enabled,
  c.web_order_enabled,
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
