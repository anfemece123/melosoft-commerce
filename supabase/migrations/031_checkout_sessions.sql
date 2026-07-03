-- ============================================================
-- Migration 031 — Checkout sessions for Wompi online payment
--
-- A checkout_session holds the validated cart snapshot BEFORE
-- payment is confirmed. NO order is created in the orders table
-- until the Wompi webhook fires and confirms APPROVED.
--
-- Flow:
--   1. Frontend → Edge Function create-wompi-payment
--      (full cart payload: items, customer data, location)
--   2. Edge Function: validates products server-side,
--      calculates total, creates checkout_session,
--      returns Wompi Web Checkout URL
--   3. User completes payment on Wompi
--   4. Wompi → wompi-webhook Edge Function:
--      creates real order from items_snapshot,
--      marks checkout_session approved + stores order_id
--
-- Security notes:
--   - anon can INSERT (public checkout) but not SELECT
--   - store members can SELECT their store's sessions
--   - service_role bypasses RLS (webhook uses service_role key)
--   - get_payment_result() RPC exposes only status + order_number
--     (no PII) to anon callers (used by PaymentResultPage)
-- ============================================================

-- ── 1. checkout_sessions table ───────────────────────────────

CREATE TABLE public.checkout_sessions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  store_slug            text        NOT NULL,
  store_location_id     uuid        REFERENCES public.store_locations(id),
  provider              text        NOT NULL DEFAULT 'wompi',
  provider_reference    text        NOT NULL UNIQUE,
  amount_in_cents       integer     NOT NULL,
  currency              text        NOT NULL DEFAULT 'COP',
  status                text        NOT NULL DEFAULT 'created'
                          CHECK (status IN ('created','pending','approved','declined','expired','error')),
  customer_name         text        NOT NULL,
  customer_phone        text        NOT NULL,
  customer_email        text,
  fulfillment_method    text        NOT NULL DEFAULT 'delivery',
  shipping_address      text,
  city                  text,
  department            text,
  delivery_neighborhood text,
  delivery_reference    text,
  notes                 text,
  items_snapshot        jsonb       NOT NULL DEFAULT '[]',
  total_amount          numeric     NOT NULL,
  checkout_url          text        NOT NULL,
  order_id              uuid        REFERENCES public.orders(id),
  wompi_transaction_id  text,
  expires_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER checkout_sessions_updated_at
  BEFORE UPDATE ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_checkout_sessions_store_id
  ON public.checkout_sessions(store_id);

CREATE INDEX idx_checkout_sessions_provider_reference
  ON public.checkout_sessions(provider_reference);

CREATE INDEX idx_checkout_sessions_order_id
  ON public.checkout_sessions(order_id)
  WHERE order_id IS NOT NULL;

-- ── 2. Row Level Security ─────────────────────────────────────

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Anon can insert from public storefront checkout
CREATE POLICY "checkout_sessions_insert_anon"
  ON public.checkout_sessions
  FOR INSERT TO anon
  WITH CHECK (true);

-- Store members can read sessions for their store
CREATE POLICY "checkout_sessions_select_members"
  ON public.checkout_sessions
  FOR SELECT TO authenticated
  USING (public.is_store_member(store_id));

-- Platform admin can read all sessions
CREATE POLICY "checkout_sessions_select_admin"
  ON public.checkout_sessions
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Grants
GRANT INSERT ON public.checkout_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.checkout_sessions TO authenticated;
GRANT ALL PRIVILEGES ON public.checkout_sessions TO service_role;

-- ── 3. get_payment_result RPC ────────────────────────────────
-- Safe public RPC: returns only status + order_number.
-- No PII is exposed. Callable by anon for PaymentResultPage.

CREATE OR REPLACE FUNCTION public.get_payment_result(p_reference text)
RETURNS TABLE (
  session_status text,
  order_number   text,
  order_status   text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.status,
    o.order_number,
    o.status
  FROM public.checkout_sessions cs
  LEFT JOIN public.orders o ON o.id = cs.order_id
  WHERE cs.provider_reference = p_reference
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_result(text) TO anon, authenticated;

-- ── 4. SQL to identify pre-migration dangling orders ─────────
-- Orders created with payment_method='online' and payment_status='pending'
-- that have no approved payment_transaction. Safe to review; do NOT
-- delete automatically — the store owner may have offline confirmation.
--
-- Run this query manually to find candidates:
--
-- SELECT o.id, o.order_number, o.store_id, o.created_at, o.total_amount
-- FROM public.orders o
-- WHERE o.payment_method = 'online'
--   AND o.payment_status = 'pending'
--   AND NOT EXISTS (
--     SELECT 1 FROM public.payment_transactions pt
--     WHERE pt.order_id = o.id
--       AND pt.status = 'approved'
--   );
