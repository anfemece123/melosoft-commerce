-- ============================================================
-- Manual verification plan for migration 147
-- Accounting categories: defaults, custom categories and history safety.
--
-- Run after migration 147. Replace OWNER_ID_HERE with a real auth.users id.
-- Use the SQL editor/service role because the script exercises privileged
-- database paths and rolls all test data back at the end.
-- ============================================================

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES (
  '00000147-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
  'Test Accounting Categories 147', 'test-accounting-categories-147', 'Migration verification store.',
  '+57 300 000 0147', 'CO', 'Bogotá', 'COP', 'active'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.store_limits
SET can_use_accounting = false
WHERE store_id = '00000147-1111-1111-1111-111111111111';

INSERT INTO public.orders (
  id, store_id, customer_name, customer_phone, subtotal, shipping_amount,
  total_amount, currency, status, payment_status, source, payment_method,
  fulfillment_method
)
VALUES (
  '00000147-2222-2222-2222-222222222222',
  '00000147-1111-1111-1111-111111111111', 'Cliente 147', '3000000147',
  100000, 10000, 110000, 'COP', 'pending', 'pending', 'web', 'cash_on_delivery', 'pickup'
);

-- Enabling the module seeds the standard catalog and backfills the sale.
UPDATE public.store_limits
SET can_use_accounting = true
WHERE store_id = '00000147-1111-1111-1111-111111111111';

SELECT COUNT(*) AS default_category_count
FROM public.accounting_categories
WHERE store_id = '00000147-1111-1111-1111-111111111111';
-- EXPECT: 13.

SELECT category_id IS NOT NULL AS sale_has_category, category
FROM public.accounting_entries
WHERE order_id = '00000147-2222-2222-2222-222222222222';
-- EXPECT: true, Ventas.

-- A company can add a category for its own operating language.
INSERT INTO public.accounting_categories (store_id, name, entry_type)
VALUES ('00000147-1111-1111-1111-111111111111', 'Transporte y logística', 'expense');

INSERT INTO public.accounting_entries (
  store_id, entry_type, source, description, category, category_id,
  amount, currency, occurred_on, notes
)
SELECT
  '00000147-1111-1111-1111-111111111111', 'expense', 'manual',
  'Flete de prueba', ac.name, ac.id, 25000, 'COP', CURRENT_DATE, 'Prueba migration 147'
FROM public.accounting_categories ac
WHERE ac.store_id = '00000147-1111-1111-1111-111111111111'
  AND ac.name = 'Transporte y logística';

-- Deactivation hides a category from new forms but preserves its entries.
UPDATE public.accounting_categories
SET is_active = false
WHERE store_id = '00000147-1111-1111-1111-111111111111'
  AND name = 'Transporte y logística';

SELECT ac.is_active, ae.category, ae.category_id IS NOT NULL AS history_kept
FROM public.accounting_categories ac
JOIN public.accounting_entries ae ON ae.category_id = ac.id
WHERE ac.store_id = '00000147-1111-1111-1111-111111111111'
  AND ac.name = 'Transporte y logística';
-- EXPECT: false, Transporte y logística, true.

DELETE FROM public.accounting_entries WHERE store_id = '00000147-1111-1111-1111-111111111111';
DELETE FROM public.accounting_categories WHERE store_id = '00000147-1111-1111-1111-111111111111';
DELETE FROM public.orders WHERE store_id = '00000147-1111-1111-1111-111111111111';
DELETE FROM public.store_limits WHERE store_id = '00000147-1111-1111-1111-111111111111';
DELETE FROM public.stores WHERE id = '00000147-1111-1111-1111-111111111111';

COMMIT;
