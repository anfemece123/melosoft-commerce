-- ============================================================
-- Migration 020 — Store product categories
-- Creates a reusable category catalog per store for products/menu.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.store_product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_product_categories_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT store_product_categories_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT store_product_categories_store_slug_unique UNIQUE (store_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_store_product_categories_store_id
  ON public.store_product_categories(store_id, sort_order, name);

ALTER TABLE public.store_product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can read store product categories" ON public.store_product_categories;
CREATE POLICY "Store members can read store product categories"
  ON public.store_product_categories FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "Catalog managers can insert store product categories" ON public.store_product_categories;
CREATE POLICY "Catalog managers can insert store product categories"
  ON public.store_product_categories FOR INSERT
  WITH CHECK (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "Catalog managers can update store product categories" ON public.store_product_categories;
CREATE POLICY "Catalog managers can update store product categories"
  ON public.store_product_categories FOR UPDATE
  USING (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "Catalog managers can delete store product categories" ON public.store_product_categories;
CREATE POLICY "Catalog managers can delete store product categories"
  ON public.store_product_categories FOR DELETE
  USING (has_store_role(store_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Platform admin full access on store product categories" ON public.store_product_categories;
CREATE POLICY "Platform admin full access on store product categories"
  ON public.store_product_categories FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_product_categories TO authenticated;
