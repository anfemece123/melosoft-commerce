-- 153 — Optional logo per category experience.
-- The experience display_name is also used as the public contextual brand
-- name. logo_url is optional and falls back to the company's main logo.

ALTER TABLE public.store_category_experiences
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.store_category_experiences.logo_url IS
  'Optional logo shown in the public header while this category experience is active.';

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
