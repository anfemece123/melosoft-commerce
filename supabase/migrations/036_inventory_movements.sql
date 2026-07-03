-- ============================================================
-- Migration 036 — Inventory movements with audit trail
-- Adds inventory_movements table and adjust_product_stock RPC.
-- No cost/supplier/accounting fields (Fase 1 only).
--
-- Security model:
--   - Authenticated users can only SELECT movements (via RLS).
--   - INSERT is intentionally NOT granted to authenticated role.
--     Movements are created exclusively by the SECURITY DEFINER
--     function adjust_product_stock, which runs with function-owner
--     privileges and validates all business rules atomically.
-- ============================================================

-- ── 1. Create inventory_movements table ──────────────────────

CREATE TABLE public.inventory_movements (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id        uuid          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_location_id uuid          REFERENCES public.store_locations(id) ON DELETE SET NULL,
  movement_type     text          NOT NULL,
  reason            text          NOT NULL,
  quantity_change   integer       NOT NULL,
  stock_before      integer       NOT NULL,
  stock_after       integer       NOT NULL,
  notes             text,
  created_by        uuid          NOT NULL REFERENCES auth.users(id),
  created_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT inventory_movements_type_valid CHECK (
    movement_type IN ('stock_in', 'stock_out', 'manual_adjustment', 'damaged', 'lost', 'returned', 'correction')
  ),
  CONSTRAINT inventory_movements_stock_after_ok  CHECK (stock_after >= 0),
  CONSTRAINT inventory_movements_reason_not_empty CHECK (trim(reason) <> '')
);

COMMENT ON TABLE public.inventory_movements IS
  'Audit log of manual stock adjustments. Write-only via adjust_product_stock RPC. No cost/supplier data (Fase 1).';

-- ── 2. Indexes ────────────────────────────────────────────────

CREATE INDEX idx_inventory_movements_product_id
  ON public.inventory_movements(product_id);

CREATE INDEX idx_inventory_movements_store_id
  ON public.inventory_movements(store_id);

CREATE INDEX idx_inventory_movements_created_at
  ON public.inventory_movements(created_at DESC);

-- ── 3. RLS ────────────────────────────────────────────────────

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Store members can read their store's movements.
CREATE POLICY "Store members can view inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (is_store_member(store_id));

-- Platform admin has full read access.
CREATE POLICY "Platform admin can view all inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (is_platform_admin());

-- INSERT is intentionally NOT allowed directly from authenticated role.
-- All writes go through adjust_product_stock (SECURITY DEFINER).
-- No INSERT policy is created here.

-- ── 4. Grants ─────────────────────────────────────────────────

-- SELECT only: authenticated users can read movements for their stores (via RLS).
-- INSERT is omitted: only the SECURITY DEFINER function can insert.
GRANT SELECT ON public.inventory_movements TO authenticated;

-- ── 5. RPC: adjust_product_stock ─────────────────────────────
--
-- Atomically updates products.stock and records the movement.
-- p_quantity_change: signed integer (positive = add, negative = remove).
-- Returns: new_stock, movement_id.
--
-- Validations performed server-side:
--   - auth.uid() must not be null
--   - caller must have store role owner/admin/staff or be platform_admin
--   - product must belong to p_store_id
--   - product must have track_inventory = true
--   - p_quantity_change must be non-zero
--   - resulting stock must be >= 0
--   - stock_before, stock_after, created_by are always derived server-side

CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_store_id        uuid,
  p_product_id      uuid,
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
  v_stock_before    integer;
  v_track_inventory boolean;
  v_stock_after     integer;
  v_movement_id     uuid;
  v_user_id         uuid;
BEGIN
  -- 1. Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Must have store role or be platform admin
  IF NOT has_store_role(p_store_id, ARRAY['owner', 'admin', 'staff'])
     AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- 3. Reason must not be blank
  IF trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  -- 4. Delta must be non-zero
  IF p_quantity_change = 0 THEN
    RAISE EXCEPTION 'quantity_change must be non-zero';
  END IF;

  -- 5. Lock product row and verify ownership + track_inventory
  SELECT stock, track_inventory
    INTO v_stock_before, v_track_inventory
    FROM public.products
    WHERE id = p_product_id AND store_id = p_store_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- 6. Product must have inventory tracking enabled
  IF NOT v_track_inventory THEN
    RAISE EXCEPTION 'Product does not have inventory tracking enabled';
  END IF;

  -- 7. Compute and validate resulting stock
  v_stock_after := v_stock_before + p_quantity_change;

  IF v_stock_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, requested removal: %',
      v_stock_before, abs(p_quantity_change);
  END IF;

  -- 8. Update stock atomically
  UPDATE public.products
    SET stock = v_stock_after, updated_at = now()
    WHERE id = p_product_id;

  -- 9. Record movement — stock_before, stock_after, created_by are server-derived
  INSERT INTO public.inventory_movements (
    store_id, product_id, movement_type, reason,
    quantity_change, stock_before, stock_after, notes, created_by
  )
  VALUES (
    p_store_id, p_product_id, p_movement_type, trim(p_reason),
    p_quantity_change, v_stock_before, v_stock_after, p_notes, v_user_id
  )
  RETURNING id INTO v_movement_id;

  RETURN QUERY SELECT v_stock_after, v_movement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_product_stock TO authenticated;
