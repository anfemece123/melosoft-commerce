-- ============================================================
-- Migration 148 — Reusable product-option library
--
-- A library item is a reusable recipe for an additional. Applying it to a
-- dish copies its current values into that dish's option group, so each dish
-- can still override price, description or availability independently.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.store_product_option_library (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label              text NOT NULL,
  description        text,
  price_delta        numeric(12,2) NOT NULL DEFAULT 0,
  linked_product_id  uuid REFERENCES public.products(id) ON DELETE CASCADE,
  linked_variant_id  uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  linked_quantity    integer NOT NULL DEFAULT 1,
  price_mode         text NOT NULL DEFAULT 'custom',
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_product_option_library_label_valid CHECK (char_length(btrim(label)) BETWEEN 1 AND 180),
  CONSTRAINT store_product_option_library_description_valid CHECK (description IS NULL OR char_length(description) <= 500),
  CONSTRAINT store_product_option_library_price_valid CHECK (price_delta >= 0),
  CONSTRAINT store_product_option_library_quantity_valid CHECK (linked_quantity BETWEEN 1 AND 100),
  CONSTRAINT store_product_option_library_price_mode_valid CHECK (price_mode IN ('custom', 'catalog')),
  CONSTRAINT store_product_option_library_variant_requires_product CHECK (linked_variant_id IS NULL OR linked_product_id IS NOT NULL),
  CONSTRAINT store_product_option_library_catalog_requires_product CHECK (price_mode <> 'catalog' OR linked_product_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS store_product_option_library_store_label_unique
  ON public.store_product_option_library(store_id, lower(label));
CREATE INDEX IF NOT EXISTS idx_store_product_option_library_store_active
  ON public.store_product_option_library(store_id, is_active, lower(label));

DROP TRIGGER IF EXISTS store_product_option_library_updated_at ON public.store_product_option_library;
CREATE TRIGGER store_product_option_library_updated_at
  BEFORE UPDATE ON public.store_product_option_library
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.prepare_store_product_option_library_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
BEGIN
  IF NEW.linked_product_id IS NULL THEN
    NEW.linked_variant_id := NULL;
    NEW.linked_quantity := 1;
    NEW.price_mode := 'custom';
    RETURN NEW;
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = NEW.linked_product_id
    AND store_id = NEW.store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_LIBRARY_LINKED_PRODUCT'; END IF;

  IF NEW.linked_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant
    FROM public.product_variants
    WHERE id = NEW.linked_variant_id
      AND product_id = NEW.linked_product_id
      AND store_id = NEW.store_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_LIBRARY_LINKED_VARIANT'; END IF;
  ELSIF v_product.has_variants THEN
    RAISE EXCEPTION 'LINKED_LIBRARY_VARIANT_REQUIRED';
  END IF;

  IF NEW.price_mode = 'catalog' THEN
    NEW.price_delta := COALESCE(
      CASE WHEN NEW.linked_variant_id IS NOT NULL THEN v_variant.price END,
      v_product.sale_price,
      v_product.regular_price
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_store_product_option_library_item ON public.store_product_option_library;
CREATE TRIGGER prepare_store_product_option_library_item
  BEFORE INSERT OR UPDATE OF store_id, linked_product_id, linked_variant_id,
    linked_quantity, price_mode, price_delta
  ON public.store_product_option_library
  FOR EACH ROW EXECUTE FUNCTION public.prepare_store_product_option_library_item();

ALTER TABLE public.store_product_option_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_product_option_library_select_member ON public.store_product_option_library;
CREATE POLICY store_product_option_library_select_member
  ON public.store_product_option_library FOR SELECT
  USING (public.is_store_member(store_id));

DROP POLICY IF EXISTS store_product_option_library_insert_manager ON public.store_product_option_library;
CREATE POLICY store_product_option_library_insert_manager
  ON public.store_product_option_library FOR INSERT
  WITH CHECK (public.has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS store_product_option_library_update_manager ON public.store_product_option_library;
CREATE POLICY store_product_option_library_update_manager
  ON public.store_product_option_library FOR UPDATE
  USING (public.has_store_role(store_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS store_product_option_library_platform_admin ON public.store_product_option_library;
CREATE POLICY store_product_option_library_platform_admin
  ON public.store_product_option_library FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT SELECT ON public.store_product_option_library TO authenticated;
GRANT INSERT (
  store_id, owner_id, label, description, price_delta, linked_product_id,
  linked_variant_id, linked_quantity, price_mode, is_active
) ON public.store_product_option_library TO authenticated;
GRANT UPDATE (
  label, description, price_delta, linked_product_id, linked_variant_id,
  linked_quantity, price_mode, is_active
) ON public.store_product_option_library TO authenticated;
GRANT ALL ON public.store_product_option_library TO service_role;

-- Every option saved on a dish becomes available for reuse automatically.
-- ON CONFLICT deliberately preserves the existing library definition: a
-- dish may override its own copy without silently changing other dishes.
CREATE OR REPLACE FUNCTION public.save_product_option_to_library()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.store_product_option_library AS library (
    store_id, owner_id, label, description, price_delta, linked_product_id,
    linked_variant_id, linked_quantity, price_mode, is_active
  ) VALUES (
    NEW.store_id, NEW.owner_id, NEW.label, NEW.description, NEW.price_delta,
    NEW.linked_product_id, NEW.linked_variant_id, NEW.linked_quantity,
    NEW.price_mode, NEW.is_active
  )
  ON CONFLICT (store_id, lower(label)) DO UPDATE
    SET is_active = library.is_active OR EXCLUDED.is_active;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS save_product_option_to_library ON public.product_option_items;
CREATE TRIGGER save_product_option_to_library
  AFTER INSERT ON public.product_option_items
  FOR EACH ROW EXECUTE FUNCTION public.save_product_option_to_library();

CREATE OR REPLACE FUNCTION public.sync_catalog_library_option_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    UPDATE public.store_product_option_library item
    SET price_delta = COALESCE(variant.price, NEW.sale_price, NEW.regular_price),
        updated_at = now()
    FROM public.product_variants variant
    WHERE item.linked_product_id = NEW.id
      AND item.linked_variant_id = variant.id
      AND item.price_mode = 'catalog';

    UPDATE public.store_product_option_library item
    SET price_delta = COALESCE(NEW.sale_price, NEW.regular_price),
        updated_at = now()
    WHERE item.linked_product_id = NEW.id
      AND item.linked_variant_id IS NULL
      AND item.price_mode = 'catalog';
  ELSE
    UPDATE public.store_product_option_library item
    SET price_delta = COALESCE(NEW.price, product.sale_price, product.regular_price),
        updated_at = now()
    FROM public.products product
    WHERE item.linked_variant_id = NEW.id
      AND item.linked_product_id = product.id
      AND item.price_mode = 'catalog';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_catalog_library_option_product_price ON public.products;
CREATE TRIGGER sync_catalog_library_option_product_price
  AFTER UPDATE OF regular_price, sale_price ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_catalog_library_option_prices();

DROP TRIGGER IF EXISTS sync_catalog_library_option_variant_price ON public.product_variants;
CREATE TRIGGER sync_catalog_library_option_variant_price
  AFTER UPDATE OF price ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.sync_catalog_library_option_prices();

-- Backfill options already saved before the library was introduced.
INSERT INTO public.store_product_option_library (
  store_id, owner_id, label, description, price_delta, linked_product_id,
  linked_variant_id, linked_quantity, price_mode, is_active
)
SELECT DISTINCT ON (item.store_id, lower(item.label))
  item.store_id, item.owner_id, item.label, item.description, item.price_delta,
  item.linked_product_id, item.linked_variant_id, item.linked_quantity,
  item.price_mode, item.is_active
FROM public.product_option_items item
WHERE item.is_active = true
ORDER BY item.store_id, lower(item.label), item.created_at ASC, item.id
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.store_product_option_library IS
  'Reusable company-specific additional recipes. Applying one to a dish copies its values; dish-level overrides remain independent.';
