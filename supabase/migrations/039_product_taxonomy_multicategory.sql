-- ============================================================
-- Migration 039 — Product taxonomy multi-category correction
-- Normalizes products ↔ categories as many-to-many and keeps
-- compatibility with existing category/category_id fields.
-- ============================================================

-- ── 1. Product ↔ category junction ───────────────────────────

CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES public.store_product_categories(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_category_id
  ON public.product_categories (category_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_categories_product_id
  ON public.product_categories (product_id, category_id);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can manage product categories" ON public.product_categories;
CREATE POLICY "Store members can manage product categories"
  ON public.product_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_categories.product_id
        AND is_store_member(p.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.store_product_categories c
        ON c.id = product_categories.category_id
      WHERE p.id = product_categories.product_id
        AND p.store_id = c.store_id
        AND is_store_member(p.store_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
REVOKE ALL ON public.product_categories FROM anon;

CREATE OR REPLACE FUNCTION public.ensure_product_category_same_store()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  product_store_id uuid;
  category_store_id uuid;
BEGIN
  SELECT store_id INTO product_store_id
  FROM public.products
  WHERE id = NEW.product_id;

  SELECT store_id INTO category_store_id
  FROM public.store_product_categories
  WHERE id = NEW.category_id;

  IF product_store_id IS NULL THEN
    RAISE EXCEPTION 'Product % does not exist', NEW.product_id;
  END IF;

  IF category_store_id IS NULL THEN
    RAISE EXCEPTION 'Category % does not exist', NEW.category_id;
  END IF;

  IF product_store_id <> category_store_id THEN
    RAISE EXCEPTION 'Product and category must belong to the same store';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_categories_same_store ON public.product_categories;
CREATE TRIGGER trg_product_categories_same_store
  BEFORE INSERT OR UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_product_category_same_store();

-- ── 1b. Harden product ↔ facet value junction ────────────────

DROP POLICY IF EXISTS "Store members can manage product facet values" ON public.product_facet_values;
CREATE POLICY "Store members can manage product facet values"
  ON public.product_facet_values
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_facet_values.product_id
        AND is_store_member(p.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.store_product_facet_values fv
        ON fv.id = product_facet_values.facet_value_id
      WHERE p.id = product_facet_values.product_id
        AND p.store_id = fv.store_id
        AND is_store_member(p.store_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_facet_values TO authenticated;
REVOKE ALL ON public.product_facet_values FROM anon;

CREATE OR REPLACE FUNCTION public.ensure_product_facet_value_same_store()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  product_store_id uuid;
  facet_value_store_id uuid;
BEGIN
  SELECT store_id INTO product_store_id
  FROM public.products
  WHERE id = NEW.product_id;

  SELECT store_id INTO facet_value_store_id
  FROM public.store_product_facet_values
  WHERE id = NEW.facet_value_id;

  IF product_store_id IS NULL THEN
    RAISE EXCEPTION 'Product % does not exist', NEW.product_id;
  END IF;

  IF facet_value_store_id IS NULL THEN
    RAISE EXCEPTION 'Facet value % does not exist', NEW.facet_value_id;
  END IF;

  IF product_store_id <> facet_value_store_id THEN
    RAISE EXCEPTION 'Product and facet value must belong to the same store';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_facet_values_same_store ON public.product_facet_values;
CREATE TRIGGER trg_product_facet_values_same_store
  BEFORE INSERT OR UPDATE ON public.product_facet_values
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_product_facet_value_same_store();

-- ── 2. Backfill from legacy products.category_id/category ────

INSERT INTO public.product_categories (product_id, category_id)
SELECT p.id, p.category_id
FROM public.products p
WHERE p.category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;

INSERT INTO public.product_categories (product_id, category_id)
SELECT p.id, c.id
FROM public.products p
JOIN public.store_product_categories c
  ON c.store_id = p.store_id
 AND (
   lower(trim(c.name)) = lower(trim(p.category))
   OR c.slug = regexp_replace(lower(trim(p.category)), '[^a-z0-9]+', '-', 'g')
 )
WHERE p.category IS NOT NULL
  AND trim(p.category) <> ''
ON CONFLICT (product_id, category_id) DO NOTHING;

-- Keep products.category_id aligned with the first assigned category for compatibility.
WITH preferred_category AS (
  SELECT DISTINCT ON (pc.product_id)
    pc.product_id,
    c.id AS category_id,
    c.name AS category_name
  FROM public.product_categories pc
  JOIN public.store_product_categories c ON c.id = pc.category_id
  ORDER BY pc.product_id, c.sort_order ASC, c.name ASC, c.id ASC
)
UPDATE public.products p
SET
  category_id = preferred_category.category_id,
  category = COALESCE(p.category, preferred_category.category_name)
FROM preferred_category
WHERE preferred_category.product_id = p.id;

-- Harden public reads on legacy facet junction as well.
DROP POLICY IF EXISTS "Public can view product facet values" ON public.product_facet_values;
DROP POLICY IF EXISTS "Public can view active facets" ON public.store_product_facets;
DROP POLICY IF EXISTS "Public can view active facet values" ON public.store_product_facet_values;

REVOKE ALL ON public.store_product_facets FROM anon;
REVOKE ALL ON public.store_product_facet_values FROM anon;

-- ── 3. Public views ──────────────────────────────────────────

DROP VIEW IF EXISTS public.public_store_facets;

CREATE VIEW public.public_store_facets
  WITH (security_invoker = false)
AS
SELECT
  f.id,
  f.store_id,
  s.slug AS store_slug,
  f.name,
  f.slug,
  f.input_type,
  f.show_in_catalog_filters,
  f.show_in_mega_menu,
  f.sort_order
FROM public.store_product_facets f
JOIN public.stores s
  ON s.id = f.store_id
WHERE s.status = 'active'
  AND f.is_active = true
ORDER BY f.sort_order ASC, f.name ASC;

GRANT SELECT ON public.public_store_facets TO anon, authenticated;

DROP VIEW IF EXISTS public.public_store_facet_values;

CREATE VIEW public.public_store_facet_values
  WITH (security_invoker = false)
AS
SELECT
  fv.id,
  fv.store_id,
  s.slug AS store_slug,
  fv.facet_id,
  fv.value,
  fv.slug,
  fv.sort_order
FROM public.store_product_facet_values fv
JOIN public.store_product_facets f
  ON f.id = fv.facet_id
JOIN public.stores s
  ON s.id = fv.store_id
WHERE s.status = 'active'
  AND f.store_id = fv.store_id
  AND f.is_active = true
  AND fv.is_active = true
ORDER BY fv.sort_order ASC, fv.value ASC;

GRANT SELECT ON public.public_store_facet_values TO anon, authenticated;

DROP VIEW IF EXISTS public.public_product_categories;

CREATE VIEW public.public_product_categories
  WITH (security_invoker = false)
AS
SELECT
  p.id                    AS product_id,
  p.store_id,
  s.slug                  AS store_slug,
  c.id                    AS category_id,
  c.parent_id,
  c.name,
  c.slug,
  c.description,
  c.image_url,
  c.color,
  c.sort_order,
  c.show_in_menu
FROM public.product_categories pc
JOIN public.products p
  ON p.id = pc.product_id
JOIN public.stores s
  ON s.id = p.store_id
JOIN public.store_product_categories c
  ON c.id = pc.category_id
WHERE s.status = 'active'
  AND p.status = 'active'
  AND p.is_available = true
  AND c.is_active = true;

GRANT SELECT ON public.public_product_categories TO anon, authenticated;

DROP VIEW IF EXISTS public.public_product_facet_values;

CREATE VIEW public.public_product_facet_values
  WITH (security_invoker = false)
AS
SELECT
  pfv.product_id,
  fv.store_id,
  fv.id                  AS facet_value_id,
  fv.facet_id,
  f.name                 AS facet_name,
  f.slug                 AS facet_slug,
  f.input_type,
  fv.value,
  fv.slug                AS value_slug,
  fv.sort_order
FROM public.product_facet_values pfv
JOIN public.products p
  ON p.id = pfv.product_id
JOIN public.stores s
  ON s.id = p.store_id
JOIN public.store_product_facet_values fv
  ON fv.id = pfv.facet_value_id
 AND fv.store_id = p.store_id
JOIN public.store_product_facets f
  ON f.id = fv.facet_id
 AND f.store_id = fv.store_id
WHERE s.status = 'active'
  AND p.status = 'active'
  AND p.is_available = true
  AND f.is_active = true
  AND fv.is_active = true;

GRANT SELECT ON public.public_product_facet_values TO anon, authenticated;

DROP VIEW IF EXISTS public.public_product_pages;

CREATE VIEW public.public_product_pages AS
SELECT
  s.slug                                    AS store_slug,
  s.name                                    AS store_name,
  s.whatsapp_number                         AS store_whatsapp_number,
  s.logo_url,
  t.mode                                    AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  c.whatsapp_checkout_enabled,
  c.web_order_enabled,
  c.allows_pickup,
  c.allows_local_delivery,
  c.commerce_mode,
  c.catalog_type,
  pr.id                                     AS product_id,
  pr.slug                                   AS product_slug,
  pr.name                                   AS product_name,
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
  pr.category,
  primary_cat.category_id                   AS category_id,
  primary_cat.category_name                 AS category_name,
  primary_cat.category_slug                 AS category_slug,
  primary_cat.category_parent_id            AS category_parent_id,
  COALESCE(assigned_categories.categories, '[]'::jsonb) AS categories,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'facet_id',    pfv.facet_id,
          'facet_name',  pfv.facet_name,
          'facet_slug',  pfv.facet_slug,
          'input_type',  pfv.input_type,
          'value_id',    pfv.facet_value_id,
          'value',       pfv.value,
          'value_slug',  pfv.value_slug
        )
        ORDER BY pfv.facet_name, pfv.value
      )
      FROM public.public_product_facet_values pfv
      WHERE pfv.product_id = pr.id
    ),
    '[]'::jsonb
  ) AS facet_values
FROM public.products pr
JOIN public.stores s
  ON s.id = pr.store_id
LEFT JOIN public.store_theme_settings t
  ON t.store_id = s.id
LEFT JOIN public.store_commerce_settings c
  ON c.store_id = s.id
LEFT JOIN LATERAL (
  SELECT pi.image_url
  FROM public.product_images pi
  WHERE pi.product_id = pr.id
  ORDER BY pi.is_primary DESC, pi.sort_order ASC
  LIMIT 1
) img ON true
LEFT JOIN LATERAL (
  SELECT
    cat.id        AS category_id,
    cat.name      AS category_name,
    cat.slug      AS category_slug,
    cat.parent_id AS category_parent_id
  FROM public.product_categories pc
  JOIN public.store_product_categories cat
    ON cat.id = pc.category_id
  WHERE pc.product_id = pr.id
    AND cat.is_active = true
  ORDER BY cat.sort_order ASC, cat.name ASC, cat.id ASC
  LIMIT 1
) primary_cat ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',         cat.id,
      'store_id',   cat.store_id,
      'store_slug', s.slug,
      'name',       cat.name,
      'slug',       cat.slug,
      'description',cat.description,
      'parent_id',  cat.parent_id,
      'image_url',  cat.image_url,
      'color',      cat.color,
      'sort_order', cat.sort_order,
      'show_in_menu', cat.show_in_menu
    )
    ORDER BY cat.sort_order ASC, cat.name ASC, cat.id ASC
  ) AS categories
  FROM public.product_categories pc
  JOIN public.store_product_categories cat
    ON cat.id = pc.category_id
  WHERE pc.product_id = pr.id
    AND cat.is_active = true
) assigned_categories ON true
WHERE s.status = 'active'
  AND pr.status = 'active'
  AND pr.is_available = true;

GRANT SELECT ON public.public_product_pages TO anon, authenticated;
