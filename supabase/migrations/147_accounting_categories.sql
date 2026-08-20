-- ============================================================
-- Migration 147 — Accounting categories
--
-- Categories stay intentionally lightweight: they make the ledger easier
-- to understand and report on without turning it into a double-entry system.
-- Each store owns its category catalog. The initial categories are seeded
-- when the module is enabled, and can be deactivated without deleting the
-- history that already uses them.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.accounting_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name         text NOT NULL,
  entry_type   text NOT NULL DEFAULT 'both',
  is_system    boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT accounting_categories_name_valid CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  CONSTRAINT accounting_categories_type_valid CHECK (entry_type IN ('income', 'expense', 'both'))
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_categories_store_name_unique
  ON public.accounting_categories(store_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_accounting_categories_store_status
  ON public.accounting_categories(store_id, is_active, name);

DROP TRIGGER IF EXISTS accounting_categories_updated_at ON public.accounting_categories;
CREATE TRIGGER accounting_categories_updated_at
  BEFORE UPDATE ON public.accounting_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_categories_select_platform_admin ON public.accounting_categories;
CREATE POLICY accounting_categories_select_platform_admin ON public.accounting_categories
  FOR SELECT TO authenticated USING (public.is_platform_admin());

DROP POLICY IF EXISTS accounting_categories_select_owner_admin ON public.accounting_categories;
CREATE POLICY accounting_categories_select_owner_admin ON public.accounting_categories
  FOR SELECT TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']));

DROP POLICY IF EXISTS accounting_categories_insert ON public.accounting_categories;
CREATE POLICY accounting_categories_insert ON public.accounting_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND is_system = false
    AND EXISTS (
      SELECT 1 FROM public.store_limits sl
      WHERE sl.store_id = accounting_categories.store_id
        AND sl.can_use_accounting = true
    )
  );

