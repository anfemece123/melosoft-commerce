-- ============================================================
-- Migration 038 — Normalized product taxonomy (facets + category FK)
-- Replaces text-free subcategory/brand/tags approach.
-- ============================================================

-- ── 1. Extend store_product_categories ──────────────────────

ALTER TABLE public.store_product_categories
  ADD COLUMN IF NOT EXISTS parent_id   UUID REFERENCES public.store_product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url   TEXT,
  ADD COLUMN IF NOT EXISTS color       TEXT,
  ADD COLUMN IF NOT EXISTS show_in_menu BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_store_product_categories_parent
  ON public.store_product_categories (store_id, parent_id);

-- Public read access (anon can see active categories of active stores)
DROP POLICY IF EXISTS "Public can view active store product categories" ON public.store_product_categories;
CREATE POLICY "Public can view active store product categories"
  ON public.store_product_categories FOR SELECT
  USING (is_active = true);

-- ── 2. Add category_id FK to products ───────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.store_product_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON public.products (store_id, category_id);

-- ── 3. store_product_facets ──────────────────────────────────
--  Each store defines its own filterable attributes (e.g. Marca, Nivel, Talla)

CREATE TABLE IF NOT EXISTS public.store_product_facets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id              UUID NOT NULL REFERENCES auth.users(id),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  input_type            TEXT NOT NULL DEFAULT 'single_select' CHECK (input_type IN ('single_select','multi_select')),
  show_in_product_form  BOOLEAN NOT NULL DEFAULT true,
  show_in_catalog_filters BOOLEAN NOT NULL DEFAULT true,
  show_in_mega_menu     BOOLEAN NOT NULL DEFAULT false,
  sort_order            INT NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);

ALTER TABLE public.store_product_facets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can manage facets"
  ON public.store_product_facets
  FOR ALL
  USING (is_store_member(store_id))
  WITH CHECK (is_store_member(store_id));

CREATE POLICY "Public can view active facets"
  ON public.store_product_facets FOR SELECT
  USING (is_active = true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_product_facets TO authenticated;
GRANT SELECT ON public.store_product_facets TO anon;

-- ── 4. store_product_facet_values ────────────────────────────
--  Valid values for each facet (owner-controlled, prevents typos)

CREATE TABLE IF NOT EXISTS public.store_product_facet_values (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  facet_id   UUID NOT NULL REFERENCES public.store_product_facets(id) ON DELETE CASCADE,
  value      TEXT NOT NULL,
  slug       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facet_id, slug)
);

ALTER TABLE public.store_product_facet_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can manage facet values"
  ON public.store_product_facet_values
  FOR ALL
  USING (is_store_member(store_id))
  WITH CHECK (is_store_member(store_id));

CREATE POLICY "Public can view active facet values"
  ON public.store_product_facet_values FOR SELECT
  USING (is_active = true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_product_facet_values TO authenticated;
GRANT SELECT ON public.store_product_facet_values TO anon;

-- ── 5. product_facet_values (junction) ───────────────────────
--  Many-to-many: product ↔ facet values

CREATE TABLE IF NOT EXISTS public.product_facet_values (
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  facet_value_id  UUID NOT NULL REFERENCES public.store_product_facet_values(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, facet_value_id)
);

ALTER TABLE public.product_facet_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can manage product facet values"
  ON public.product_facet_values
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_facet_values.product_id
        AND is_store_member(p.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_facet_values.product_id
        AND is_store_member(p.store_id)
    )
  );

CREATE POLICY "Public can view product facet values"
  ON public.product_facet_values FOR SELECT
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_facet_values TO authenticated;
GRANT SELECT ON public.product_facet_values TO anon;

-- ── 6. public_store_categories view ─────────────────────────

DROP VIEW IF EXISTS public.public_store_categories;

CREATE VIEW public.public_store_categories
  WITH (security_invoker = false)
AS
SELECT
  spc.id,
  spc.store_id,
  s.slug       AS store_slug,
  spc.name,
  spc.slug,
  spc.description,
  spc.parent_id,
  spc.image_url,
  spc.color,
  spc.sort_order,
  spc.show_in_menu
FROM public.store_product_categories spc
JOIN public.stores s ON s.id = spc.store_id
WHERE spc.is_active = true
  AND s.status = 'active'
ORDER BY spc.sort_order ASC, spc.name ASC;

GRANT SELECT ON public.public_store_categories TO anon, authenticated;

-- ── 7. public_store_facets view ──────────────────────────────

DROP VIEW IF EXISTS public.public_store_facets;

CREATE VIEW public.public_store_facets
  WITH (security_invoker = false)
AS
SELECT
  f.id,
  f.store_id,
  s.slug  AS store_slug,
  f.name,
  f.slug,
  f.input_type,
  f.show_in_catalog_filters,
  f.show_in_mega_menu,
  f.sort_order
FROM public.store_product_facets f
JOIN public.stores s ON s.id = f.store_id
WHERE f.is_active = true
  AND s.status = 'active'
ORDER BY f.sort_order ASC, f.name ASC;

GRANT SELECT ON public.public_store_facets TO anon, authenticated;

-- ── 8. public_store_facet_values view ───────────────────────

DROP VIEW IF EXISTS public.public_store_facet_values;

CREATE VIEW public.public_store_facet_values
  WITH (security_invoker = false)
AS
SELECT
  fv.id,
  fv.store_id,
  fv.facet_id,
  fv.value,
  fv.slug,
  fv.sort_order
FROM public.store_product_facet_values fv
JOIN public.store_product_facets f ON f.id = fv.facet_id
WHERE fv.is_active = true
  AND f.is_active = true
ORDER BY fv.sort_order ASC, fv.value ASC;

GRANT SELECT ON public.public_store_facet_values TO anon, authenticated;

-- ── 9. Update public_product_pages view ─────────────────────

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
  pr.category_id,
  cat.name                                  AS category_name,
  cat.slug                                  AS category_slug,
  cat.parent_id                             AS category_parent_id,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'facet_id',    f.id,
          'facet_name',  f.name,
          'facet_slug',  f.slug,
          'input_type',  f.input_type,
          'value_id',    fv.id,
          'value',       fv.value,
          'value_slug',  fv.slug
        ) ORDER BY f.sort_order, fv.sort_order
      )
      FROM public.product_facet_values pfv
      JOIN public.store_product_facet_values fv ON fv.id = pfv.facet_value_id
      JOIN public.store_product_facets f ON f.id = fv.facet_id
      WHERE pfv.product_id = pr.id
        AND f.is_active = true
        AND fv.is_active = true
    ),
    '[]'::jsonb
  )                                         AS facet_values
FROM public.products pr
JOIN public.stores s ON s.id = pr.store_id
LEFT JOIN public.store_theme_settings     t ON t.store_id = s.id
LEFT JOIN public.store_commerce_settings  c ON c.store_id = s.id
LEFT JOIN public.store_product_categories cat ON cat.id = pr.category_id
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
