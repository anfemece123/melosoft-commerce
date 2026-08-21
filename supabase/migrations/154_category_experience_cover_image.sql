-- 154 — Optional cover image for each category experience.
-- The cover is shown at the top of the public catalog only while that
-- category experience is active. It never changes the company's main hero.

ALTER TABLE public.store_category_experiences
  ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMENT ON COLUMN public.store_category_experiences.cover_image_url IS
  'Optional wide cover image shown at the top of the public catalog for this category experience.';

DROP VIEW IF EXISTS public.public_store_category_experiences;
CREATE VIEW public.public_store_category_experiences
  WITH (security_invoker = false)
AS
SELECT
  e.id,
  e.store_id,
  s.slug AS store_slug,
  e.category_id,
  c.name AS category_name,
  c.slug AS category_slug,
  e.display_name,
  e.description,
  e.logo_url,
  e.cover_image_url,
  e.theme_mode,
  e.primary_color,
  e.secondary_color,
  e.accent_color,
  e.background_color,
  e.text_color,
  e.button_radius,
  e.sort_order
FROM public.store_category_experiences e
JOIN public.stores s ON s.id = e.store_id
JOIN public.store_product_categories c ON c.id = e.category_id
JOIN public.store_limits sl ON sl.store_id = e.store_id
WHERE s.status = 'active'
  AND c.is_active = true
  AND e.is_active = true
  AND sl.can_use_category_experiences = true;

GRANT SELECT ON public.public_store_category_experiences TO anon, authenticated;
