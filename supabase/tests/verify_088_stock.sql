-- ============================================================
-- Manual verification plan for migration 088 (stock validation +
-- deduction for web/COD orders, and cancel_store_order).
--
-- Same approach as supabase/tests/verify_087_modifiers.sql: paste into
-- the Supabase Dashboard → SQL Editor for the linked project (runs with
-- full privileges, so RLS/role checks on create_store_order won't block
-- anything) and run top to bottom. No psql-only syntax (\set, \gset).
--
-- HOW TO RUN:
--   1. Find-and-replace ALL occurrences of 6da79330-6ae7-4abf-97c3-c4de944905cd with a real
--      auth.users id (Dashboard → Authentication → Users → copy the UID
--      of any existing user — same as verify_087_modifiers.sql).
--   2. Run section 0 (setup) once.
--   3. Run each numbered scenario in order — some scenarios 7-9 depend
--      on orders created in earlier scenarios, so don't skip around.
--   4. Compare each result against its "EXPECT" comment.
--   5. Run the cleanup block at the end.
--
-- All test data uses store slug 'test-stock-088' and ids prefixed
-- 00000088- so cleanup is a single predictable DELETE.
-- ============================================================

-- ============================================================
-- 0. SETUP
-- ============================================================

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000088-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Test Stock 088', 'test-stock-088',
        'Tienda de prueba para migración 088 — borrar después de verificar.', '+57 300 000 0000', 'CO', 'Bogotá', 'COP', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_commerce_settings (
  store_id, business_category, catalog_type, commerce_mode, delivery_mode,
  allows_pickup, allows_local_delivery, allows_national_shipping,
  whatsapp_checkout_enabled, web_order_enabled, cash_on_delivery_enabled, online_checkout_enabled,
  default_order_method
)
VALUES (
  '00000088-1111-1111-1111-111111111111', 'retail', 'physical_products', 'local_delivery_and_pickup', 'pickup_only',
  true, false, false, true, true, true, false, 'web_order'
)
ON CONFLICT (store_id) DO UPDATE SET web_order_enabled = true, cash_on_delivery_enabled = true;

-- Product A — track_inventory=true, stock=5. Reused across scenarios 1
-- AND 2 (scenario 1 brings it to stock=2, scenario 2 then correctly
-- fails to order 3 against that — this is intentional chaining, not two
-- independent fixtures, see the comments on each scenario).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000088-2222-2222-2222-222222222221', '00000088-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Stock A', 'producto-stock-a-088', 'track_inventory=true, stock=5.', 10000, NULL, 5, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

-- Product B — track_inventory=false, stock=0 (scenario 3).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000088-2222-2222-2222-222222222222', '00000088-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Sin Tracking', 'producto-sin-tracking-088', 'track_inventory=false, stock=0.', 8000, NULL, 0, false, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

