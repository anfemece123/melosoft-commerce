-- ============================================================
-- Migration 044 — Variant selected values, variant images,
-- has_variants flag, and size charts.
-- ============================================================

-- ── 1. product_variant_selected_values (junction) ────────────
-- One value per option per variant. Mirrors the pure-junction
-- shape of product_facet_values (038_product_taxonomy.sql).

CREATE TABLE public.product_variant_selected_values (
  variant_id      uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  option_id       uuid NOT NULL REFERENCES public.product_variant_options(id) ON DELETE CASCADE,
  option_value_id uuid NOT NULL REFERENCES public.product_variant_option_values(id) ON DELETE CASCADE,
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, option_id)
);

CREATE INDEX idx_product_variant_selected_values_option_value_id
  ON public.product_variant_selected_values(option_value_id);

ALTER TABLE public.product_variant_selected_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read variant selected values"
  ON public.product_variant_selected_values FOR SELECT
  USING (is_store_member(store_id));

-- Public may only see the selected values of active variants of
-- active/available products (stricter than product_facet_values'
-- open policy, since variants must never leak inactive combinations).
CREATE POLICY "Public can view active variant selected values"
  ON public.product_variant_selected_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
      WHERE v.id = variant_id
        AND v.status = 'active'
        AND p.status = 'active'
        AND p.is_available = true
    )
  );

CREATE POLICY "Catalog managers can insert variant selected values"
  ON public.product_variant_selected_values FOR INSERT
  WITH CHECK (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

CREATE POLICY "Catalog managers can update variant selected values"
  ON public.product_variant_selected_values FOR UPDATE
  USING (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

CREATE POLICY "Managers can delete variant selected values"
  ON public.product_variant_selected_values FOR DELETE
  USING (has_store_role(store_id, ARRAY['owner', 'admin']));

CREATE POLICY "Platform admin full access on variant selected values"
  ON public.product_variant_selected_values FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_selected_values TO authenticated;
GRANT SELECT ON public.product_variant_selected_values TO anon;

-- ── 2. Variant-scoped images ──────────────────────────────────
-- Reuses the existing product_images table/RLS/upload path instead
-- of introducing a separate media table. NULL variant_id keeps
-- meaning "general product image", exactly as it does today.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_images_variant_id
  ON public.product_images(variant_id) WHERE variant_id IS NOT NULL;

-- ── 3. products.has_variants ──────────────────────────────────
-- No denormalized price/stock aggregate columns: those are computed
-- in public_product_pages (046) and in the admin mapper, the same
-- way images/collections are already computed via LATERAL joins.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false;

-- ── 4. product_size_charts (store-scoped taxonomy) ───────────
-- Store-scoped like store_product_facets, not per-product like
-- variant options, since one size chart is typically reused across
-- many products in a category (all "tenis" share the same chart).

CREATE TABLE public.product_size_charts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid        REFERENCES public.store_product_categories(id) ON DELETE SET NULL,
  name        text        NOT NULL,
  chart_type  text        NOT NULL DEFAULT 'custom'
                 CHECK (chart_type IN ('shoes', 'clothing', 'custom')),
  unit        text        NOT NULL DEFAULT 'cm'
                 CHECK (unit IN ('cm', 'in')),
  content     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_size_charts_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TRIGGER product_size_charts_updated_at
  BEFORE UPDATE ON public.product_size_charts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_product_size_charts_store_id
  ON public.product_size_charts(store_id);

ALTER TABLE public.product_size_charts ENABLE ROW LEVEL SECURITY;

-- Store-scoped taxonomy — same simple 2-policy shape as
-- store_product_facets (038_product_taxonomy.sql): any store member
-- can manage, public can read active charts.
CREATE POLICY "Store members can manage size charts"
  ON public.product_size_charts
  FOR ALL
  USING (is_store_member(store_id))
  WITH CHECK (is_store_member(store_id));

CREATE POLICY "Public can view active size charts"
  ON public.product_size_charts FOR SELECT
  USING (is_active = true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_size_charts TO authenticated;
GRANT SELECT ON public.product_size_charts TO anon;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_chart_id uuid REFERENCES public.product_size_charts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_size_chart_id
  ON public.products(size_chart_id);
