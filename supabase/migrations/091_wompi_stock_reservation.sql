-- ============================================================
-- Migration 091 — Wompi stock reservation
--
-- Problem: create-wompi-payment builds a checkout_session with a priced
-- snapshot but never touches stock. wompi-webhook creates the real order
-- from that snapshot when Wompi approves, also without touching stock.
-- Between those two moments (customer on Wompi's payment page) nothing
-- stops the same last unit from being sold through another channel —
-- the customer can finish paying for something that's no longer
-- available. See the Prioridad 3 (Wompi) diagnosis for the full
-- analysis and the 3 options compared; this implements the approved
-- one: reserve stock (a REAL decrement, not a separate counter) the
-- moment create-wompi-payment runs, audited through inventory_movements
-- (no new stock_reservations table), released if the payment fails or
-- the checkout expires, and simply left in place (linked to the order)
-- if it's approved — never decremented a second time.
--
-- Does NOT touch create_store_order or cancel_store_order — this is a
-- parallel path for the Wompi flow only, sharing the inventory_movements
-- table as its audit trail but none of its logic.
--
-- ============================================================
-- 1. inventory_movements — link to checkout_sessions, new movement types
-- ============================================================
--
-- checkout_session_id: nullable, ON DELETE SET NULL — same convention
-- as order_id/order_item_id (migration 088). A movement's audit value
-- (what happened to the stock, when, how much) should outlive the
-- session row it originated from.
--
-- movement_type gains 'checkout_reserved' (real decrement the instant a
-- Wompi checkout starts) and 'checkout_released' (reversal — payment
-- failed/declined/voided, or the checkout expired unused).

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid REFERENCES public.checkout_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_type_valid;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_type_valid CHECK (
    movement_type IN (
      'stock_in', 'stock_out', 'manual_adjustment', 'damaged', 'lost', 'returned', 'correction',
      'order_placed', 'order_cancelled',
      'checkout_reserved', 'checkout_released'
    )
  );

-- ── Indexes ───────────────────────────────────────────────────
-- Partial index (only reservation-linked rows) mirrors idx_..._order_id
-- from migration 088 — most rows never have this column set.
CREATE INDEX IF NOT EXISTS idx_inventory_movements_checkout_session_id
  ON public.inventory_movements(checkout_session_id) WHERE checkout_session_id IS NOT NULL;

-- Composite lookup for "movements affecting this exact SKU" — used by
-- the reservation/release functions below (and generally useful for the
-- owner-facing movement history later).
CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_product_variant
  ON public.inventory_movements(store_id, product_id, variant_id);

-- ============================================================
-- 2. release_wompi_reservation_by_session — reverses every
--    'checkout_reserved' movement for one checkout_session that hasn't
--    already been reversed. Used directly by wompi-webhook (payment
--    declined/error/voided) and internally by the expiration sweep
--    below. Idempotent by construction: a movement only ever gets one
--    matching 'checkout_released' (checked via NOT EXISTS), so calling
--    this twice for the same session releases nothing the second time.
-- ============================================================

CREATE OR REPLACE FUNCTION public.release_wompi_reservation_by_session(
  p_checkout_session_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_movement        record;
  v_stock_before    integer;
  v_stock_after     integer;
  v_released_count  integer := 0;
BEGIN
  FOR v_movement IN
    SELECT im.id, im.store_id, im.product_id, im.variant_id, im.quantity_change
    FROM inventory_movements im
    WHERE im.checkout_session_id = p_checkout_session_id
      AND im.movement_type = 'checkout_reserved'
      AND NOT EXISTS (
        SELECT 1 FROM inventory_movements rel
        WHERE rel.checkout_session_id = im.checkout_session_id
          AND rel.movement_type = 'checkout_released'
          AND rel.product_id = im.product_id
          AND rel.variant_id IS NOT DISTINCT FROM im.variant_id
      )
  LOOP
    IF v_movement.variant_id IS NOT NULL THEN
      SELECT stock_quantity INTO v_stock_before
      FROM product_variants WHERE id = v_movement.variant_id
      FOR UPDATE;

      v_stock_after := v_stock_before + abs(v_movement.quantity_change);

      UPDATE product_variants SET stock_quantity = v_stock_after, updated_at = now()
      WHERE id = v_movement.variant_id;
    ELSE
      SELECT stock INTO v_stock_before
      FROM products WHERE id = v_movement.product_id
      FOR UPDATE;

      v_stock_after := v_stock_before + abs(v_movement.quantity_change);

      UPDATE products SET stock = v_stock_after, updated_at = now()
      WHERE id = v_movement.product_id;
    END IF;

    INSERT INTO inventory_movements (
      store_id, product_id, variant_id, checkout_session_id,
      movement_type, reason, quantity_change, stock_before, stock_after, created_by
    ) VALUES (
      v_movement.store_id, v_movement.product_id, v_movement.variant_id, p_checkout_session_id,
      'checkout_released', 'Reserva de pago Wompi liberada', abs(v_movement.quantity_change),
      v_stock_before, v_stock_after, NULL
    );

    v_released_count := v_released_count + 1;
  END LOOP;

  RETURN v_released_count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_wompi_reservation_by_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_wompi_reservation_by_session(uuid) TO service_role;

-- ============================================================
-- 3. release_expired_wompi_reservations — liberación diferida (no
--    pg_cron): finds checkout_sessions for this exact product/variant
--    that are past expires_at, still 'created'/'pending', never became
--    a real order, and still have an unreleased reservation — releases
--    each one (via the function above, so idempotency is inherited) and
--    marks the session 'expired'. Scoped to one product/variant on
--    purpose: called right before reserving stock for that same
--    product/variant, so it only ever does the minimum work needed to
--    make the current attempt succeed if it legitimately can.
-- ============================================================

CREATE OR REPLACE FUNCTION public.release_expired_wompi_reservations(
  p_store_id   uuid,
  p_product_id uuid,
  p_variant_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_id      uuid;
  v_total_released  integer := 0;
BEGIN
  FOR v_session_id IN
    SELECT DISTINCT cs.id
    FROM checkout_sessions cs
    JOIN inventory_movements im ON im.checkout_session_id = cs.id
    WHERE cs.store_id = p_store_id
      AND cs.expires_at IS NOT NULL
      AND cs.expires_at < now()
      AND cs.status IN ('created', 'pending')
      AND cs.order_id IS NULL
      AND im.movement_type = 'checkout_reserved'
      AND im.product_id = p_product_id
      AND im.variant_id IS NOT DISTINCT FROM p_variant_id
      AND NOT EXISTS (
        SELECT 1 FROM inventory_movements rel
        WHERE rel.checkout_session_id = cs.id
          AND rel.movement_type = 'checkout_released'
          AND rel.product_id = p_product_id
          AND rel.variant_id IS NOT DISTINCT FROM p_variant_id
      )
  LOOP
    v_total_released := v_total_released + public.release_wompi_reservation_by_session(v_session_id);

    UPDATE checkout_sessions SET status = 'expired', updated_at = now()
    WHERE id = v_session_id AND status IN ('created', 'pending');
  END LOOP;

  RETURN v_total_released;
END;
$$;

REVOKE ALL ON FUNCTION public.release_expired_wompi_reservations(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_expired_wompi_reservations(uuid, uuid, uuid) TO service_role;

-- ============================================================
-- 4. create_wompi_checkout_reservation — the atomic reserve step.
--    Called once per checkout (all items together) so it's genuinely
--    "reserve everything or reserve nothing": any RAISE EXCEPTION rolls
--    back every UPDATE/INSERT this call has made so far, because a
--    plpgsql function body is one transaction. product/variant
--    existence, pricing and modifiers are already validated in
--    create-wompi-payment before this is called — this function only
--    knows about product_id/variant_id/quantity, and only does the part
--    that MUST be atomic: check stock, decrement, log it.
--
--    p_items shape: [{product_id, variant_id, quantity}, ...] — same
--    field names as create_store_order's p_items for consistency, minus
--    everything pricing-related (already resolved by the caller).
--
--    Mirrors create_store_order's stock block (migration 088) exactly:
--    variant purchases only ever touch product_variants.stock_quantity
--    (never the parent's products.stock), 'deny' rejects when
--    insufficient, 'allow_backorder' never rejects but clamps the
--    decrement at 0 rather than letting stock_quantity go negative
--    (blocked by its own CHECK constraint either way). Simple products
--    only validate/decrement when track_inventory = true — for
--    track_inventory = false, no movement is recorded, same as today.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_wompi_checkout_reservation(
  p_checkout_session_id uuid,
  p_store_id            uuid,
  p_items               jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item             jsonb;
  v_product_id       uuid;
  v_variant_id       uuid;
  v_qty              integer;
  v_stock_before     integer;
  v_stock_after      integer;
  v_stock_policy     text;
  v_track_inventory  boolean;
  i                  integer;
BEGIN
  IF p_checkout_session_id IS NULL THEN
    RAISE EXCEPTION 'CHECKOUT_SESSION_REQUIRED';
  END IF;

  FOR i IN 0 .. (jsonb_array_length(p_items) - 1)
  LOOP
    v_item       := p_items -> i;
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::uuid;
    v_qty        := (v_item ->> 'quantity')::integer;

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'INVALID_RESERVATION_ITEM';
    END IF;

    -- Liberación diferida: release any expired, still-unreleased
    -- reservation for this exact product/variant before deciding
    -- whether there's enough stock for this new attempt.
    PERFORM public.release_expired_wompi_reservations(p_store_id, v_product_id, v_variant_id);

    IF v_variant_id IS NOT NULL THEN
      SELECT stock_quantity, stock_policy
      INTO v_stock_before, v_stock_policy
      FROM product_variants
      WHERE id = v_variant_id AND product_id = v_product_id AND store_id = p_store_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_VARIANT:%', v_variant_id;
      END IF;

      IF v_stock_policy = 'deny' AND v_stock_before < v_qty THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_variant_id;
      END IF;

      v_stock_after := GREATEST(v_stock_before - v_qty, 0);

      IF v_stock_after <> v_stock_before THEN
        UPDATE product_variants SET stock_quantity = v_stock_after, updated_at = now()
        WHERE id = v_variant_id;

        INSERT INTO inventory_movements (
          store_id, product_id, variant_id, checkout_session_id,
          movement_type, reason, quantity_change, stock_before, stock_after, created_by
        ) VALUES (
          p_store_id, v_product_id, v_variant_id, p_checkout_session_id,
          'checkout_reserved', 'Reserva de pago Wompi', v_stock_after - v_stock_before,
          v_stock_before, v_stock_after, NULL
        );
      END IF;
    ELSE
      SELECT stock, track_inventory
      INTO v_stock_before, v_track_inventory
      FROM products
      WHERE id = v_product_id AND store_id = p_store_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_PRODUCT:%', v_product_id;
      END IF;

      IF v_track_inventory THEN
        IF v_stock_before < v_qty THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_product_id;
        END IF;

        v_stock_after := v_stock_before - v_qty;

        UPDATE products SET stock = v_stock_after, updated_at = now()
        WHERE id = v_product_id;

        INSERT INTO inventory_movements (
          store_id, product_id, variant_id, checkout_session_id,
          movement_type, reason, quantity_change, stock_before, stock_after, created_by
        ) VALUES (
          p_store_id, v_product_id, NULL, p_checkout_session_id,
          'checkout_reserved', 'Reserva de pago Wompi', v_stock_after - v_stock_before,
          v_stock_before, v_stock_after, NULL
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('checkout_session_id', p_checkout_session_id, 'reserved', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_wompi_checkout_reservation(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_wompi_checkout_reservation(uuid, uuid, jsonb) TO service_role;
