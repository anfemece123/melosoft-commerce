-- ============================================================
-- Manual verification plan for migration 148
-- Reusable product-option library.
--
-- Run after migration 148. Replace OWNER_ID_HERE with a real auth.users id.
-- The script assumes the product-option fixtures from the project migrations
-- are available and rolls its own test rows back at the end.
-- ============================================================

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES (
  '00000148-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
  'Test Option Library 148', 'test-option-library-148', 'Migration verification store.',
  '+57 300 000 0148', 'CO', 'Bogotá', 'COP', 'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (
  id, store_id, owner_id, name, slug, description, regular_price, stock,
  status, is_available, show_in_ecommerce, show_in_carta
)
VALUES
  ('00000148-2222-2222-2222-222222222222', '00000148-1111-1111-1111-111111111111', 'OWNER_ID_HERE', 'Plato 148', 'plato-148', 'Fixture', 30000, 10, 'active', true, true, true),
  ('00000148-3333-3333-3333-333333333333', '00000148-1111-1111-1111-111111111111', 'OWNER_ID_HERE', 'Salsa 148', 'salsa-148', 'Fixture', 4000, 10, 'active', true, true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_groups (
  id, store_id, product_id, owner_id, name, selection_type, min_select,
  max_select, is_required, is_active, sort_order
)
VALUES (
  '00000148-4444-4444-4444-444444444444', '00000148-1111-1111-1111-111111111111',
  '00000148-2222-2222-2222-222222222222', 'OWNER_ID_HERE', 'Salsas', 'single', 0, 1, false, true, 0
);

INSERT INTO public.product_option_items (
  id, store_id, group_id, owner_id, label, description, price_delta,
  linked_product_id, linked_quantity, price_mode, is_default, is_active, sort_order
)
VALUES (
  '00000148-5555-5555-5555-555555555555', '00000148-1111-1111-1111-111111111111',
  '00000148-4444-4444-4444-444444444444', 'OWNER_ID_HERE', 'Salsa de ajo', 'Fixture', 2500,
  '00000148-3333-3333-3333-333333333333', 1, 'custom', false, true, 0
);

-- The insert trigger automatically creates the reusable library item.
SELECT label, price_delta, linked_product_id, is_active
FROM public.store_product_option_library
WHERE store_id = '00000148-1111-1111-1111-111111111111'
  AND label = 'Salsa de ajo';
-- EXPECT: one active row with price 2500 and the linked product id.

-- The library is company-scoped and does not allow duplicate labels.
SELECT count(*) AS matching_library_items
FROM public.store_product_option_library
WHERE store_id = '00000148-1111-1111-1111-111111111111'
  AND lower(label) = lower('Salsa de ajo');
-- EXPECT: 1.

UPDATE public.store_product_option_library
SET is_active = false
WHERE store_id = '00000148-1111-1111-1111-111111111111'
  AND label = 'Salsa de ajo';

SELECT is_active
FROM public.store_product_option_library
WHERE store_id = '00000148-1111-1111-1111-111111111111'
  AND label = 'Salsa de ajo';
-- EXPECT: false; existing dish option remains intact.

DELETE FROM public.product_option_items WHERE store_id = '00000148-1111-1111-1111-111111111111';
DELETE FROM public.product_option_groups WHERE store_id = '00000148-1111-1111-1111-111111111111';
DELETE FROM public.store_product_option_library WHERE store_id = '00000148-1111-1111-1111-111111111111';
DELETE FROM public.products WHERE store_id = '00000148-1111-1111-1111-111111111111';
DELETE FROM public.stores WHERE id = '00000148-1111-1111-1111-111111111111';

COMMIT;
