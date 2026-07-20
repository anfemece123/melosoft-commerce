-- ============================================================
-- Migration 045 — Per-variant inventory movements
-- Adds variant_id to inventory_movements and a sibling RPC to
-- adjust_product_stock (036_inventory_movements.sql) scoped to a
-- single variant's stock_quantity.
-- ============================================================

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_id
  ON public.inventory_movements(variant_id) WHERE variant_id IS NOT NULL;

-- ── RPC: adjust_variant_stock ─────────────────────────────────
-- Same shape/validations as adjust_product_stock, but locks and
-- updates product_variants.stock_quantity instead of products.stock.
-- Movements are recorded with both product_id (the variant's parent,
-- so existing store-wide inventory views keep working unchanged)
-- and variant_id.

CREATE OR REPLACE FUNCTION public.adjust_variant_stock(
  p_store_id        uuid,
  p_variant_id      uuid,
  p_movement_type   text,
  p_quantity_change integer,
  p_reason          text,
  p_notes           text DEFAULT NULL
)
RETURNS TABLE (new_stock integer, movement_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_before integer;
  v_product_id   uuid;
  v_stock_after  integer;
  v_movement_id  uuid;
  v_user_id      uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT has_store_role(p_store_id, ARRAY['owner', 'admin', 'staff'])
     AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  IF p_quantity_change = 0 THEN
    RAISE EXCEPTION 'quantity_change must be non-zero';
  END IF;

  SELECT stock_quantity, product_id
    INTO v_stock_before, v_product_id
    FROM public.product_variants
    WHERE id = p_variant_id AND store_id = p_store_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;

  v_stock_after := v_stock_before + p_quantity_change;

  IF v_stock_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, requested removal: %',
      v_stock_before, abs(p_quantity_change);
  END IF;

  UPDATE public.product_variants
    SET stock_quantity = v_stock_after, updated_at = now()
    WHERE id = p_variant_id;

  INSERT INTO public.inventory_movements (
    store_id, product_id, variant_id, movement_type, reason,
    quantity_change, stock_before, stock_after, notes, created_by
  )
  VALUES (
    p_store_id, v_product_id, p_variant_id, p_movement_type, trim(p_reason),
    p_quantity_change, v_stock_before, v_stock_after, p_notes, v_user_id
  )
  RETURNING id INTO v_movement_id;

  RETURN QUERY SELECT v_stock_after, v_movement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_variant_stock TO authenticated;
