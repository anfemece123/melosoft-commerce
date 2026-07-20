-- ============================================================
-- Migration 042 — Product variant options (Talla, Color, ...)
-- Per-product variant option definitions + their values.
-- Mirrors the product_option_groups/product_option_items shape
-- (021_product_customizations.sql) but options here describe
-- purchasable combinations (variants), not price-delta extras.
-- ============================================================

-- ── 1. normalize_variant_value() ─────────────────────────────
-- Used to detect duplicate values under one option (e.g. "Rojo"
-- vs "rojo ") and, later, to de-duplicate variant-derived public
-- filters against existing store facets with the same name.

CREATE OR REPLACE FUNCTION public.normalize_variant_value(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(
    translate(p_value,
      'ÁÉÍÓÚÜÑáéíóúüñ',
      'AEIOUUNaeiouun'
    )
  ));
$$;

-- ── 2. product_variant_options ───────────────────────────────

CREATE TABLE public.product_variant_options (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id           uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  type                 text        NOT NULL DEFAULT 'custom'
                          CHECK (type IN ('size', 'color', 'material', 'style', 'custom')),
  use_as_public_filter boolean     NOT NULL DEFAULT true,
  is_required          boolean     NOT NULL DEFAULT true,
  is_active            boolean     NOT NULL DEFAULT true,
  sort_order           integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variant_options_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TRIGGER product_variant_options_updated_at
  BEFORE UPDATE ON public.product_variant_options
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_product_variant_options_product_id
  ON public.product_variant_options(product_id, sort_order);

ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read product variant options"
  ON public.product_variant_options FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "Public can view active product variant options"
  ON public.product_variant_options FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'active'
        AND p.is_available = true
    )
  );

CREATE POLICY "Catalog managers can insert product variant options"
  ON public.product_variant_options FOR INSERT
  WITH CHECK (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

CREATE POLICY "Catalog managers can update product variant options"
  ON public.product_variant_options FOR UPDATE
  USING (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

CREATE POLICY "Managers can delete product variant options"
  ON public.product_variant_options FOR DELETE
  USING (has_store_role(store_id, ARRAY['owner', 'admin']));

CREATE POLICY "Platform admin full access on product variant options"
  ON public.product_variant_options FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_options TO authenticated;
GRANT SELECT ON public.product_variant_options TO anon;

-- ── 3. product_variant_option_values ─────────────────────────

CREATE TABLE public.product_variant_option_values (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  option_id        uuid        NOT NULL REFERENCES public.product_variant_options(id) ON DELETE CASCADE,
  owner_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value            text        NOT NULL,
  color_hex        text,
  metadata         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  normalized_value text        GENERATED ALWAYS AS (public.normalize_variant_value(value)) STORED,
  sort_order       integer     NOT NULL DEFAULT 0,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variant_option_values_value_not_blank CHECK (btrim(value) <> ''),
  CONSTRAINT product_variant_option_values_color_hex_format
    CHECK (color_hex IS NULL OR color_hex ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT product_variant_option_values_unique_normalized UNIQUE (option_id, normalized_value)
);

CREATE TRIGGER product_variant_option_values_updated_at
  BEFORE UPDATE ON public.product_variant_option_values
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_product_variant_option_values_option_id
  ON public.product_variant_option_values(option_id, sort_order);

ALTER TABLE public.product_variant_option_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read product variant option values"
  ON public.product_variant_option_values FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "Public can view active product variant option values"
  ON public.product_variant_option_values FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.product_variant_options o
      JOIN public.products p ON p.id = o.product_id
      WHERE o.id = option_id
        AND o.is_active = true
        AND p.status = 'active'
        AND p.is_available = true
    )
  );

CREATE POLICY "Catalog managers can insert product variant option values"
  ON public.product_variant_option_values FOR INSERT
  WITH CHECK (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

CREATE POLICY "Catalog managers can update product variant option values"
  ON public.product_variant_option_values FOR UPDATE
  USING (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

CREATE POLICY "Managers can delete product variant option values"
  ON public.product_variant_option_values FOR DELETE
  USING (has_store_role(store_id, ARRAY['owner', 'admin']));

CREATE POLICY "Platform admin full access on product variant option values"
  ON public.product_variant_option_values FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_option_values TO authenticated;
GRANT SELECT ON public.product_variant_option_values TO anon;
