-- 159 — Visual ambience per category experience + experience gateway.
--
-- Built for companies that run several brands under one storefront (e.g. a
-- restaurant with two kitchens in one place). Each experience can now own:
--   · a decorative page background (gradient, pattern or texture image),
--   · a heading typeface,
-- and the company can show a "choose your experience" gateway on the home.
-- Everything stays behind the existing can_use_category_experiences
-- entitlement, so companies without the module are unaffected.

-- ── 1. Ambience columns ─────────────────────────────────────────────────
ALTER TABLE public.store_category_experiences
  ADD COLUMN IF NOT EXISTS background_style text NOT NULL DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS background_pattern text NOT NULL DEFAULT 'dots',
  ADD COLUMN IF NOT EXISTS background_image_url text,
  ADD COLUMN IF NOT EXISTS background_intensity integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS heading_font text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS tagline text;

ALTER TABLE public.store_category_experiences
  DROP CONSTRAINT IF EXISTS store_category_experiences_background_style_valid,
  ADD CONSTRAINT store_category_experiences_background_style_valid
    CHECK (background_style IN ('solid', 'gradient', 'pattern', 'image')),
  DROP CONSTRAINT IF EXISTS store_category_experiences_background_pattern_valid,
  ADD CONSTRAINT store_category_experiences_background_pattern_valid
    CHECK (background_pattern IN ('dots', 'grid', 'tablecloth', 'diagonal', 'waves', 'terrazzo')),
  DROP CONSTRAINT IF EXISTS store_category_experiences_background_intensity_valid,
  ADD CONSTRAINT store_category_experiences_background_intensity_valid
    CHECK (background_intensity BETWEEN 0 AND 100),
  DROP CONSTRAINT IF EXISTS store_category_experiences_heading_font_valid,
  ADD CONSTRAINT store_category_experiences_heading_font_valid
    CHECK (heading_font IN ('default', 'elegant', 'classic', 'modern', 'bold', 'rustic', 'handwritten')),
  DROP CONSTRAINT IF EXISTS store_category_experiences_tagline_length,
  ADD CONSTRAINT store_category_experiences_tagline_length
    CHECK (tagline IS NULL OR char_length(tagline) <= 80);

COMMENT ON COLUMN public.store_category_experiences.background_style IS
  'Page background while the experience is active: solid | gradient | pattern | image.';
COMMENT ON COLUMN public.store_category_experiences.background_pattern IS
  'Decorative pattern used when background_style = pattern.';
COMMENT ON COLUMN public.store_category_experiences.background_image_url IS
  'Texture/photo used when background_style = image.';
COMMENT ON COLUMN public.store_category_experiences.background_intensity IS
  'Strength (0-100) of the decorative background.';
COMMENT ON COLUMN public.store_category_experiences.heading_font IS
  'Heading typeface preset applied while the experience is active.';
COMMENT ON COLUMN public.store_category_experiences.tagline IS
  'Short line shown in the experience gateway and intro (e.g. "Cocina japonesa").';

-- ── 2. Gateway settings (one row per company) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.store_experience_gateways (
  store_id    uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  is_enabled  boolean NOT NULL DEFAULT false,
  placement   text NOT NULL DEFAULT 'replace_hero',
  title       text,
  subtitle    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_experience_gateways_placement_valid
    CHECK (placement IN ('replace_hero', 'below_hero')),
  CONSTRAINT store_experience_gateways_title_length
    CHECK (title IS NULL OR char_length(title) <= 90),
  CONSTRAINT store_experience_gateways_subtitle_length
    CHECK (subtitle IS NULL OR char_length(subtitle) <= 180)
);

COMMENT ON TABLE public.store_experience_gateways IS
  'Optional home gateway that lets visitors pick one of the company experiences.';

DROP TRIGGER IF EXISTS store_experience_gateways_updated_at
  ON public.store_experience_gateways;
CREATE TRIGGER store_experience_gateways_updated_at
  BEFORE UPDATE ON public.store_experience_gateways
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.store_experience_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_experience_gateways_select_manager
  ON public.store_experience_gateways;
CREATE POLICY store_experience_gateways_select_manager
  ON public.store_experience_gateways FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']));

DROP POLICY IF EXISTS store_experience_gateways_insert_manager
  ON public.store_experience_gateways;
CREATE POLICY store_experience_gateways_insert_manager
  ON public.store_experience_gateways FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND EXISTS (
      SELECT 1 FROM public.store_limits sl
      WHERE sl.store_id = store_experience_gateways.store_id
        AND sl.can_use_category_experiences = true
    )
  );

DROP POLICY IF EXISTS store_experience_gateways_update_manager
  ON public.store_experience_gateways;
CREATE POLICY store_experience_gateways_update_manager
  ON public.store_experience_gateways FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
  WITH CHECK (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND EXISTS (
      SELECT 1 FROM public.store_limits sl
      WHERE sl.store_id = store_experience_gateways.store_id
        AND sl.can_use_category_experiences = true
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.store_experience_gateways TO authenticated;

-- ── 3. Public views ─────────────────────────────────────────────────────
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
  e.tagline,
  e.logo_url,
  e.cover_image_url,
  e.theme_mode,
  e.primary_color,
  e.secondary_color,
  e.accent_color,
  e.background_color,
  e.text_color,
  e.button_radius,
  e.background_style,
  e.background_pattern,
  e.background_image_url,
  e.background_intensity,
  e.heading_font,
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

DROP VIEW IF EXISTS public.public_store_experience_gateways;
CREATE VIEW public.public_store_experience_gateways
  WITH (security_invoker = false)
AS
SELECT
  g.store_id,
  s.slug AS store_slug,
  g.placement,
  g.title,
  g.subtitle
FROM public.store_experience_gateways g
JOIN public.stores s ON s.id = g.store_id
JOIN public.store_limits sl ON sl.store_id = g.store_id
WHERE s.status = 'active'
  AND g.is_enabled = true
  AND sl.can_use_category_experiences = true;

GRANT SELECT ON public.public_store_experience_gateways TO anon, authenticated;