-- Product C (parent) + variant, stock_policy='deny', stock_quantity=5 (scenario 4).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000088-2222-2222-2222-222222222223', '00000088-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Con Variante', 'producto-con-variante-088', 'Variante Talla M.', 30000, NULL, 0, false, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, is_required, is_active, sort_order)
VALUES ('00000088-5555-5555-5555-555555555551', '00000088-1111-1111-1111-111111111111', '00000088-2222-2222-2222-222222222223',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Talla', 'size', true, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
VALUES ('00000088-5555-5555-5555-555555555552', '00000088-1111-1111-1111-111111111111', '00000088-5555-5555-5555-555555555551',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'M', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variants (
  id, store_id, product_id, owner_id, sku, option_signature, price, stock_quantity, stock_policy, status
)
VALUES (
  '00000088-2222-2222-2222-222222222224',
  '00000088-1111-1111-1111-111111111111',
  '00000088-2222-2222-2222-222222222223',
  '6da79330-6ae7-4abf-97c3-c4de944905cd',
  'TEST-M-088',
  '00000088-5555-5555-5555-555555555552',
  30000,
  5,
  'deny',
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id)
VALUES ('00000088-2222-2222-2222-222222222224', '00000088-5555-5555-5555-555555555551', '00000088-5555-5555-5555-555555555552',
        '00000088-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Product D (parent) + variant, stock_policy='deny', stock_quantity=1 (scenario 5).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000088-2222-2222-2222-222222222225', '00000088-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Variante Escasa', 'producto-variante-escasa-088', 'Variante Talla S, solo 1 unidad.', 30000, NULL, 0, false, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, is_required, is_active, sort_order)
VALUES ('00000088-5555-5555-5555-555555555553', '00000088-1111-1111-1111-111111111111', '00000088-2222-2222-2222-222222222225',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Talla', 'size', true, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
VALUES ('00000088-5555-5555-5555-555555555554', '00000088-1111-1111-1111-111111111111', '00000088-5555-5555-5555-555555555553',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'S', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variants (
  id, store_id, product_id, owner_id, sku, option_signature, price, stock_quantity, stock_policy, status
)
VALUES (
  '00000088-2222-2222-2222-222222222226',
  '00000088-1111-1111-1111-111111111111',
  '00000088-2222-2222-2222-222222222225',
  '6da79330-6ae7-4abf-97c3-c4de944905cd',
  'TEST-S-088',
  '00000088-5555-5555-5555-555555555554',
  30000,
  1,
  'deny',
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id)
VALUES ('00000088-2222-2222-2222-222222222226', '00000088-5555-5555-5555-555555555553', '00000088-5555-5555-5555-555555555554',
        '00000088-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Product E — has a modifier group AND stock, for scenario 6
-- (modifiers + stock together). Base price 20.000, stock=10.
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000088-2222-2222-2222-222222222227', '00000088-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Con Modificador Y Stock', 'producto-modificador-stock-088', 'Base 20.000, stock=10.', 20000, NULL, 10, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_groups (id, store_id, product_id, owner_id, name, selection_type, min_select, max_select, is_required, is_active, sort_order)
VALUES ('00000088-3333-3333-3333-333333333331', '00000088-1111-1111-1111-111111111111', '00000088-2222-2222-2222-222222222227',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Adiciones', 'multiple', 0, 2, false, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_items (id, store_id, group_id, owner_id, label, price_delta, is_default, is_active, sort_order)
VALUES ('00000088-4444-4444-4444-444444444441', '00000088-1111-1111-1111-111111111111', '00000088-3333-3333-3333-333333333331',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Queso extra', 2000, false, true, 0)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Sanity check — expect 5 products, 1 group, 1 item, 2 variants.
SELECT
  (SELECT count(*) FROM products WHERE store_id = '00000088-1111-1111-1111-111111111111') AS products,
  (SELECT count(*) FROM product_variants WHERE store_id = '00000088-1111-1111-1111-111111111111') AS variants,
  (SELECT count(*) FROM product_option_groups WHERE store_id = '00000088-1111-1111-1111-111111111111') AS groups,
  (SELECT count(*) FROM product_option_items WHERE store_id = '00000088-1111-1111-1111-111111111111') AS items;


-- ============================================================
-- 1. Producto simple, track_inventory=true, stock=5, pedir 3
-- EXPECT: succeeds, products.stock = 2, one inventory_movements row
--         with movement_type='order_placed', quantity_change=-3.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-stock-088',
  p_customer_name := 'Test Escenario 1',
  p_customer_phone := '3000000881',
  p_items := '[{"product_id": "00000088-2222-2222-2222-222222222221", "quantity": 3}]'::jsonb
);

SELECT stock FROM products WHERE id = '00000088-2222-2222-2222-222222222221';
-- EXPECT: 2

SELECT movement_type, quantity_change, stock_before, stock_after, order_id IS NOT NULL AS has_order_id
FROM inventory_movements
WHERE product_id = '00000088-2222-2222-2222-222222222221'
ORDER BY created_at DESC LIMIT 1;
-- EXPECT: order_placed, -3, 5, 2, true


-- ============================================================
-- 2. Mismo producto, ahora en stock=2 (por el escenario 1), pedir 3
-- EXPECT: rejected — INSUFFICIENT_STOCK, stock queda en 2 (sin cambio),
--         no se crea pedido, no se crea movimiento nuevo.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-stock-088',
  p_customer_name := 'Test Escenario 2',
  p_customer_phone := '3000000882',
  p_items := '[{"product_id": "00000088-2222-2222-2222-222222222221", "quantity": 3}]'::jsonb
);
-- EXPECT: ERROR: INSUFFICIENT_STOCK:00000088-2222-2222-2222-222222222221

SELECT stock FROM products WHERE id = '00000088-2222-2222-2222-222222222221';
-- EXPECT: still 2 (unchanged)


-- ============================================================
-- 3. Producto track_inventory=false, stock=0, pedir 100
-- EXPECT: succeeds — stock doesn't matter, no movement created (nothing
--         to track), products.stock stays at 0.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-stock-088',
  p_customer_name := 'Test Escenario 3',
  p_customer_phone := '3000000883',
  p_items := '[{"product_id": "00000088-2222-2222-2222-222222222222", "quantity": 100}]'::jsonb
);

SELECT stock FROM products WHERE id = '00000088-2222-2222-2222-222222222222';
-- EXPECT: 0 (unchanged)

SELECT count(*) FROM inventory_movements WHERE product_id = '00000088-2222-2222-2222-222222222222';
-- EXPECT: 0


-- ============================================================
-- 4. Variante stock_quantity=5, pedir 2
-- EXPECT: succeeds, stock_quantity=3, movement has variant_id set.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-stock-088',
  p_customer_name := 'Test Escenario 4',
  p_customer_phone := '3000000884',
  p_items := '[{"product_id": "00000088-2222-2222-2222-222222222223", "variant_id": "00000088-2222-2222-2222-222222222224", "quantity": 2}]'::jsonb
);

SELECT stock_quantity FROM product_variants WHERE id = '00000088-2222-2222-2222-222222222224';
-- EXPECT: 3

SELECT movement_type, quantity_change, variant_id IS NOT NULL AS has_variant_id
FROM inventory_movements
WHERE variant_id = '00000088-2222-2222-2222-222222222224'
ORDER BY created_at DESC LIMIT 1;
-- EXPECT: order_placed, -2, true


-- ============================================================
-- 5. Variante stock_policy='deny', stock_quantity=1, pedir 2
-- EXPECT: rejected — INSUFFICIENT_STOCK, stock_quantity queda en 1.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-stock-088',
  p_customer_name := 'Test Escenario 5',
  p_customer_phone := '3000000885',
  p_items := '[{"product_id": "00000088-2222-2222-2222-222222222225", "variant_id": "00000088-2222-2222-2222-222222222226", "quantity": 2}]'::jsonb
);
-- EXPECT: ERROR: INSUFFICIENT_STOCK:00000088-2222-2222-2222-222222222226

SELECT stock_quantity FROM product_variants WHERE id = '00000088-2222-2222-2222-222222222226';
-- EXPECT: still 1


-- ============================================================
-- 6. Pedido con modificador + stock (cantidad 2, "Queso extra" +2000)
-- EXPECT: unit_price=22000, total_price=44000 (precio sigue correcto,
--         no roto por esta migración), stock 10 → 8 (se descuenta por
--         quantity, no por precio), 1 fila en order_item_customizations.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-stock-088',
  p_customer_name := 'Test Escenario 6',
  p_customer_phone := '3000000886',
  p_items := '[{
    "product_id": "00000088-2222-2222-2222-222222222227",
    "quantity": 2,
    "customizations": [
      {"option_group_id": "00000088-3333-3333-3333-333333333331", "option_item_id": "00000088-4444-4444-4444-444444444441"}
    ]
  }]'::jsonb
);

