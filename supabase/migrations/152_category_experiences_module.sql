-- 152 — Optional per-category storefront experiences.
-- A company can enable this module and give selected catalog categories their
-- own visual identity. The public storefront only exposes active experiences
-- while the company entitlement is enabled.

ALTER TABLE public.store_limits
  ADD COLUMN IF NOT EXISTS can_use_category_experiences boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.store_limits.can_use_category_experiences IS
  'Platform-admin entitlement for visual storefront experiences assigned to catalog categories.';

CREATE TABLE IF NOT EXISTS public.store_category_experiences (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id       uuid NOT NULL REFERENCES public.store_product_categories(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES auth.users(id),
  display_name      text NOT NULL,
  description       text,
  theme_mode        text NOT NULL DEFAULT 'light',
  primary_color     text NOT NULL DEFAULT '#4f46e5',
  secondary_color   text NOT NULL DEFAULT '#eef2ff',
  accent_color      text NOT NULL DEFAULT '#7c3aed',
  background_color  text NOT NULL DEFAULT '#ffffff',
  text_color        text NOT NULL DEFAULT '#111827',
  button_radius     text NOT NULL DEFAULT '24px',
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_category_experiences_name_valid CHECK (btrim(display_name) <> ''),
  CONSTRAINT store_category_experiences_theme_mode_valid CHECK (theme_mode IN ('light', 'dark')),
  CONSTRAINT store_category_experiences_store_category_unique UNIQUE (store_id, category_id)
);

COMMENT ON TABLE public.store_category_experiences IS
  'Optional visual storefront identity assigned to a company catalog category.';

CREATE INDEX IF NOT EXISTS idx_store_category_experiences_store
  ON public.store_category_experiences (store_id, sort_order, display_name);

CREATE OR REPLACE FUNCTION public.ensure_category_experience_same_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  category_store_id uuid;
BEGIN
  SELECT store_id INTO category_store_id
  FROM public.store_product_categories
  WHERE id = NEW.category_id;

  IF category_store_id IS NULL OR category_store_id <> NEW.store_id THEN
    RAISE EXCEPTION 'La categoría no pertenece a la empresa de la experiencia.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_category_experiences_same_store
  ON public.store_category_experiences;
CREATE TRIGGER store_category_experiences_same_store
  BEFORE INSERT OR UPDATE OF store_id, category_id
  ON public.store_category_experiences
  FOR EACH ROW EXECUTE FUNCTION public.ensure_category_experience_same_store();

DROP TRIGGER IF EXISTS store_category_experiences_updated_at
  ON public.store_category_experiences;
CREATE TRIGGER store_category_experiences_updated_at
  BEFORE UPDATE ON public.store_category_experiences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.store_category_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_category_experiences_select_platform_admin
  ON public.store_category_experiences;
CREATE POLICY store_category_experiences_select_platform_admin
  ON public.store_category_experiences FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS store_category_experiences_select_member
  ON public.store_category_experiences;
CREATE POLICY store_category_experiences_select_member
  ON public.store_category_experiences FOR SELECT TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']));

DROP POLICY IF EXISTS store_category_experiences_insert_manager
  ON public.store_category_experiences;
CREATE POLICY store_category_experiences_insert_manager
  ON public.store_category_experiences FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND EXISTS (
      SELECT 1 FROM public.store_limits sl
      WHERE sl.store_id = store_category_experiences.store_id
        AND sl.can_use_category_experiences = true
    )
  );

DROP POLICY IF EXISTS store_category_experiences_update_manager
  ON public.store_category_experiences;
CREATE POLICY store_category_experiences_update_manager
  ON public.store_category_experiences FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
  WITH CHECK (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND EXISTS (
      SELECT 1 FROM public.store_limits sl
      WHERE sl.store_id = store_category_experiences.store_id
        AND sl.can_use_category_experiences = true
    )
  );

DROP POLICY IF EXISTS store_category_experiences_delete_manager
  ON public.store_category_experiences;
CREATE POLICY store_category_experiences_delete_manager
  ON public.store_category_experiences FOR DELETE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']));

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.store_category_experiences TO authenticated;

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
