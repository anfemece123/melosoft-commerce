-- ============================================================
-- Migration 033 — Safe public views for product images and hero slides
--
-- ROOT CAUSES FIXED:
--
--   1. attachPublicImages() queries product_images directly as anon.
--      anon has no GRANT SELECT on product_images → permission denied.
--      Fix: create public_product_images view (security_invoker=false).
--
--   2. getPublicProductBySlug() makes a second .from('products') query
--      for allows_special_instructions fields.
--      anon cannot query products directly without GRANT → permission denied.
--      Fix: add those columns to public_product_pages view.
--
--   3. getPublicStoreHeroSlides() queries store_hero_slides directly.
--      Even though anon has GRANT on store_hero_slides (migration 019),
--      the RLS policy subquery references stores where anon lacks GRANT
--      → permission denied for table stores.
--      Fix: create public_store_hero_slides view (security_invoker=false).
--
-- CONSTRAINT: no direct GRANT SELECT on base tables (stores, products,
-- product_images, store_hero_slides) to anon. Views only.
-- ============================================================

-- ── 1. public_product_images ─────────────────────────────────
--
-- Exposes only safe display columns from product_images.
-- security_invoker=false → view runs as owner (postgres), bypassing
-- the lack of anon GRANT on product_images.
-- Scoped to active stores so anon cannot enumerate images from
-- inactive stores.

CREATE VIEW public.public_product_images
  WITH (security_invoker = false)
AS
SELECT
  pi.product_id,
  pi.image_url,
  pi.alt_text,
  pi.sort_order,
  pi.is_primary
FROM public.product_images pi
JOIN public.products pr ON pr.id = pi.product_id
JOIN public.stores s    ON s.id  = pr.store_id
WHERE s.status = 'active';

GRANT SELECT ON public.public_product_images TO anon, authenticated;

-- ── 2. public_product_pages — add allows_special_instructions ─
--
-- Rebuilds the view (last defined in migration 025) adding the four
-- special-instructions columns so frontend can read them without a
-- second direct query to the products table.

DROP VIEW IF EXISTS public.public_product_pages;

CREATE VIEW public.public_product_pages AS
SELECT
  s.slug                               AS store_slug,
  s.name                               AS store_name,
  s.whatsapp_number                    AS store_whatsapp_number,
  s.logo_url,
  -- Theme
  t.mode                               AS theme_mode,
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
  pr.id                                AS product_id,
  pr.slug                              AS product_slug,
  pr.name                              AS product_name,
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
  pr.allows_special_instructions,
  pr.special_instructions_label,
  pr.special_instructions_placeholder,
  pr.special_instructions_max_length,
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

-- ── 3. public_store_hero_slides ───────────────────────────────
--
-- Exposes hero slide display columns for active stores.
-- security_invoker=false → view runs as owner (postgres).
-- This avoids the RLS subquery on stores running as anon, which
-- would fail because anon has no GRANT SELECT on stores.

CREATE VIEW public.public_store_hero_slides
  WITH (security_invoker = false)
AS
SELECT
  hs.id,
  hs.store_id,
  hs.sort_order,
  hs.is_active,
  hs.show_title,
  hs.show_subtitle,
  hs.show_cta,
  hs.show_main_image,
  hs.show_badge_image,
  hs.title,
  hs.subtitle,
  hs.cta_label,
  hs.main_image_url,
  hs.background_image_url,
  hs.badge_image_url
FROM public.store_hero_slides hs
JOIN public.stores s ON s.id = hs.store_id
WHERE s.status   = 'active'
  AND hs.is_active = true;

GRANT SELECT ON public.public_store_hero_slides TO anon, authenticated;
