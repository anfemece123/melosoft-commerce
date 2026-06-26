-- ============================================================
-- Migration 021 — Product customizations for restaurants/catalog
-- Adds option groups/items and special instructions support.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS allows_special_instructions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS special_instructions_label text,
  ADD COLUMN IF NOT EXISTS special_instructions_placeholder text,
  ADD COLUMN IF NOT EXISTS special_instructions_max_length integer NOT NULL DEFAULT 180;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_special_instructions_max_length_ok;

ALTER TABLE public.products
  ADD CONSTRAINT products_special_instructions_max_length_ok
  CHECK (special_instructions_max_length between 40 and 500);

CREATE TABLE IF NOT EXISTS public.product_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  selection_type text NOT NULL DEFAULT 'single'
    CHECK (selection_type in ('single','multiple')),
  min_select integer NOT NULL DEFAULT 0,
  max_select integer,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_option_groups_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT product_option_groups_min_select_ok CHECK (min_select >= 0),
  CONSTRAINT product_option_groups_max_select_ok CHECK (max_select is null OR max_select >= 1),
  CONSTRAINT product_option_groups_range_ok CHECK (max_select is null OR max_select >= min_select)
);

CREATE TRIGGER product_option_groups_updated_at
  BEFORE UPDATE ON public.product_option_groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_option_groups_product_id
  ON public.product_option_groups(product_id, sort_order);

CREATE TABLE IF NOT EXISTS public.product_option_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  price_delta numeric(12,2) NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_option_items_label_not_blank CHECK (btrim(label) <> ''),
  CONSTRAINT product_option_items_price_delta_ok CHECK (price_delta >= 0)
);

CREATE TRIGGER product_option_items_updated_at
  BEFORE UPDATE ON public.product_option_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_option_items_group_id
  ON public.product_option_items(group_id, sort_order);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS customer_note text,
  ADD COLUMN IF NOT EXISTS customizations_snapshot jsonb;

CREATE TABLE IF NOT EXISTS public.order_item_customizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  option_group_name text NOT NULL,
  option_item_label text NOT NULL,
  price_delta numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_item_customizations_price_delta_ok CHECK (price_delta >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_item_customizations_order_item_id
  ON public.order_item_customizations(order_item_id);

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_customizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can read product option groups" ON public.product_option_groups;
CREATE POLICY "Store members can read product option groups"
  ON public.product_option_groups FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "Public can view active product option groups" ON public.product_option_groups;
CREATE POLICY "Public can view active product option groups"
  ON public.product_option_groups FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'active'
        AND p.is_available = true
    )
  );

DROP POLICY IF EXISTS "Catalog managers can insert product option groups" ON public.product_option_groups;
CREATE POLICY "Catalog managers can insert product option groups"
  ON public.product_option_groups FOR INSERT
  WITH CHECK (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "Catalog managers can update product option groups" ON public.product_option_groups;
CREATE POLICY "Catalog managers can update product option groups"
  ON public.product_option_groups FOR UPDATE
  USING (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "Managers can delete product option groups" ON public.product_option_groups;
CREATE POLICY "Managers can delete product option groups"
  ON public.product_option_groups FOR DELETE
  USING (has_store_role(store_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Platform admin full access on product option groups" ON public.product_option_groups;
CREATE POLICY "Platform admin full access on product option groups"
  ON public.product_option_groups FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Store members can read product option items" ON public.product_option_items;
CREATE POLICY "Store members can read product option items"
  ON public.product_option_items FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "Public can view active product option items" ON public.product_option_items;
CREATE POLICY "Public can view active product option items"
  ON public.product_option_items FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.product_option_groups g
      JOIN public.products p ON p.id = g.product_id
      WHERE g.id = group_id
        AND g.is_active = true
        AND p.status = 'active'
        AND p.is_available = true
    )
  );

DROP POLICY IF EXISTS "Catalog managers can insert product option items" ON public.product_option_items;
CREATE POLICY "Catalog managers can insert product option items"
  ON public.product_option_items FOR INSERT
  WITH CHECK (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "Catalog managers can update product option items" ON public.product_option_items;
CREATE POLICY "Catalog managers can update product option items"
  ON public.product_option_items FOR UPDATE
  USING (has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "Managers can delete product option items" ON public.product_option_items;
CREATE POLICY "Managers can delete product option items"
  ON public.product_option_items FOR DELETE
  USING (has_store_role(store_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Platform admin full access on product option items" ON public.product_option_items;
CREATE POLICY "Platform admin full access on product option items"
  ON public.product_option_items FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Order item customizations select member" ON public.order_item_customizations;
CREATE POLICY "Order item customizations select member"
  ON public.order_item_customizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_id
        AND is_store_member(o.store_id)
    )
  );

DROP POLICY IF EXISTS "Order item customizations insert platform admin" ON public.order_item_customizations;
CREATE POLICY "Order item customizations insert platform admin"
  ON public.order_item_customizations FOR INSERT
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Order item customizations full platform admin" ON public.order_item_customizations;
CREATE POLICY "Order item customizations full platform admin"
  ON public.order_item_customizations FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_customizations TO authenticated;
