-- ============================================================
-- Migration 146 — Simple accounting module
--
-- A small, practical ledger for each store:
--   - sale income is created automatically from orders;
--   - other income and expenses are entered manually;
--   - the platform admin controls the module per store.
--
-- This is intentionally not a double-entry accounting system. It is an
-- operational cash-flow ledger designed to be understandable to any owner.
-- ============================================================

-- ── 1. Platform-controlled module entitlement ───────────────

ALTER TABLE public.store_limits
  ADD COLUMN IF NOT EXISTS can_use_accounting boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.store_limits.can_use_accounting IS
  'Platform-admin entitlement for the simple income and expense ledger.';

-- ── 2. Unified income/expense ledger ────────────────────────

CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  entry_type   text NOT NULL,
  source       text NOT NULL DEFAULT 'manual',
  order_id     uuid UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  description  text NOT NULL,
  category     text NOT NULL DEFAULT 'Otros',
  amount       numeric(12,2) NOT NULL,
  currency     text NOT NULL DEFAULT 'COP',
  occurred_on  date NOT NULL DEFAULT CURRENT_DATE,
  status       text NOT NULL DEFAULT 'posted',
  notes        text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_at   timestamptz,
  voided_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT accounting_entries_type_valid CHECK (entry_type IN ('income', 'expense')),
  CONSTRAINT accounting_entries_source_valid CHECK (source IN ('sale', 'manual')),
  CONSTRAINT accounting_entries_amount_valid CHECK (amount > 0),
  CONSTRAINT accounting_entries_status_valid CHECK (status IN ('posted', 'voided')),
  CONSTRAINT accounting_entries_description_valid CHECK (char_length(btrim(description)) BETWEEN 2 AND 180),
  CONSTRAINT accounting_entries_category_valid CHECK (char_length(btrim(category)) BETWEEN 2 AND 80),
  CONSTRAINT accounting_entries_origin_valid CHECK (
    (source = 'sale' AND entry_type = 'income' AND order_id IS NOT NULL)
    OR (source = 'manual' AND order_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_accounting_entries_store_date
  ON public.accounting_entries(store_id, occurred_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_store_status
  ON public.accounting_entries(store_id, status);

DROP TRIGGER IF EXISTS accounting_entries_updated_at ON public.accounting_entries;
CREATE TRIGGER accounting_entries_updated_at
  BEFORE UPDATE ON public.accounting_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.accounting_entries IS
  'Simple store cash-flow ledger. Sale income is system-generated; other entries are manual.';

-- ── 3. RLS and grants ──────────────────────────────────────

ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_entries_select_platform_admin ON public.accounting_entries;
CREATE POLICY accounting_entries_select_platform_admin ON public.accounting_entries
  FOR SELECT TO authenticated USING (public.is_platform_admin());

DROP POLICY IF EXISTS accounting_entries_select_owner_admin ON public.accounting_entries;
CREATE POLICY accounting_entries_select_owner_admin ON public.accounting_entries
  FOR SELECT TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']));

DROP POLICY IF EXISTS accounting_entries_insert_manual ON public.accounting_entries;
CREATE POLICY accounting_entries_insert_manual ON public.accounting_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND source = 'manual'
    AND order_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.store_limits sl
      WHERE sl.store_id = accounting_entries.store_id
        AND sl.can_use_accounting = true
    )
  );

DROP POLICY IF EXISTS accounting_entries_update_manual ON public.accounting_entries;
CREATE POLICY accounting_entries_update_manual ON public.accounting_entries
  FOR UPDATE TO authenticated
  USING (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND source = 'manual'
  )
  WITH CHECK (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND source = 'manual'
    AND order_id IS NULL
  );

GRANT SELECT ON public.accounting_entries TO authenticated;
GRANT INSERT (
  store_id, entry_type, source, description, category, amount,
  currency, occurred_on, notes
) ON public.accounting_entries TO authenticated;
GRANT UPDATE (
  entry_type, description, category, amount, currency, occurred_on,
  notes, status, voided_at, voided_by
) ON public.accounting_entries TO authenticated;
GRANT ALL ON public.accounting_entries TO service_role;

-- ── 4. Automatic sale synchronization ──────────────────────

CREATE OR REPLACE FUNCTION public.sync_accounting_sale_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_enabled boolean;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(sl.can_use_accounting, false)
    INTO v_enabled
  FROM public.store_limits sl
  WHERE sl.store_id = v_order.store_id;
  IF NOT COALESCE(v_enabled, false) THEN RETURN; END IF;

  IF v_order.status = 'cancelled' THEN
    UPDATE public.accounting_entries
    SET status = 'voided',
        voided_at = COALESCE(voided_at, now()),
        updated_at = now()
    WHERE order_id = v_order.id
      AND source = 'sale'
      AND status = 'posted';
    RETURN;
  END IF;

  INSERT INTO public.accounting_entries (
    store_id, entry_type, source, order_id, description, category,
    amount, currency, occurred_on, status
  ) VALUES (
    v_order.store_id, 'income', 'sale', v_order.id,
    'Venta ' || COALESCE(v_order.order_number, substring(v_order.id::text, 1, 8)),
    'Ventas', GREATEST(COALESCE(v_order.total_amount, 0), 0),
    COALESCE(v_order.currency, 'COP'),
    COALESCE(v_order.created_at::date, CURRENT_DATE), 'posted'
  )
  ON CONFLICT (order_id) DO UPDATE SET
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    status = 'posted',
    voided_at = NULL,
    voided_by = NULL,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.sync_accounting_sale_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_accounting_sale_for_order(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_accounting_on_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sync_accounting_sale_for_order(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_sync_accounting_entry ON public.orders;
CREATE TRIGGER orders_sync_accounting_entry
  AFTER INSERT OR UPDATE OF total_amount, status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_accounting_on_order_change();

CREATE OR REPLACE FUNCTION public.sync_accounting_sales_for_store(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.accounting_entries (
    store_id, entry_type, source, order_id, description, category,
    amount, currency, occurred_on, status
  )
  SELECT
    o.store_id, 'income', 'sale', o.id,
    'Venta ' || COALESCE(o.order_number, substring(o.id::text, 1, 8)),
    'Ventas', GREATEST(COALESCE(o.total_amount, 0), 0),
    COALESCE(o.currency, 'COP'), COALESCE(o.created_at::date, CURRENT_DATE), 'posted'
  FROM public.orders o
  WHERE o.store_id = p_store_id
    AND o.status <> 'cancelled'
  ON CONFLICT (order_id) DO UPDATE SET
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    status = 'posted',
    voided_at = NULL,
    voided_by = NULL,
    updated_at = now();

  UPDATE public.accounting_entries ae
  SET status = 'voided',
      voided_at = COALESCE(ae.voided_at, now()),
      updated_at = now()
  WHERE ae.store_id = p_store_id
    AND ae.source = 'sale'
    AND ae.status = 'posted'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = ae.order_id AND o.status = 'cancelled'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_accounting_sales_for_store(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_accounting_sales_for_store(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_accounting_on_limit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.can_use_accounting = true AND COALESCE(OLD.can_use_accounting, false) = false THEN
    PERFORM public.sync_accounting_sales_for_store(NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_limits_sync_accounting ON public.store_limits;
CREATE TRIGGER store_limits_sync_accounting
  AFTER UPDATE OF can_use_accounting ON public.store_limits
  FOR EACH ROW EXECUTE FUNCTION public.sync_accounting_on_limit_change();

COMMENT ON FUNCTION public.sync_accounting_sale_for_order(uuid) IS
  'Keeps one posted/voided sale income entry synchronized with an order total and status.';