SELECT o.total_amount, oi.unit_price, oi.total_price,
       (SELECT count(*) FROM order_item_customizations WHERE order_item_id = oi.id) AS customization_rows
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.store_id = '00000088-1111-1111-1111-111111111111' AND o.customer_phone = '3000000886'
ORDER BY o.created_at DESC LIMIT 1;
-- EXPECT: total_amount=44000, unit_price=22000, total_price=44000, customization_rows=1

SELECT stock FROM products WHERE id = '00000088-2222-2222-2222-222222222227';
-- EXPECT: 8 (10 - quantity 2, NOT affected by the modifier's price)


-- ============================================================
-- 7. Cancelar el pedido del escenario 1
-- EXPECT: status='cancelled', products.stock vuelve a 5 (repuesto),
--         nueva fila inventory_movements con movement_type='order_cancelled'.
-- To call cancel_store_order you must be authenticated as an owner/admin
-- of the test store — simulate that for this transaction only:
-- ============================================================
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "6da79330-6ae7-4abf-97c3-c4de944905cd", "role": "authenticated"}';

SELECT cancel_store_order(
  (SELECT id FROM orders WHERE store_id = '00000088-1111-1111-1111-111111111111' AND customer_phone = '3000000881' ORDER BY created_at DESC LIMIT 1)
);
COMMIT;
-- EXPECT: {"order_id": "...", "status": "cancelled", "stock_movements_reversed": 1}

