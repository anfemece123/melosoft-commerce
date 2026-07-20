-- ============================================================
-- Manual verification plan for migration 087 (modifiers/adiciones
-- pricing) and the Wompi flow that depends on it.
--
-- WHY THIS FILE EXISTS: I (Claude) applied migration 087 to the linked
-- melosoft-commerce project via `supabase db push` and confirmed via the
-- anon-key REST RPC endpoint that create_store_order deploys, compiles,
-- executes, and keeps its EXECUTE grant for anon/authenticated (called it
-- with a nonexistent store_slug — got back the expected controlled
-- `STORE_NOT_FOUND` exception, not a permission or syntax error).
--
-- I could NOT go further: creating test stores/products/option groups and
-- reading back order_item_customizations both require privileges the
-- anon key doesn't have (correctly — RLS is doing its job). I don't have
-- the service_role key or a DB password, and was asked not to request
-- them. This file is the exact, ready-to-run substitute: paste it into
-- the Supabase Dashboard → SQL Editor (which runs with full privileges,
-- so RLS won't block any of this) for the linked project and run it
-- top to bottom.
--
-- HOW TO RUN:
--   1. Replace 70a5a2f1-d224-44c3-859e-bd8b814eb5df below with a real auth.users id (same
--      pattern as supabase/seed/001_seed_dev_data.sql — find one under
--      Dashboard → Authentication → Users, or use any existing store
--      owner's id; this is throwaway test data isolated under its own
--      store, it won't touch that owner's real stores).
--   2. Run section 0 (setup) once.
--   3. Run each numbered scenario block and compare against the
--      "EXPECTED" comment above it.
--   4. Run the cleanup block at the end (safe to re-run; uses
--      ON DELETE CASCADE from the test store).
--
-- All test data uses the store slug 'test-modificadores-087' and ids
-- prefixed with 00000087- so cleanup is a single predictable DELETE.
-- ============================================================

-- ============================================================
-- 0. SETUP — test store, products, variant, modifier groups
-- ============================================================

-- \set owner_id '70a5a2f1-d224-44c3-859e-bd8b814eb5df'  -- ← replace before running (psql), or
                                 -- find/replace 70a5a2f1-d224-44c3-859e-bd8b814eb5df manually if
                                 -- pasting into the Dashboard SQL Editor
                                 -- (which doesn't support \set).

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000087-1111-1111-1111-111111111111', '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Test Modificadores 087', 'test-modificadores-087',
        'Tienda de prueba para migración 087 — borrar después de verificar.', '+57 300 000 0000', 'CO', 'Bogotá', 'COP', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_commerce_settings (
  store_id, business_category, catalog_type, commerce_mode, delivery_mode,
  allows_pickup, allows_local_delivery, allows_national_shipping,
  whatsapp_checkout_enabled, web_order_enabled, cash_on_delivery_enabled, online_checkout_enabled,
  default_order_method
)
VALUES (
  '00000087-1111-1111-1111-111111111111', 'restaurant', 'menu', 'local_delivery_and_pickup', 'pickup_only',
  true, false, false,
  true, true, true, false,
  'web_order'
)
ON CONFLICT (store_id) DO UPDATE SET
  web_order_enabled = true, cash_on_delivery_enabled = true;

-- Product A — simple, no variant, no modifiers (scenario 1)
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, status, category)
VALUES ('00000087-2222-2222-2222-222222222221', '00000087-1111-1111-1111-111111111111', '70a5a2f1-d224-44c3-859e-bd8b814eb5df',
        'Producto Simple Test', 'producto-simple-test-087', 'Sin modificadores.', 20000, NULL, 100, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

-- Product B — has a variant, no modifiers (scenario 2)
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, status, category)
VALUES ('00000087-2222-2222-2222-222222222222', '00000087-1111-1111-1111-111111111111', '70a5a2f1-d224-44c3-859e-bd8b814eb5df',
        'Producto Con Variante Test', 'producto-variante-test-087', 'Con variante Talla.', 30000, NULL, 100, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, is_required, is_active, sort_order)
VALUES ('00000087-5555-5555-5555-555555555551', '00000087-1111-1111-1111-111111111111', '00000087-2222-2222-2222-222222222222',
        '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Talla', 'size', true, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
VALUES ('00000087-5555-5555-5555-555555555552', '00000087-1111-1111-1111-111111111111', '00000087-5555-5555-5555-555555555551',
        '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'L', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variants (
  id,
  store_id,
  product_id,
  owner_id,
  sku,
  option_signature,
  price,
  stock_quantity,
  stock_policy,
  status
)
VALUES (
  '00000087-2222-2222-2222-222222222223',
  '00000087-1111-1111-1111-111111111111',
  '00000087-2222-2222-2222-222222222222',
  '70a5a2f1-d224-44c3-859e-bd8b814eb5df',
  'TEST-L-087',
  '00000087-5555-5555-5555-555555555552',
  35000,
  50,
  'deny',
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id)
VALUES ('00000087-2222-2222-2222-222222222223', '00000087-5555-5555-5555-555555555551', '00000087-5555-5555-5555-555555555552',
        '00000087-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Product C — the modifiers product (scenarios 3, 4, 5, 8, 9)
-- Base price 20.000, matches the example in your spec exactly.
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, status, category)
VALUES ('00000087-2222-2222-2222-222222222224', '00000087-1111-1111-1111-111111111111', '70a5a2f1-d224-44c3-859e-bd8b814eb5df',
        'Hamburguesa Test', 'hamburguesa-test-087', 'Con grupos de modificadores.', 20000, NULL, 100, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

-- Required single-select group ("Tamaño") — used for scenario 8 (required, no selection → reject)
INSERT INTO public.product_option_groups (id, store_id, product_id, owner_id, name, selection_type, min_select, max_select, is_required, is_active, sort_order)
VALUES ('00000087-3333-3333-3333-333333333331', '00000087-1111-1111-1111-111111111111', '00000087-2222-2222-2222-222222222224',
        '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Tamaño', 'single', 1, 1, true, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_items (id, store_id, group_id, owner_id, label, price_delta, is_default, is_active, sort_order)
VALUES
  ('00000087-4444-4444-4444-444444444441', '00000087-1111-1111-1111-111111111111', '00000087-3333-3333-3333-333333333331', '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Sencilla', 0, true, true, 0),
  ('00000087-4444-4444-4444-444444444442', '00000087-1111-1111-1111-111111111111', '00000087-3333-3333-3333-333333333331', '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Doble', 5000, false, true, 1)
ON CONFLICT (id) DO NOTHING;

-- Optional multi-select group ("Adiciones"), max 2 of 3 — used for
-- scenarios 3 (free), 4 (paid), 5 (qty>1), 9 (max_select exceeded)
INSERT INTO public.product_option_groups (id, store_id, product_id, owner_id, name, selection_type, min_select, max_select, is_required, is_active, sort_order)
VALUES ('00000087-3333-3333-3333-333333333332', '00000087-1111-1111-1111-111111111111', '00000087-2222-2222-2222-222222222224',
        '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Adiciones', 'multiple', 0, 2, false, true, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_items (id, store_id, group_id, owner_id, label, price_delta, is_default, is_active, sort_order)
VALUES
  ('00000087-4444-4444-4444-444444444443', '00000087-1111-1111-1111-111111111111', '00000087-3333-3333-3333-333333333332', '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Queso extra', 2000, false, true, 0),
  ('00000087-4444-4444-4444-444444444444', '00000087-1111-1111-1111-111111111111', '00000087-3333-3333-3333-333333333332', '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Tocineta', 3000, false, true, 1),
  ('00000087-4444-4444-4444-444444444445', '00000087-1111-1111-1111-111111111111', '00000087-3333-3333-3333-333333333332', '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Sin cebolla', 0, false, true, 2)
ON CONFLICT (id) DO NOTHING;

-- Product D — a second, unrelated product with its own modifier group,
-- used only for scenario 7 (modifier belongs to a different product).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, status, category)
VALUES ('00000087-2222-2222-2222-222222222225', '00000087-1111-1111-1111-111111111111', '70a5a2f1-d224-44c3-859e-bd8b814eb5df',
        'Producto Otro Test', 'producto-otro-test-087', 'Producto distinto, para probar rechazo cruzado.', 15000, NULL, 100, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_groups (id, store_id, product_id, owner_id, name, selection_type, min_select, max_select, is_required, is_active, sort_order)
VALUES ('00000087-3333-3333-3333-333333333333', '00000087-1111-1111-1111-111111111111', '00000087-2222-2222-2222-222222222225',
        '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Grupo De Otro Producto', 'single', 0, 1, false, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_items (id, store_id, group_id, owner_id, label, price_delta, is_default, is_active, sort_order)
VALUES ('00000087-4444-4444-4444-444444444446', '00000087-1111-1111-1111-111111111111', '00000087-3333-3333-3333-333333333333',
        '70a5a2f1-d224-44c3-859e-bd8b814eb5df', 'Item De Otro Producto', 1000, false, true, 0)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Sanity check: this should return 3 products, 3 groups, 6 items.
SELECT
  (SELECT count(*) FROM products WHERE store_id = '00000087-1111-1111-1111-111111111111') AS products,
  (SELECT count(*) FROM product_option_groups WHERE store_id = '00000087-1111-1111-1111-111111111111') AS groups,
  (SELECT count(*) FROM product_option_items WHERE store_id = '00000087-1111-1111-1111-111111111111') AS items;


-- ============================================================
-- 1. Producto simple sin modificadores
-- EXPECTED: succeeds, total_amount = 20000, order_items has one row with
--           unit_price=20000, and ZERO rows in order_item_customizations.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 1',
  p_customer_phone := '3000000001',
  p_items := '[{"product_id": "00000087-2222-2222-2222-222222222221", "quantity": 1}]'::jsonb
);

-- Verify (replace <order_id> with the order_id from the jsonb result above,
-- or just grab the latest test order):
SELECT o.id, o.total_amount, o.subtotal, oi.unit_price, oi.total_price,
       (SELECT count(*) FROM order_item_customizations WHERE order_item_id = oi.id) AS customization_rows
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.store_id = '00000087-1111-1111-1111-111111111111' AND o.customer_phone = '3000000001'
ORDER BY o.created_at DESC LIMIT 1;
-- EXPECT: total_amount=20000, unit_price=20000, total_price=20000, customization_rows=0


-- ============================================================
-- 2. Producto con variante, sin modificadores
-- EXPECTED: succeeds, unit_price=35000 (variant price overrides base),
--           variant_label_snapshot = 'L', total_amount=35000.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 2',
  p_customer_phone := '3000000002',
  p_items := '[{"product_id": "00000087-2222-2222-2222-222222222222", "variant_id": "00000087-2222-2222-2222-222222222223", "quantity": 1}]'::jsonb
);

SELECT o.total_amount, oi.unit_price, oi.variant_label_snapshot, oi.variant_sku_snapshot
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.store_id = '00000087-1111-1111-1111-111111111111' AND o.customer_phone = '3000000002'
ORDER BY o.created_at DESC LIMIT 1;
-- EXPECT: total_amount=35000, unit_price=35000, variant_label_snapshot='L', variant_sku_snapshot='TEST-L-087'


-- ============================================================
-- 3. Producto menú con modificador SIN costo ("Sin cebolla", +0) +
--    selección requerida de Tamaño ("Sencilla", +0)
-- EXPECTED: succeeds, order_item_customizations gets 2 rows (Sencilla +
--           Sin cebolla), total_amount UNCHANGED at 20000 (both are +0).
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 3',
  p_customer_phone := '3000000003',
  p_items := '[{
    "product_id": "00000087-2222-2222-2222-222222222224",
    "quantity": 1,
    "customizations": [
      {"option_group_id": "00000087-3333-3333-3333-333333333331", "option_item_id": "00000087-4444-4444-4444-444444444441"},
      {"option_group_id": "00000087-3333-3333-3333-333333333332", "option_item_id": "00000087-4444-4444-4444-444444444445"}
    ]
  }]'::jsonb
);

SELECT o.total_amount, oi.unit_price,
       (SELECT array_agg(option_item_label || ' +' || price_delta ORDER BY option_item_label)
        FROM order_item_customizations WHERE order_item_id = oi.id) AS customizations
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.store_id = '00000087-1111-1111-1111-111111111111' AND o.customer_phone = '3000000003'
ORDER BY o.created_at DESC LIMIT 1;
-- EXPECT: total_amount=20000, unit_price=20000, customizations has 2 entries both "+0"


-- ============================================================
-- 4. Producto menú con modificador CON costo ("Queso extra", +2000)
-- EXPECTED: unit_price = 22000 (20000 base + 2000 delta), total=22000,
--           1 row in order_item_customizations with price_delta=2000.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 4',
  p_customer_phone := '3000000004',
  p_items := '[{
    "product_id": "00000087-2222-2222-2222-222222222224",
    "quantity": 1,
    "customizations": [
      {"option_group_id": "00000087-3333-3333-3333-333333333331", "option_item_id": "00000087-4444-4444-4444-444444444441"},
      {"option_group_id": "00000087-3333-3333-3333-333333333332", "option_item_id": "00000087-4444-4444-4444-444444444443"}
    ]
  }]'::jsonb
);

