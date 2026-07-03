-- ============================================================
-- Migration 040 — Single primary category + collections + facet
-- category scoping.
--
-- Reverses the many-to-many product_categories model introduced
-- in 039 in favor of:
--   - products.category_id: the single, hierarchical primary
--     category of a product (already existed since 038, already
--     backfilled by 039's own migration logic).
--   - store_product_collections / product_collections: flat,
--     many-to-many commercial groupings (Ofertas, Black Friday...)
--     that must not be confused with the category tree.
--   - store_product_facets.applies_to_all_categories +
--     store_product_facet_categories: lets a store scope a facet
--     to specific categories instead of showing it everywhere.
-- ============================================================

-- ── 1. Remove the many-to-many category model from 039 ───────
-- Both public_product_categories AND public_product_pages (039's
-- version) join product_categories via lateral subqueries, so both
-- views must be dropped before the table, or Postgres refuses the
-- DROP TABLE with a dependency error. public_product_pages is
-- recreated at the end of this migration (section 6) without any
-- dependency on product_categories.

DROP VIEW IF EXISTS public.public_product_pages;
DROP VIEW IF EXISTS public.public_product_categories;

DROP TRIGGER IF EXISTS trg_product_categories_same_store ON public.product_categories;
DROP FUNCTION IF EXISTS public.ensure_product_category_same_store();

DROP TABLE IF EXISTS public.product_categories;

-- products.category_id remains as-is (already populated by 039's
-- backfill) and becomes the single source of truth for a product's
-- primary category.

-- ── 2. Collections ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.store_product_collections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id     UUID NOT NULL REFERENCES auth.users(id),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  description  TEXT,
  image_url    TEXT,
  color        TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  show_on_home BOOLEAN NOT NULL DEFAULT false,
  show_in_menu BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_product_collections_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT store_product_collections_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT store_product_collections_store_slug_unique UNIQUE (store_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_store_product_collections_store_id
  ON public.store_product_collections (store_id, sort_order, name);

ALTER TABLE public.store_product_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can read store product collections" ON public.store_product_collections;
CREATE POLICY "Store members can read store product collections"
  ON public.store_product_collections FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "Catalog managers can insert store product collections" ON public.store_product_collections;
CREATE POLICY "Catalog managers can insert store product collections"
  ON public.store_product_collections FOR INSERT
  WITH CHECK (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "Catalog managers can update store product collections" ON public.store_product_collections;
CREATE POLICY "Catalog managers can update store product collections"
  ON public.store_product_collections FOR UPDATE
  USING (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "Catalog managers can delete store product collections" ON public.store_product_collections;
CREATE POLICY "Catalog managers can delete store product collections"
  ON public.store_product_collections FOR DELETE
  USING (has_store_role(store_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Platform admin full access on store product collections" ON public.store_product_collections;
CREATE POLICY "Platform admin full access on store product collections"
  ON public.store_product_collections FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_product_collections TO authenticated;
REVOKE ALL ON public.store_product_collections FROM anon;

-- ── 3. Product ↔ collection junction ──────────────────────────

CREATE TABLE IF NOT EXISTS public.product_collections (
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.store_product_collections(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_product_collections_collection_id
  ON public.product_collections (collection_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_collections_product_id
  ON public.product_collections (product_id, collection_id);

ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can manage product collections" ON public.product_collections;
CREATE POLICY "Store members can manage product collections"
  ON public.product_collections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_collections.product_id
        AND is_store_member(p.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.store_product_collections c
        ON c.id = product_collections.collection_id
      WHERE p.id = product_collections.product_id
        AND p.store_id = c.store_id
        AND is_store_member(p.store_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_collections TO authenticated;
REVOKE ALL ON public.product_collections FROM anon;

CREATE OR REPLACE FUNCTION public.ensure_product_collection_same_store()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  product_store_id uuid;
  collection_store_id uuid;
BEGIN
  SELECT store_id INTO product_store_id
  FROM public.products
  WHERE id = NEW.product_id;

  SELECT store_id INTO collection_store_id
  FROM public.store_product_collections
  WHERE id = NEW.collection_id;

  IF product_store_id IS NULL THEN
    RAISE EXCEPTION 'Product % does not exist', NEW.product_id;
  END IF;

  IF collection_store_id IS NULL THEN
    RAISE EXCEPTION 'Collection % does not exist', NEW.collection_id;
  END IF;

  IF product_store_id <> collection_store_id THEN
    RAISE EXCEPTION 'Product and collection must belong to the same store';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_collections_same_store ON public.product_collections;
CREATE TRIGGER trg_product_collections_same_store
  BEFORE INSERT OR UPDATE ON public.product_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_product_collection_same_store();

-- ── 4. Facet category scoping ─────────────────────────────────

ALTER TABLE public.store_product_facets
  ADD COLUMN IF NOT EXISTS applies_to_all_categories BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.store_product_facet_categories (
  facet_id            UUID NOT NULL REFERENCES public.store_product_facets(id) ON DELETE CASCADE,
  category_id         UUID NOT NULL REFERENCES public.store_product_categories(id) ON DELETE CASCADE,
  applies_to_children BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (facet_id, category_id)
);

ALTER TABLE public.store_product_facet_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can manage facet categories" ON public.store_product_facet_categories;
CREATE POLICY "Store members can manage facet categories"
  ON public.store_product_facet_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.store_product_facets f
      WHERE f.id = store_product_facet_categories.facet_id
        AND is_store_member(f.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.store_product_facets f
      JOIN public.store_product_categories c
        ON c.id = store_product_facet_categories.category_id
      WHERE f.id = store_product_facet_categories.facet_id
        AND f.store_id = c.store_id
        AND is_store_member(f.store_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_product_facet_categories TO authenticated;
REVOKE ALL ON public.store_product_facet_categories FROM anon;

CREATE OR REPLACE FUNCTION public.ensure_facet_category_same_store()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  facet_store_id uuid;
  category_store_id uuid;
BEGIN
  SELECT store_id INTO facet_store_id
  FROM public.store_product_facets
  WHERE id = NEW.facet_id;

  SELECT store_id INTO category_store_id
  FROM public.store_product_categories
  WHERE id = NEW.category_id;

  IF facet_store_id IS NULL THEN
    RAISE EXCEPTION 'Facet % does not exist', NEW.facet_id;
  END IF;

  IF category_store_id IS NULL THEN
    RAISE EXCEPTION 'Category % does not exist', NEW.category_id;
  END IF;

  IF facet_store_id <> category_store_id THEN
    RAISE EXCEPTION 'Facet and category must belong to the same store';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facet_categories_same_store ON public.store_product_facet_categories;
CREATE TRIGGER trg_facet_categories_same_store
  BEFORE INSERT OR UPDATE ON public.store_product_facet_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_facet_category_same_store();

-- ── 5. Public views ────────────────────────────────────────────

DROP VIEW IF EXISTS public.public_store_collections;

CREATE VIEW public.public_store_collections
  WITH (security_invoker = false)
AS
SELECT
  col.id,
  col.store_id,
  s.slug AS store_slug,
  col.name,
  col.slug,
  col.description,
  col.image_url,
  col.color,
  col.sort_order,
  col.show_on_home,
  col.show_in_menu
FROM public.store_product_collections col
JOIN public.stores s ON s.id = col.store_id
WHERE col.is_active = true
  AND s.status = 'active'
ORDER BY col.sort_order ASC, col.name ASC;

GRANT SELECT ON public.public_store_collections TO anon, authenticated;

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
  f.applies_to_all_categories,
  f.sort_order,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'category_id', fc.category_id,
          'applies_to_children', fc.applies_to_children
        )
      )
      FROM public.store_product_facet_categories fc
      WHERE fc.facet_id = f.id
    ),
    '[]'::jsonb
  ) AS applicable_categories
FROM public.store_product_facets f
JOIN public.stores s
  ON s.id = f.store_id
WHERE s.status = 'active'
  AND f.is_active = true
ORDER BY f.sort_order ASC, f.name ASC;

GRANT SELECT ON public.public_store_facets TO anon, authenticated;

-- ── 6. public_product_pages: single category join + collections ─
-- Already dropped in section 1 (before the product_categories DROP
-- TABLE); recreated here with no dependency on product_categories.

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
  COALESCE(collections.items, '[]'::jsonb)  AS collections,
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
LEFT JOIN public.store_product_categories cat
  ON cat.id = pr.category_id
LEFT JOIN LATERAL (
  SELECT pi.image_url
  FROM public.product_images pi
  WHERE pi.product_id = pr.id
  ORDER BY pi.is_primary DESC, pi.sort_order ASC
  LIMIT 1
) img ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',   col.id,
      'name', col.name,
      'slug', col.slug
    )
    ORDER BY col.sort_order ASC, col.name ASC, col.id ASC
  ) AS items
  FROM public.product_collections pc
  JOIN public.store_product_collections col
    ON col.id = pc.collection_id
  WHERE pc.product_id = pr.id
    AND col.is_active = true
) collections ON true
WHERE s.status = 'active'
  AND pr.status = 'active'
  AND pr.is_available = true;

GRANT SELECT ON public.public_product_pages TO anon, authenticated;
