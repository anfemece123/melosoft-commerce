-- ============================================================
-- Migration 092 — checkout_sessions gains 'paid_stock_unavailable'
--
-- Closes the remaining edge case from the Wompi stock reservation work
-- (091): a customer starts paying, the reservation expires and gets
-- released by the deferred-expiration sweep (because another checkout
-- attempt for the same product ran the sweep first), the freed stock
-- gets sold elsewhere, and only THEN does Wompi's APPROVED webhook
-- arrive for the original, now-unbacked payment. Before this migration,
-- wompi-webhook had no way to tell "this reservation is still good" from
-- "this reservation was already given back" — it just linked whichever
-- checkout_reserved movement it found, stale or not, and created a
-- normal order regardless.
--
-- Per explicit decision: do NOT silently create an order backed by
-- stock that's no longer guaranteed, and do NOT auto-re-reserve. A
-- payment that arrives after its reservation was released is money
-- Wompi actually captured with nothing safely reserved to fulfill it —
-- that's a business decision (refund, backorder, contact customer), not
-- something to paper over automatically. This status makes that case
-- queryable/visible instead of indistinguishable from a normal order.
-- ============================================================

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Found via constraint_column_usage (which columns a constraint
  -- actually references) rather than guessing the auto-generated name
  -- or string-matching the constraint definition — robust regardless of
  -- how Postgres named the original inline CHECK on this column.
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'checkout_sessions'
    AND tc.constraint_type = 'CHECK'
    AND ccu.column_name = 'status'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.checkout_sessions DROP CONSTRAINT %I', v_constraint_name);
  ELSE
    RAISE EXCEPTION 'Could not find the existing status CHECK constraint on checkout_sessions — aborting to avoid ending up with two conflicting CHECK constraints on the same column.';
  END IF;
END $$;

ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_status_valid
  CHECK (status IN ('created', 'pending', 'approved', 'declined', 'expired', 'error', 'paid_stock_unavailable'));