SELECT o.total_amount, oi.unit_price, oi.total_price
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.store_id = '00000087-1111-1111-1111-111111111111' AND o.customer_phone = '3000000004'
ORDER BY o.created_at DESC LIMIT 1;
-- EXPECT: total_amount=22000, unit_price=22000, total_price=22000


-- ============================================================
-- 5. Cantidad mayor a 1 — tu ejemplo exacto (base 20.000 + Queso extra
--    2.000, cantidad 3)
-- EXPECTED: unit_price_final=22000, line_total (total_price)=66000.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 5',
  p_customer_phone := '3000000005',
  p_items := '[{
    "product_id": "00000087-2222-2222-2222-222222222224",
    "quantity": 3,
    "customizations": [
      {"option_group_id": "00000087-3333-3333-3333-333333333331", "option_item_id": "00000087-4444-4444-4444-444444444441"},
      {"option_group_id": "00000087-3333-3333-3333-333333333332", "option_item_id": "00000087-4444-4444-4444-444444444443"}
    ]
  }]'::jsonb
);

SELECT o.total_amount, oi.quantity, oi.unit_price, oi.total_price
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.store_id = '00000087-1111-1111-1111-111111111111' AND o.customer_phone = '3000000005'
ORDER BY o.created_at DESC LIMIT 1;
-- EXPECT: unit_price=22000, quantity=3, total_price=66000, total_amount=66000


