-- ============================================================
-- Manual verification plan for migration 146
-- Simple accounting: automatic sale income + manual movements.
--
-- Run against staging after migration 146. Replace OWNER_ID_HERE with a
-- real auth.users id. The SQL editor/service role is recommended because
-- the script exercises the same privileged database paths as production.
-- ============================================================

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES (
  '00000146-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
  'Test Accounting 146', 'test-accounting-146', 'Migration verification store.',
  '+57 300 000 0146', 'CO', 'Bogotá', 'COP', 'active'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.store_limits
SET can_use_accounting = false
WHERE store_id = '00000146-1111-1111-1111-111111111111';

-- Existing order created while the module is disabled.
INSERT INTO public.orders (
  id, store_id, customer_name, customer_phone, subtotal, shipping_amount,
  total_amount, currency, status, payment_status, source, payment_method,
  fulfillment_method
)
VALUES (
  '00000146-2222-2222-2222-222222222222',
  '00000146-1111-1111-1111-111111111111', 'Cliente 146', '3000000146',
  100000, 10000, 110000, 'COP', 'pending', 'pending', 'web', 'cash_on_delivery', 'pickup'
);

-- Enabling the module must backfill that sale automatically.
UPDATE public.store_limits
SET can_use_accounting = true
WHERE store_id = '00000146-1111-1111-1111-111111111111';

SELECT entry_type, source, amount, status, description
FROM public.accounting_entries
WHERE order_id = '00000146-2222-2222-2222-222222222222';
-- EXPECT: income, sale, 110000, posted, description beginning "Venta".

-- Order total changes must synchronize the automatic entry.
UPDATE public.orders SET total_amount = 95000
WHERE id = '00000146-2222-2222-2222-222222222222';
SELECT amount FROM public.accounting_entries
WHERE order_id = '00000146-2222-2222-2222-222222222222';
-- EXPECT: 95000.

-- Cancellation voids the sale entry without deleting its history.
UPDATE public.orders SET status = 'cancelled'
WHERE id = '00000146-2222-2222-2222-222222222222';
SELECT status, voided_at IS NOT NULL AS has_voided_at
FROM public.accounting_entries
WHERE order_id = '00000146-2222-2222-2222-222222222222';
-- EXPECT: voided, true.

-- Manual movements use the same ledger and affect the balance.
INSERT INTO public.accounting_entries (
  store_id, entry_type, source, description, category, amount,
  currency, occurred_on, notes
)
VALUES (
  '00000146-1111-1111-1111-111111111111', 'expense', 'manual',
  'Compra de insumos', 'Inventario', 25000, 'COP', CURRENT_DATE, 'Prueba migration 146'
);

SELECT entry_type, source, amount, status
FROM public.accounting_entries
WHERE store_id = '00000146-1111-1111-1111-111111111111'
ORDER BY created_at;
-- EXPECT: one voided automatic sale and one posted manual expense.

DELETE FROM public.accounting_entries WHERE store_id = '00000146-1111-1111-1111-111111111111';
DELETE FROM public.orders WHERE store_id = '00000146-1111-1111-1111-111111111111';
DELETE FROM public.store_limits WHERE store_id = '00000146-1111-1111-1111-111111111111';
DELETE FROM public.stores WHERE id = '00000146-1111-1111-1111-111111111111';

COMMIT;