SELECT status FROM orders WHERE store_id = '00000088-1111-1111-1111-111111111111' AND customer_phone = '3000000881';
-- EXPECT: cancelled

SELECT stock FROM products WHERE id = '00000088-2222-2222-2222-222222222221';
-- EXPECT: 5 (back to the original — 2 + 3 restored)

SELECT movement_type, quantity_change FROM inventory_movements
WHERE product_id = '00000088-2222-2222-2222-222222222221'
ORDER BY created_at DESC LIMIT 1;
-- EXPECT: order_cancelled, +3


-- ============================================================
-- 8. Cancelar el MISMO pedido otra vez
-- EXPECT: rejected — ORDER_ALREADY_CANCELLED, stock NO se vuelve a
--         sumar (sigue en 5, no en 8).
-- ============================================================
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "6da79330-6ae7-4abf-97c3-c4de944905cd", "role": "authenticated"}';

SELECT cancel_store_order(
  (SELECT id FROM orders WHERE store_id = '00000088-1111-1111-1111-111111111111' AND customer_phone = '3000000881' ORDER BY created_at DESC LIMIT 1)
);
COMMIT;
-- EXPECT: ERROR: ORDER_ALREADY_CANCELLED

SELECT stock FROM products WHERE id = '00000088-2222-2222-2222-222222222221';
-- EXPECT: still 5 (not 8 — no double reposition)


-- ============================================================
-- 9. Intentar cancelar un pedido ya delivered
-- EXPECT: rejected — ORDER_ALREADY_DELIVERED.
-- Prepara un pedido "delivered" a partir del escenario 3 (marcarlo a
-- mano, saltándose el flujo normal, solo para esta prueba):
-- ============================================================
UPDATE orders SET status = 'delivered'
WHERE store_id = '00000088-1111-1111-1111-111111111111' AND customer_phone = '3000000883';

BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "6da79330-6ae7-4abf-97c3-c4de944905cd", "role": "authenticated"}';

SELECT cancel_store_order(
  (SELECT id FROM orders WHERE store_id = '00000088-1111-1111-1111-111111111111' AND customer_phone = '3000000883' ORDER BY created_at DESC LIMIT 1)
);
COMMIT;
-- EXPECT: ERROR: ORDER_ALREADY_DELIVERED


-- ============================================================
-- 10. Resumen final
-- ============================================================
SELECT customer_phone, status, total_amount FROM orders
WHERE store_id = '00000088-1111-1111-1111-111111111111'
ORDER BY customer_phone;
-- EXPECT: 881=cancelled, 882=NO ROW (rejected, never created),
--         883=delivered, 884=pending, 885=NO ROW (rejected), 886=pending

SELECT movement_type, count(*) FROM inventory_movements
WHERE store_id = '00000088-1111-1111-1111-111111111111'
GROUP BY movement_type ORDER BY movement_type;
-- EXPECT: order_cancelled=1, order_placed=3 (escenarios 1, 4, 6 — NOT 3,
--         since track_inventory=false skips the movement entirely)

SELECT id, stock FROM products WHERE store_id = '00000088-1111-1111-1111-111111111111' ORDER BY name;
-- EXPECT final stock: Producto Stock A=5, Sin Tracking=0,
--         Con Variante=0 (parent stock unused), Variante Escasa=0 (parent
--         stock unused), Con Modificador Y Stock=8

SELECT id, stock_quantity FROM product_variants WHERE store_id = '00000088-1111-1111-1111-111111111111' ORDER BY sku;
-- EXPECT: TEST-M-088=3, TEST-S-088=1


-- ============================================================
-- CLEANUP
-- ============================================================
-- DELETE FROM public.stores WHERE id = '00000088-1111-1111-1111-111111111111';