-- ============================================================
-- 6. Modificador inválido (id que no existe)
-- EXPECTED: rejected — SQLSTATE P0001, message starts with 'INVALID_MODIFIER:'
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 6',
  p_customer_phone := '3000000006',
  p_items := '[{
    "product_id": "00000087-2222-2222-2222-222222222224",
    "quantity": 1,
    "customizations": [
      {"option_group_id": "00000087-3333-3333-3333-333333333331", "option_item_id": "00000087-4444-4444-4444-444444444441"},
      {"option_group_id": "00000087-3333-3333-3333-333333333332", "option_item_id": "99999999-9999-9999-9999-999999999999"}
    ]
  }]'::jsonb
);
-- EXPECT: ERROR: INVALID_MODIFIER:99999999-9999-9999-9999-999999999999 — no order created


-- ============================================================
-- 7. Modificador de otro producto (item real, pero de Producto D)
-- EXPECTED: rejected — the item exists but its group.product_id doesn't
--           match this item's product_id, so it fails the same
--           INVALID_MODIFIER check as a nonexistent id.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 7',
  p_customer_phone := '3000000007',
  p_items := '[{
    "product_id": "00000087-2222-2222-2222-222222222224",
    "quantity": 1,
    "customizations": [
      {"option_group_id": "00000087-3333-3333-3333-333333333331", "option_item_id": "00000087-4444-4444-4444-444444444441"},
      {"option_group_id": "00000087-3333-3333-3333-333333333333", "option_item_id": "00000087-4444-4444-4444-444444444446"}
    ]
  }]'::jsonb
);
-- EXPECT: ERROR: INVALID_MODIFIER:00000087-4444-4444-4444-444444444446 — no order created


