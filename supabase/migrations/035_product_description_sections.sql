-- ============================================================
-- Migration 035 — Advanced product description sections
--
-- Adds a description_sections jsonb column to products so
-- owners can create structured content blocks (Incluye,
-- Ingredientes, Especificaciones, etc.) per product.
--
-- The public_product_pages view is rebuilt to expose the new
-- column to anon/authenticated. Security pattern is unchanged:
-- no direct GRANT on base tables, views only, security_invoker=false.
-- ============================================================

-- ── 1. Add column ────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description_sections jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.description_sections IS
  'Array of structured content blocks: [{id, title, icon, content, sortOrder, isVisible}]. '
  'Null and empty array both mean "no advanced sections".';

-- ── 2. Rebuild public_product_pages ──────────────────────────
--
-- Mirrors migration 033 exactly, adding pr.description_sections.
-- security_invoker=false kept unchanged.

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
  -- Commerce context
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
  pr.description_sections,
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
