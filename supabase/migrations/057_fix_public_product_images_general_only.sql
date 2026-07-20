-- ============================================================
-- Migration 057 — public_product_images must be general-only
--
-- Bug found while validating cards -> PDP gallery priority: this
-- view (migration 033, predates variants) selects EVERY row of
-- product_images for a product with no filter. attachPublicImages()
-- in productsService.ts uses it to populate `product.images` — the
-- TRUE general-gallery fallback used by resolveVariantGalleryImages
-- (tier 3) and by buildCatalogItems' image fallback when a visual
-- value has no photo of its own.
--
-- Since product_images gained variant_id (044) and option_value_id
-- (047), this view was never updated to exclude them — so
-- product.images ended up polluted with every color's photos and
-- every exact-variant override mixed in with the real general
-- gallery. A customer landing on the PDP with no color chosen yet
-- (or a value missing its own photo) could see another color's
-- photo instead of the actual general gallery.
--
-- Fix: general images only (both null), matching the same filter
-- public_product_pages' own `img` lateral already uses.
-- ============================================================

CREATE OR REPLACE VIEW public.public_product_images
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
WHERE s.status = 'active'
  AND pi.variant_id IS NULL
  AND pi.option_value_id IS NULL;

GRANT SELECT ON public.public_product_images TO anon, authenticated;