-- ============================================================
-- 8. Grupo requerido sin selección (Tamaño es is_required=true, y no se
--    manda ninguna customization para ese grupo)
-- EXPECTED: rejected — MODIFIER_GROUP_REQUIRED:Tamaño
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 8',
  p_customer_phone := '3000000008',
  p_items := '[{
    "product_id": "00000087-2222-2222-2222-222222222224",
    "quantity": 1,
    "customizations": [
      {"option_group_id": "00000087-3333-3333-3333-333333333332", "option_item_id": "00000087-4444-4444-4444-444444444443"}
    ]
  }]'::jsonb
);
-- EXPECT: ERROR: MODIFIER_GROUP_REQUIRED:Tamaño — no order created


-- ============================================================
-- 9. max_select excedido (Adiciones permite máximo 2, se mandan 3)
-- EXPECTED: rejected — MODIFIER_GROUP_MAX:Adiciones
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 9',
  p_customer_phone := '3000000009',
  p_items := '[{
    "product_id": "00000087-2222-2222-2222-222222222224",
    "quantity": 1,
    "customizations": [
      {"option_group_id": "00000087-3333-3333-3333-333333333331", "option_item_id": "00000087-4444-4444-4444-444444444441"},
      {"option_group_id": "00000087-3333-3333-3333-333333333332", "option_item_id": "00000087-4444-4444-4444-444444444443"},
      {"option_group_id": "00000087-3333-3333-3333-333333333332", "option_item_id": "00000087-4444-4444-4444-444444444444"},
      {"option_group_id": "00000087-3333-3333-3333-333333333332", "option_item_id": "00000087-4444-4444-4444-444444444445"}
    ]
  }]'::jsonb
);
-- EXPECT: ERROR: MODIFIER_GROUP_MAX:Adiciones — no order created