DROP POLICY IF EXISTS accounting_categories_update ON public.accounting_categories;
CREATE POLICY accounting_categories_update ON public.accounting_categories
  FOR UPDATE TO authenticated
  USING (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND EXISTS (
      SELECT 1 FROM public.store_limits sl
      WHERE sl.store_id = accounting_categories.store_id
        AND sl.can_use_accounting = true
    )
  )
  WITH CHECK (
    (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
    AND EXISTS (
      SELECT 1 FROM public.store_limits sl
      WHERE sl.store_id = accounting_categories.store_id
        AND sl.can_use_accounting = true
    )
  );

GRANT SELECT ON public.accounting_categories TO authenticated;
GRANT INSERT (store_id, name, entry_type) ON public.accounting_categories TO authenticated;
GRANT UPDATE (name, entry_type, is_active) ON public.accounting_categories TO authenticated;
GRANT ALL ON public.accounting_categories TO service_role;

CREATE OR REPLACE FUNCTION public.protect_accounting_system_category()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system = true
     AND (NEW.name IS DISTINCT FROM OLD.name OR NEW.entry_type IS DISTINCT FROM OLD.entry_type OR NEW.is_system IS DISTINCT FROM OLD.is_system) THEN
    RAISE EXCEPTION 'Las categorías predeterminadas no se pueden editar';
  END IF;
  IF OLD.is_system = true AND lower(OLD.name) = lower('Ventas') AND NEW.is_active = false THEN
    RAISE EXCEPTION 'La categoría Ventas debe permanecer activa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounting_categories_protect_system ON public.accounting_categories;
CREATE TRIGGER accounting_categories_protect_system
  BEFORE UPDATE ON public.accounting_categories
  FOR EACH ROW EXECUTE FUNCTION public.protect_accounting_system_category();

ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.accounting_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_entries_store_category
  ON public.accounting_entries(store_id, category_id);

GRANT INSERT (
  store_id, entry_type, source, description, category, category_id, amount,
  currency, occurred_on, notes
) ON public.accounting_entries TO authenticated;
GRANT UPDATE (
  entry_type, description, category, category_id, amount, currency, occurred_on,
  notes, status, voided_at, voided_by
) ON public.accounting_entries TO authenticated;

-- The category id must always belong to the same company as the entry. The
-- text category remains a historical snapshot and is intentionally retained.
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
    AND EXISTS (
      SELECT 1 FROM public.accounting_categories ac
      WHERE ac.id = accounting_entries.category_id
        AND ac.store_id = accounting_entries.store_id
        AND ac.is_active = true
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
    AND (accounting_entries.category_id IS NULL OR EXISTS (
      SELECT 1 FROM public.accounting_categories ac
      WHERE ac.id = accounting_entries.category_id
        AND ac.store_id = accounting_entries.store_id
    ))
  );

-- Defaults are data, not hard-coded UI suggestions. This gives every company
-- a useful starting point while keeping the catalog fully company-specific.
CREATE OR REPLACE FUNCTION public.seed_accounting_categories_for_store(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.accounting_categories (store_id, name, entry_type, is_system)
  VALUES
    (p_store_id, 'Ventas', 'income', true),
    (p_store_id, 'Servicios', 'both', true),
    (p_store_id, 'Otros ingresos', 'income', true),
    (p_store_id, 'Inventario', 'expense', true),
    (p_store_id, 'Domicilios y envíos', 'expense', true),
    (p_store_id, 'Publicidad y marketing', 'expense', true),
    (p_store_id, 'Nómina y honorarios', 'expense', true),
    (p_store_id, 'Arriendo', 'expense', true),
    (p_store_id, 'Servicios públicos', 'expense', true),
    (p_store_id, 'Impuestos', 'expense', true),
    (p_store_id, 'Comisiones', 'expense', true),
    (p_store_id, 'Equipos y mantenimiento', 'expense', true),
    (p_store_id, 'Otros', 'both', true)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_accounting_categories_for_store(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_accounting_categories_for_store(uuid) TO service_role;

-- Keep automatic sales linked to the managed "Ventas" category while also
-- preserving the text snapshot on the entry for readable historical data.
CREATE OR REPLACE FUNCTION public.sync_accounting_sale_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_enabled boolean;
  v_category_id uuid;
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

  SELECT ac.id INTO v_category_id
  FROM public.accounting_categories ac
  WHERE ac.store_id = v_order.store_id
    AND lower(ac.name) = lower('Ventas')
    AND ac.is_active = true
  LIMIT 1;

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
    store_id, entry_type, source, order_id, description, category, category_id,
    amount, currency, occurred_on, status
  ) VALUES (
    v_order.store_id, 'income', 'sale', v_order.id,
    'Venta ' || COALESCE(v_order.order_number, substring(v_order.id::text, 1, 8)),
    'Ventas', v_category_id, GREATEST(COALESCE(v_order.total_amount, 0), 0),
    COALESCE(v_order.currency, 'COP'),
    COALESCE(v_order.created_at::date, CURRENT_DATE), 'posted'
  )
  ON CONFLICT (order_id) DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    category_id = EXCLUDED.category_id,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    status = 'posted',
    voided_at = NULL,
    voided_by = NULL,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_accounting_sales_for_store(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.accounting_entries (
    store_id, entry_type, source, order_id, description, category, category_id,
    amount, currency, occurred_on, status
  )
  SELECT
    o.store_id, 'income', 'sale', o.id,
    'Venta ' || COALESCE(o.order_number, substring(o.id::text, 1, 8)),
    'Ventas', ac.id, GREATEST(COALESCE(o.total_amount, 0), 0),
    COALESCE(o.currency, 'COP'), COALESCE(o.created_at::date, CURRENT_DATE), 'posted'
  FROM public.orders o
  LEFT JOIN LATERAL (
    SELECT category.id
    FROM public.accounting_categories category
    WHERE category.store_id = o.store_id
      AND lower(category.name) = lower('Ventas')
      AND category.is_active = true
    LIMIT 1
  ) ac ON true
  WHERE o.store_id = p_store_id
    AND o.status <> 'cancelled'
  ON CONFLICT (order_id) DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    category_id = EXCLUDED.category_id,
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

CREATE OR REPLACE FUNCTION public.sync_accounting_on_limit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.can_use_accounting = true AND COALESCE(OLD.can_use_accounting, false) = false THEN
    PERFORM public.seed_accounting_categories_for_store(NEW.store_id);
    PERFORM public.sync_accounting_sales_for_store(NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Upgrade stores that already had the module enabled before categories
-- existed, then attach their historical automatic sales to "Ventas".
SELECT public.seed_accounting_categories_for_store(sl.store_id)
FROM public.store_limits sl
WHERE sl.can_use_accounting = true;

UPDATE public.accounting_entries ae
SET category_id = ac.id
FROM public.accounting_categories ac
WHERE ae.category_id IS NULL
  AND ae.store_id = ac.store_id
  AND lower(ae.category) = lower(ac.name);

SELECT public.sync_accounting_sales_for_store(sl.store_id)
FROM public.store_limits sl
WHERE sl.can_use_accounting = true;

COMMENT ON TABLE public.accounting_categories IS
  'Company-specific categories for the simple accounting ledger. Categories are deactivated, never deleted, to preserve history.';
