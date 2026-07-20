-- ============================================================
-- Migration 043 — Product variants (purchasable combinations)
-- Each variant belongs to one product and has its own SKU,
-- price (nullable = falls back to the product's price at read
-- time), stock and status. option_signature is a deterministic
-- string built from the variant's sorted option_value_ids and is
-- unique per product to prevent duplicate combinations.
-- ============================================================

CREATE TABLE public.product_variants (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id          uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sku                 text,
  barcode             text,
  price               numeric(12,2),
  compare_at_price    numeric(12,2),
  cost                numeric(12,2),
  stock_quantity      integer     NOT NULL DEFAULT 0,
  stock_policy        text        NOT NULL DEFAULT 'deny'
                         CHECK (stock_policy IN ('deny', 'allow_backorder')),
  low_stock_threshold integer,
  weight              numeric(10,3),
  status              text        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'inactive')),
  is_default          boolean     NOT NULL DEFAULT false,
  position            integer     NOT NULL DEFAULT 0,
  option_signature     text       NOT NULL,
  metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_price_ok CHECK (price IS NULL OR price >= 0),
  CONSTRAINT product_variants_compare_at_price_ok CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  CONSTRAINT product_variants_cost_ok CHECK (cost IS NULL OR cost >= 0),
  CONSTRAINT product_variants_stock_quantity_ok CHECK (stock_quantity >= 0),
  CONSTRAINT product_variants_option_signature_not_blank CHECK (btrim(option_signature) <> ''),
  CONSTRAINT product_variants_unique_signature UNIQUE (product_id, option_signature)
);

CREATE TRIGGER product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_product_variants_product_id
  ON public.product_variants(product_id, position);

-- Non-unique lookup index for SKU availability checks (uniqueness is
-- validated at the service layer, same looseness as products.sku today).
CREATE INDEX idx_product_variants_store_sku
  ON public.product_variants(store_id, sku)
  WHERE sku IS NOT NULL;

-- ── Single default variant per product ───────────────────────

CREATE OR REPLACE FUNCTION public.enforce_single_default_variant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.product_variants
    SET is_default = false
    WHERE product_id = NEW.product_id
      AND id <> NEW.id
      AND is_default = true;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_variants_single_default
  BEFORE INSERT OR UPDATE OF is_default ON public.product_variants
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.enforce_single_default_variant();

-- If a product ends up with zero active+default variants (new variant
-- created without is_default, default variant deactivated/deleted...),
-- automatically promote the lowest-position active variant.

CREATE OR REPLACE FUNCTION public.ensure_product_variant_default()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE product_id = v_product_id AND is_default = true AND status = 'active'
  ) THEN
    UPDATE public.product_variants
      SET is_default = true
      WHERE id = (
        SELECT id FROM public.product_variants
        WHERE product_id = v_product_id AND status = 'active'
        ORDER BY position ASC, created_at ASC
        LIMIT 1
      );
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_product_variants_auto_default
  AFTER INSERT OR UPDATE OF is_default, status OR DELETE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_product_variant_default();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read product variants"
  ON public.product_variants FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "Public can view active product variants"
  ON public.product_variants FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'active'
        AND p.is_available = true
    )
  );

CREATE POLICY "Catalog managers can insert product variants"
  ON public.product_variants FOR INSERT
  WITH CHECK (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

CREATE POLICY "Catalog managers can update product variants"
  ON public.product_variants FOR UPDATE
  USING (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

CREATE POLICY "Managers can delete product variants"
  ON public.product_variants FOR DELETE
  USING (has_store_role(store_id, ARRAY['owner', 'admin']));

CREATE POLICY "Platform admin full access on product variants"
  ON public.product_variants FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT ON public.product_variants TO anon;