-- ============================================================
-- 10. Producto SIN grupos de modificadores, pero el cliente manda
--     customizations igual (usa el item de Producto C sobre Producto A,
--     que no tiene ningún product_option_groups)
-- EXPECTED: rejected — PRODUCT_HAS_NO_MODIFIERS:<product_id de A>
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-modificadores-087',
  p_customer_name := 'Test Escenario 10',
  p_customer_phone := '3000000010',
  p_items := '[{
    "product_id": "00000087-2222-2222-2222-222222222221",
    "quantity": 1,
    "customizations": [
      {"option_group_id": "00000087-3333-3333-3333-333333333331", "option_item_id": "00000087-4444-4444-4444-444444444441"}
    ]
  }]'::jsonb
);
-- EXPECT: ERROR: PRODUCT_HAS_NO_MODIFIERS:00000087-2222-2222-2222-222222222221 — no order created


-- ============================================================
-- Resumen automático de 1-10 — corre esto al final del bloque RPC:
-- debe haber exactamente 5 pedidos reales (1,2,3,4,5) y CERO para
-- 6,7,8,9,10 (todos rechazados antes de insertar nada).
-- ============================================================
SELECT customer_phone, count(*) AS orders_created
FROM orders
WHERE store_id = '00000087-1111-1111-1111-111111111111'
GROUP BY customer_phone
ORDER BY customer_phone;
-- EXPECT: rows only for 3000000001..3000000005, nothing for 006-010


-- ============================================================
-- C. WOMPI CON MODIFICADORES — no es solo SQL, involucra las Edge
-- Functions. Instrucciones para correrlo manualmente (curl), ya que no
-- pude ejecutar esto yo mismo (ver nota al final del archivo):
-- ============================================================

-- C.1 — Activar Wompi para la tienda de prueba primero (necesitas
-- credenciales sandbox reales de Wompi; si no las tienes a mano, esta
-- parte queda pendiente — no es bloqueante para cerrar la prioridad de
-- modificadores, ya que create-wompi-payment ya se revisó estáticamente
-- con deno check).
--
-- UPDATE store_commerce_settings SET online_checkout_enabled = true
--   WHERE store_id = '00000087-1111-1111-1111-111111111111';
-- INSERT INTO store_payment_settings (store_id, provider_id, public_key, private_key_reference, integrity_secret_reference, events_secret, environment, is_active)
-- VALUES ('00000087-1111-1111-1111-111111111111', (SELECT id FROM payment_providers WHERE code='wompi'),
--         'pub_test_...', 'prv_test_...', '<integrity secret sandbox>', '<events secret sandbox>', 'sandbox', true);

-- C.2 — Crear el checkout (reemplaza <ANON_KEY> y <PROJECT_URL>; usa el
-- mismo Queso extra +2000 del escenario 4):
--
-- curl -s -X POST "<PROJECT_URL>/functions/v1/create-wompi-payment" \
--   -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
--   -d '{
--     "store_slug": "test-modificadores-087",
--     "customer_name": "Test Wompi Modificador",
--     "customer_phone": "3000000099",
--     "fulfillment_method": "pickup",
--     "redirect_url": "https://example.com/payment-result",
--     "items": [{
--       "product_id": "00000087-2222-2222-2222-222222222224",
--       "quantity": 1,
--       "customizations": [
--         {"option_group_id": "00000087-3333-3333-3333-333333333331", "option_item_id": "00000087-4444-4444-4444-444444444441"},
--         {"option_group_id": "00000087-3333-3333-3333-333333333332", "option_item_id": "00000087-4444-4444-4444-444444444443"}
--       ]
--     }]
--   }'
--
-- EXPECTED response: amountInCents = 2200000 (22.000 COP × 100).
-- Then verify the snapshot:
--
-- SELECT amount_in_cents, items_snapshot FROM checkout_sessions
-- WHERE store_id = '00000087-1111-1111-1111-111111111111'
-- ORDER BY created_at DESC LIMIT 1;
--
-- EXPECT: amount_in_cents=2200000, items_snapshot[0].unit_price=22000,
-- items_snapshot[0].customizations has 1 entry
-- {option_item_label: "Queso extra", price_delta: 2000, ...}.

-- C.3 — Simular el webhook aprobado (necesita el events_secret real para
-- pasar la validación de firma — no se puede simular sin él; si tienes
-- acceso a Wompi sandbox real, es más simple completar el pago desde el
-- checkoutUrl devuelto en C.2 y dejar que Wompi dispare el webhook real).
-- Verificación después de que el webhook corra:
--
-- SELECT o.total_amount, oi.unit_price, oic.option_item_label, oic.price_delta
-- FROM orders o
-- JOIN order_items oi ON oi.order_id = o.id
-- JOIN order_item_customizations oic ON oic.order_item_id = oi.id
-- WHERE o.store_id = '00000087-1111-1111-1111-111111111111' AND o.customer_phone = '3000000099';
--
-- EXPECT: total_amount=22000, unit_price=22000, option_item_label='Queso extra', price_delta=2000.
-- Confirms wompi-webhook copied the ALREADY-VALIDATED snapshot from
-- checkout_sessions.items_snapshot verbatim — it does not re-validate
-- against product_option_items at webhook time, by design (see code
-- comment in wompi-webhook/index.ts), so C.3's next check matters:

-- C.4 — Cambiar el menú DESPUÉS de crear el checkout_session pero ANTES
-- de que llegue el webhook, y confirmar que el precio cobrado no cambia:
--
-- UPDATE product_option_items SET price_delta = 999999
--   WHERE id = '00000087-4444-4444-4444-444444444443'; -- Queso extra
-- -- ...ahora dispara/simula el webhook para la sesión creada en C.2...
-- -- El pedido resultante debe seguir mostrando price_delta=2000, NO 999999.
-- -- Revertir después:
-- UPDATE product_option_items SET price_delta = 2000
--   WHERE id = '00000087-4444-4444-4444-444444444443';


-- ============================================================
-- CLEANUP — borra todo lo de esta tienda de prueba (CASCADE se encarga
-- de products, product_option_groups/items, orders, order_items,
-- order_item_customizations, product_variants, checkout_sessions, etc.)
-- ============================================================
-- DELETE FROM public.stores WHERE id = '00000087-1111-1111-1111-111111111111';
