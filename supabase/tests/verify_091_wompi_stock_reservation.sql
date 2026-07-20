-- ============================================================
-- Manual verification plan for migration 091 (Wompi stock reservation)
-- and the create-wompi-payment / wompi-webhook changes built on top of
-- it.
--
-- Same approach as the earlier verify_0XX scripts: paste into the
-- Supabase Dashboard → SQL Editor for the linked project and run top to
-- bottom. No psql-only syntax (\set, \gset).
--
-- SCOPE OF THIS FILE: the core atomicity logic (reserve/release/expire)
-- lives entirely in SQL (create_wompi_checkout_reservation,
-- release_wompi_reservation_by_session, release_expired_wompi_
-- reservations) and is tested here directly, the same way
-- verify_090_variant_required.sql tested create_store_order directly —
-- this is the most faithful way to test it, since it's exactly what
-- create-wompi-payment and wompi-webhook call internally.
--
-- Two things genuinely can't be tested as plain SQL and need a real
-- HTTP request instead (curl instructions included further down, in
-- their own clearly marked section):
--   - VARIANT_REQUIRED — that check runs in TypeScript, in
--     create-wompi-payment, before the SQL layer is ever reached.
--   - The webhook's signature verification — by design (Prioridad 1),
--     it can only be satisfied with a correctly computed HMAC using the
--     store's real events_secret, which no SQL query can produce.
--
-- HOW TO RUN:
--   1. Find-and-replace ALL occurrences of 6da79330-6ae7-4abf-97c3-c4de944905cd with a real
--      auth.users id.
--   2. Run section 0 (setup) once.
--   3. Run each numbered SQL scenario in order.
--   4. For scenarios 5, 7, 8 (marked "HTTP"), follow the curl
--      instructions in section H at the bottom instead.
--   5. Run the cleanup block at the end.
--
-- All test data uses store slug 'test-wompi-stock-091' and ids prefixed
-- 00000091- so cleanup is a single predictable DELETE.
-- ============================================================

-- ============================================================
-- 0. SETUP
-- ============================================================

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000091-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Test Wompi Stock 091', 'test-wompi-stock-091',
        'Tienda de prueba para migración 091 — borrar después de verificar.', '+57 300 000 0000', 'CO', 'Bogotá', 'COP', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_commerce_settings (
  store_id, business_category, catalog_type, commerce_mode, delivery_mode,
  allows_pickup, allows_local_delivery, allows_national_shipping,
  whatsapp_checkout_enabled, web_order_enabled, cash_on_delivery_enabled, online_checkout_enabled,
  default_order_method
)
VALUES (
  '00000091-1111-1111-1111-111111111111', 'retail', 'physical_products', 'local_delivery_and_pickup', 'pickup_only',
  true, false, false, true, true, true, true, 'web_order'
)
ON CONFLICT (store_id) DO UPDATE SET web_order_enabled = true, cash_on_delivery_enabled = true, online_checkout_enabled = true;

-- Fake-but-well-formed sandbox Wompi settings — only needed for the HTTP
-- scenarios (5, 7, 8) in section H. create-wompi-payment never calls out
-- to Wompi itself (it only builds a checkout URL/signature), so these
-- don't need to be real Wompi credentials to pass its own validation.
INSERT INTO public.store_payment_settings (
  store_id, provider_id, public_key, private_key_reference, integrity_secret_reference,
  events_secret, environment, is_active
)
SELECT '00000091-1111-1111-1111-111111111111', pp.id,
       'pub_test_091', 'prv_test_091', 'integrity-secret-091',
       'events-secret-091', 'sandbox', true
FROM public.payment_providers pp WHERE pp.code = 'wompi'
ON CONFLICT (store_id, provider_id) DO UPDATE SET
  public_key = 'pub_test_091', integrity_secret_reference = 'integrity-secret-091',
  events_secret = 'events-secret-091', is_active = true;

-- Product A — simple, track_inventory=true, stock=5. Reused across
-- scenarios 1 AND 2 (chained, same as verify_088's pattern).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000091-2222-2222-2222-222222222221', '00000091-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Stock A', 'producto-stock-a-091', 'track_inventory=true, stock=5.', 10000, NULL, 5, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

-- Product B (parent) + variant, stock_policy='deny', stock_quantity=5 (scenario 3).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000091-2222-2222-2222-222222222222', '00000091-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Con Variante', 'producto-con-variante-091', 'Variante Talla M.', 30000, NULL, 0, false, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, is_required, is_active, sort_order)
VALUES ('00000091-5555-5555-5555-555555555551', '00000091-1111-1111-1111-111111111111', '00000091-2222-2222-2222-222222222222',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Talla', 'size', true, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
VALUES ('00000091-5555-5555-5555-555555555552', '00000091-1111-1111-1111-111111111111', '00000091-5555-5555-5555-555555555551',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'M', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, option_signature, price, stock_quantity, stock_policy, status)
VALUES ('00000091-2222-2222-2222-222222222223', '00000091-1111-1111-1111-111111111111', '00000091-2222-2222-2222-222222222222',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'TEST-M-091', '00000091-5555-5555-5555-555555555552', 30000, 5, 'deny', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id)
VALUES ('00000091-2222-2222-2222-222222222223', '00000091-5555-5555-5555-555555555551', '00000091-5555-5555-5555-555555555552',
        '00000091-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Product C (parent) + variant, stock_policy='deny', stock_quantity=1 (scenario 4, and scenario 11 — last-unit race).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000091-2222-2222-2222-222222222224', '00000091-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Variante Escasa', 'producto-variante-escasa-091', 'Variante Talla S, 1 unidad.', 30000, NULL, 0, false, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, is_required, is_active, sort_order)
VALUES ('00000091-5555-5555-5555-555555555553', '00000091-1111-1111-1111-111111111111', '00000091-2222-2222-2222-222222222224',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Talla', 'size', true, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
VALUES ('00000091-5555-5555-5555-555555555554', '00000091-1111-1111-1111-111111111111', '00000091-5555-5555-5555-555555555553',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'S', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, option_signature, price, stock_quantity, stock_policy, status)
VALUES ('00000091-2222-2222-2222-222222222225', '00000091-1111-1111-1111-111111111111', '00000091-2222-2222-2222-222222222224',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'TEST-S-091', '00000091-5555-5555-5555-555555555554', 30000, 1, 'deny', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id)
VALUES ('00000091-2222-2222-2222-222222222225', '00000091-5555-5555-5555-555555555553', '00000091-5555-5555-5555-555555555554',
        '00000091-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Product D — has one active variant, no variant_id sent (scenario 5, HTTP-only).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000091-2222-2222-2222-222222222226', '00000091-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Variante Obligatoria', 'producto-variante-obligatoria-091', 'Variante Talla L.', 30000, NULL, 0, false, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, is_required, is_active, sort_order)
VALUES ('00000091-5555-5555-5555-555555555555', '00000091-1111-1111-1111-111111111111', '00000091-2222-2222-2222-222222222226',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Talla', 'size', true, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
VALUES ('00000091-5555-5555-5555-555555555556', '00000091-1111-1111-1111-111111111111', '00000091-5555-5555-5555-555555555555',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'L', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, option_signature, price, stock_quantity, stock_policy, status)
VALUES ('00000091-2222-2222-2222-222222222227', '00000091-1111-1111-1111-111111111111', '00000091-2222-2222-2222-222222222226',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'TEST-L-091', '00000091-5555-5555-5555-555555555556', 30000, 3, 'deny', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id)
VALUES ('00000091-2222-2222-2222-222222222227', '00000091-5555-5555-5555-555555555555', '00000091-5555-5555-5555-555555555556',
        '00000091-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Product E — modifier group + stock (scenario 6, HTTP + SQL both work;
-- SQL version reserves directly by product_id, modifiers aren't part of
-- the SQL reservation call at all — see the note on scenario 6 below).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000091-2222-2222-2222-222222222228', '00000091-1111-1111-1111-111111111111', '6da79330-6ae7-4abf-97c3-c4de944905cd',
        'Producto Con Modificador', 'producto-modificador-091', 'Base 20.000, stock=10.', 20000, NULL, 10, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_groups (id, store_id, product_id, owner_id, name, selection_type, min_select, max_select, is_required, is_active, sort_order)
VALUES ('00000091-3333-3333-3333-333333333331', '00000091-1111-1111-1111-111111111111', '00000091-2222-2222-2222-222222222228',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Adiciones', 'multiple', 0, 2, false, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_items (id, store_id, group_id, owner_id, label, price_delta, is_default, is_active, sort_order)
VALUES ('00000091-4444-4444-4444-444444444441', '00000091-1111-1111-1111-111111111111', '00000091-3333-3333-3333-333333333331',
        '6da79330-6ae7-4abf-97c3-c4de944905cd', 'Queso extra', 2000, false, true, 0)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Sanity check.
SELECT
  (SELECT count(*) FROM products WHERE store_id = '00000091-1111-1111-1111-111111111111') AS products,
  (SELECT count(*) FROM product_variants WHERE store_id = '00000091-1111-1111-1111-111111111111') AS variants,
  (SELECT count(*) FROM store_payment_settings WHERE store_id = '00000091-1111-1111-1111-111111111111') AS payment_settings;


-- ============================================================
-- Helper: a fake checkout_session per scenario. In real usage
-- create-wompi-payment inserts this row itself (with items_snapshot,
-- amount_in_cents, checkout_url, etc.) before calling the reservation
-- RPC — here we only need the columns the reservation logic actually
-- touches (store_id, expires_at, status, order_id), so this is a
-- deliberately minimal stand-in, not a full snapshot.
-- ============================================================

-- Session 1 — scenarios 1 & 2 (Product A)
INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666601', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-001', 3000000, 'created', 'Test 1', '3000000911', 'https://example.com', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- Session 2 — scenario 2's second attempt (same product, different session)
INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666602', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-002', 3000000, 'created', 'Test 2', '3000000912', 'https://example.com', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- Session 3 — scenario 3 (variant with enough stock)
INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666603', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-003', 6000000, 'created', 'Test 3', '3000000913', 'https://example.com', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- Session 4 — scenario 4 (variant without enough stock)
INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666604', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-004', 6000000, 'created', 'Test 4', '3000000914', 'https://example.com', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- Session 6 — scenario 6 (product with modifiers; SQL reservation only
-- cares about product_id/variant_id/quantity — modifiers/price are
-- validated and priced entirely in create-wompi-payment before this
-- point, so this SQL-only test just confirms stock reservation for that
-- product id works the same as any other simple product).
INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666606', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-006', 2200000, 'created', 'Test 6', '3000000916', 'https://example.com', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- Session 9 — scenario 9 (reservation that gets released as if declined)
INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666609', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-009', 1000000, 'created', 'Test 9', '3000000919', 'https://example.com', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- Session 10 — scenario 10 (already expired — expires_at in the past)
INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666610', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-010', 1000000, 'created', 'Test 10', '30000009110', 'https://example.com', now() - interval '10 minutes')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 1. Producto simple con stock suficiente (stock=5, reservar 3)
-- EXPECT: succeeds, products.stock=2, 1 fila checkout_reserved con
--         checkout_session_id, quantity_change=-3.
-- ============================================================
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666601'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222221", "quantity": 3}]'::jsonb
);

SELECT stock FROM products WHERE id = '00000091-2222-2222-2222-222222222221';
-- EXPECT: 2

SELECT movement_type, quantity_change, checkout_session_id IS NOT NULL AS has_session
FROM inventory_movements
WHERE product_id = '00000091-2222-2222-2222-222222222221'
ORDER BY created_at DESC LIMIT 1;
-- EXPECT: checkout_reserved, -3, true


-- ============================================================
-- 2. Mismo producto, ahora en stock=2, reservar 3 más (sesión distinta)
-- EXPECT: rejected — INSUFFICIENT_STOCK, stock sigue en 2, no hay nuevo
--         checkout_reserved.
-- ============================================================
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666602'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222221", "quantity": 3}]'::jsonb
);
-- EXPECT: ERROR: INSUFFICIENT_STOCK:00000091-2222-2222-2222-222222222221

SELECT stock FROM products WHERE id = '00000091-2222-2222-2222-222222222221';
-- EXPECT: still 2

SELECT count(*) FROM inventory_movements WHERE checkout_session_id = '00000091-6666-6666-6666-666666666602';
-- EXPECT: 0


-- ============================================================
-- 3. Variante con stock suficiente (stock_quantity=5, reservar 2)
-- EXPECT: succeeds, stock_quantity=3, movement tiene variant_id.
-- ============================================================
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666603'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222222", "variant_id": "00000091-2222-2222-2222-222222222223", "quantity": 2}]'::jsonb
);

SELECT stock_quantity FROM product_variants WHERE id = '00000091-2222-2222-2222-222222222223';
-- EXPECT: 3

SELECT variant_id IS NOT NULL AS has_variant_id FROM inventory_movements
WHERE checkout_session_id = '00000091-6666-6666-6666-666666666603' ORDER BY created_at DESC LIMIT 1;
-- EXPECT: true


-- ============================================================
-- 4. Variante sin stock suficiente (stock_quantity=1, reservar 2)
-- EXPECT: rejected — INSUFFICIENT_STOCK, stock_quantity sigue en 1.
-- ============================================================
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666604'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222224", "variant_id": "00000091-2222-2222-2222-222222222225", "quantity": 2}]'::jsonb
);
-- EXPECT: ERROR: INSUFFICIENT_STOCK:00000091-2222-2222-2222-222222222225

SELECT stock_quantity FROM product_variants WHERE id = '00000091-2222-2222-2222-222222222225';
-- EXPECT: still 1


-- ============================================================
-- 5. Producto con variantes activas, sin variant_id — HTTP ONLY
-- Este chequeo vive en create-wompi-payment (TypeScript), no en la RPC
-- SQL. Ver sección H más abajo para el curl exacto.
-- EXPECT (vía curl): 422, {"error":"Selecciona una variante disponible
-- antes de pagar.","code":"VARIANT_REQUIRED"}, y NINGÚN checkout_session
-- nuevo con status distinto de 'error' — no debe reservar nada.
-- ============================================================


-- ============================================================
-- 6. Producto con modificadores — reserva de stock (el precio/snapshot
-- de los modificadores ya se probó en verify_087; esto solo confirma
-- que la reserva de stock no se ve afectada por tener modificadores)
-- EXPECT: succeeds, stock 10 → 8 (reservó por quantity=2, sin importar
--         el precio del modificador).
-- ============================================================
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666606'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222228", "quantity": 2}]'::jsonb
);

SELECT stock FROM products WHERE id = '00000091-2222-2222-2222-222222222228';
-- EXPECT: 8


-- ============================================================
-- 7-8. Webhook aprobado / duplicado — HTTP ONLY, ver sección H.
-- ============================================================


-- ============================================================
-- 9. Pago fallido/rechazado — liberar la reserva del escenario 1
-- Simula lo que wompi-webhook hace en DECLINED/ERROR/VOIDED: llama
-- directamente release_wompi_reservation_by_session.
-- EXPECT: stock de Producto A vuelve a 5 (2 + 3 repuestos), nueva fila
--         checkout_released con quantity_change=+3.
-- ============================================================

-- Primero, reserva algo nuevo específicamente para este escenario
-- (session 9, Producto A — reutilizamos el mismo producto, ya en stock=2
-- tras los escenarios 1-2; reservamos 1 más para tener algo que liberar).
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666609'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222221", "quantity": 1}]'::jsonb
);

SELECT stock FROM products WHERE id = '00000091-2222-2222-2222-222222222221';
-- EXPECT: 1 (2 - 1)

SELECT release_wompi_reservation_by_session('00000091-6666-6666-6666-666666666609'::uuid);
-- EXPECT: returns 1 (una fila liberada)

SELECT stock FROM products WHERE id = '00000091-2222-2222-2222-222222222221';
-- EXPECT: 2 (1 + 1 repuesto)

SELECT movement_type, quantity_change FROM inventory_movements
WHERE checkout_session_id = '00000091-6666-6666-6666-666666666609'
ORDER BY created_at;
-- EXPECT: dos filas — checkout_reserved (-1), checkout_released (+1)

-- Liberar la MISMA sesión otra vez — no debe volver a sumar stock.
SELECT release_wompi_reservation_by_session('00000091-6666-6666-6666-666666666609'::uuid);
-- EXPECT: returns 0 (nada que liberar — ya se liberó)

SELECT stock FROM products WHERE id = '00000091-2222-2222-2222-222222222221';
-- EXPECT: still 2 (no double release)


-- ============================================================
-- 10. Liberación diferida por expiración — session 10 ya tiene
-- expires_at en el pasado. Reservamos contra ella directamente (para
-- simular que create-wompi-payment sí alcanzó a reservar antes de que
-- el cliente abandonara el checkout), y luego confirmamos que el
-- siguiente intento de reserva para el MISMO producto la libera sola,
-- sin pg_cron.
-- ============================================================

-- Reservar 1 unidad del "Producto Variante Obligatoria" contra la
-- sesión ya vencida (stock_quantity=3 → 2).
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666610'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222226", "variant_id": "00000091-2222-2222-2222-222222222227", "quantity": 1}]'::jsonb
);

SELECT stock_quantity FROM product_variants WHERE id = '00000091-2222-2222-2222-222222222227';
-- EXPECT: 2

-- Ahora un NUEVO intento de reserva para la MISMA variante, en una
-- sesión nueva — antes de decidir si hay stock, debe liberar la reserva
-- vencida de la sesión 10 automáticamente (liberación diferida).
INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666611', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-011', 3000000, 'created', 'Test 10b', '30000009111', 'https://example.com', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666611'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222226", "variant_id": "00000091-2222-2222-2222-222222222227", "quantity": 3}]'::jsonb
);
-- EXPECT: succeeds — si la liberación diferida no hubiera corrido, esto
-- habría fallado por INSUFFICIENT_STOCK (solo quedaban 2, pedimos 3).

SELECT status FROM checkout_sessions WHERE id = '00000091-6666-6666-6666-666666666610';
-- EXPECT: expired

SELECT movement_type FROM inventory_movements
WHERE checkout_session_id = '00000091-6666-6666-6666-666666666610'
ORDER BY created_at;
-- EXPECT: checkout_reserved, checkout_released (la liberación diferida insertó el segundo)

SELECT stock_quantity FROM product_variants WHERE id = '00000091-2222-2222-2222-222222222227';
-- EXPECT: 0 (3 repuestos por la liberación − 3 reservados por la sesión 011)


-- ============================================================
-- 11. Dos intentos por el último producto (usa Producto Variante
-- Escasa, ya en stock_quantity=1 desde el escenario 4 fallido —
-- confirmamos que sigue en 1, luego el primer intento reserva y el
-- segundo falla).
-- ============================================================
INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666612', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-012', 3000000, 'created', 'Test 11a', '30000009112', 'https://example.com', now() + interval '2 hours'),
       ('00000091-6666-6666-6666-666666666613', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-013', 3000000, 'created', 'Test 11b', '30000009113', 'https://example.com', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- Primer intento — debe tener éxito (queda la última unidad).
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666612'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222224", "variant_id": "00000091-2222-2222-2222-222222222225", "quantity": 1}]'::jsonb
);

SELECT stock_quantity FROM product_variants WHERE id = '00000091-2222-2222-2222-222222222225';
-- EXPECT: 0

-- Segundo intento (sesión distinta) por la misma variante — debe
-- rechazar, ya no hay stock.
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666613'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222224", "variant_id": "00000091-2222-2222-2222-222222222225", "quantity": 1}]'::jsonb
);
-- EXPECT: ERROR: INSUFFICIENT_STOCK:00000091-2222-2222-2222-222222222225


-- ============================================================
-- 12. Pago aprobado tardío después de reserva liberada — el caso que
-- cierra la migración 092 + el nuevo chequeo en wompi-webhook.
--
-- Prepara el estado (reserva → liberada) aquí en SQL; la verificación
-- real de que el webhook NO crea un pedido normal en este caso vive en
-- H.12 más abajo (necesita el endpoint HTTP real, igual que 7/8).
-- ============================================================

INSERT INTO public.checkout_sessions (id, store_id, store_slug, provider, provider_reference, amount_in_cents, status, customer_name, customer_phone, checkout_url, expires_at)
VALUES ('00000091-6666-6666-6666-666666666614', '00000091-1111-1111-1111-111111111111', 'test-wompi-stock-091', 'wompi', 'CS-TEST-091-014', 3000000, 'created', 'Test 12', '30000009114', 'https://example.com', now() + interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- Reserva 1 unidad de "Producto Con Variante" (queda con 3 desde el
-- escenario 3 — esto la deja en 2).
SELECT create_wompi_checkout_reservation(
  '00000091-6666-6666-6666-666666666614'::uuid,
  '00000091-1111-1111-1111-111111111111'::uuid,
  '[{"product_id": "00000091-2222-2222-2222-222222222222", "variant_id": "00000091-2222-2222-2222-222222222223", "quantity": 1}]'::jsonb
);

SELECT stock_quantity FROM product_variants WHERE id = '00000091-2222-2222-2222-222222222223';
-- EXPECT: 2

-- Simula lo que la liberación diferida (o un DECLINED explícito) haría:
-- libera la reserva, como si el checkout se hubiera dado por perdido.
SELECT release_wompi_reservation_by_session('00000091-6666-6666-6666-666666666614'::uuid);
-- EXPECT: 1

SELECT stock_quantity FROM product_variants WHERE id = '00000091-2222-2222-2222-222222222223';
-- EXPECT: 3 (repuesta)

-- Confirma el estado que el webhook debe detectar: esta sesión SÍ tuvo
-- una reserva, pero YA fue liberada.
SELECT count(*) FROM inventory_movements
WHERE checkout_session_id = '00000091-6666-6666-6666-666666666614' AND movement_type = 'checkout_released';
-- EXPECT: 1 (esto es exactamente lo que el nuevo chequeo en wompi-webhook busca antes de crear un pedido)


-- ============================================================
-- Resumen final
-- ============================================================
SELECT movement_type, count(*) FROM inventory_movements
WHERE store_id = '00000091-1111-1111-1111-111111111111'
GROUP BY movement_type ORDER BY movement_type;
-- EXPECT: checkout_reserved y checkout_released presentes, ninguna otra
-- categoría (order_placed/order_cancelled no deberían aparecer — esta
-- prueba nunca llama create_store_order/cancel_store_order).


-- ============================================================
-- H. Escenarios que requieren HTTP real (no SQL puro)
-- ============================================================

-- H.5 — VARIANT_REQUIRED vía create-wompi-payment (reemplaza
-- <PROJECT_URL> y <ANON_KEY>; usa Producto D, que tiene una variante
-- activa, sin mandar variant_id):
--
-- curl -s -X POST "<PROJECT_URL>/functions/v1/create-wompi-payment" \
--   -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
--   -d '{
--     "store_slug": "test-wompi-stock-091",
--     "customer_name": "Test Escenario 5",
--     "customer_phone": "3000000915",
--     "fulfillment_method": "pickup",
--     "redirect_url": "https://example.com/payment-result",
--     "items": [{"product_id": "00000091-2222-2222-2222-222222222226", "quantity": 1}]
--   }'
--
-- EXPECT: HTTP 422, {"error":"Selecciona una variante disponible antes
-- de pagar.","code":"VARIANT_REQUIRED"}. Verificar después que NO se
-- creó ninguna fila en checkout_sessions con provider_reference nueva
-- distinta de 'error' para este intento, y que product_variants.
-- stock_quantity del producto D no cambió.

-- H.7/H.8 — Webhook aprobado + duplicado. Requiere firmar el payload
-- con el events_secret real de la fila de store_payment_settings de
-- arriba ('events-secret-091'). Wompi firma así:
--   checksum = SHA256(valores_de_las_properties_concatenados + timestamp + events_secret)
-- Ejemplo con un solo property "transaction.id":
--
--   TIMESTAMP=$(date +%s)
--   TRANSACTION_ID="wompi-test-091"
--   REFERENCE="CS-TEST-091-003"   -- reutiliza la reference real de un
--                                    checkout_session creado arriba
--                                    (o crea uno nuevo vía create-wompi-payment)
--   CHECKSUM=$(printf '%s' "${TRANSACTION_ID}${TIMESTAMP}events-secret-091" | shasum -a 256 | cut -d' ' -f1)
--
--   curl -s -X POST "<PROJECT_URL>/functions/v1/wompi-webhook" \
--     -H "Content-Type: application/json" \
--     -d "{
--       \"event\": \"transaction.updated\",
--       \"data\": {\"transaction\": {\"id\": \"${TRANSACTION_ID}\", \"reference\": \"${REFERENCE}\", \"status\": \"APPROVED\", \"amount_in_cents\": 6000000, \"currency\": \"COP\", \"payment_method_type\": \"CARD\"}},
--       \"signature\": {\"properties\": [\"transaction.id\"], \"checksum\": \"${CHECKSUM}\"},
--       \"timestamp\": ${TIMESTAMP}
--     }"
--
-- EXPECT (primera vez): 200, pedido creado en `orders`, order_items
-- coincide con items_snapshot, y el/los movement(s) checkout_reserved de
-- esa sesión ahora tienen order_id/order_item_id rellenos:
--   SELECT order_id, order_item_id FROM inventory_movements
--   WHERE checkout_session_id = (SELECT id FROM checkout_sessions WHERE provider_reference = 'CS-TEST-091-003');
--
-- EXPECT (repetir el MISMO curl una segunda vez): 200,
-- {"received":true,"order_already_created":true}, y NO se crea un
-- segundo pedido ni se duplica el movement.

-- H.12 — Pago aprobado tardío después de reserva liberada (cierra el
-- caso de la migración 092). Usa la sesión CS-TEST-091-014 preparada en
-- el escenario 12 de arriba — ya tiene una reserva liberada.
--
--   TIMESTAMP=$(date +%s)
--   TRANSACTION_ID="wompi-test-091-late"
--   REFERENCE="CS-TEST-091-014"
--   CHECKSUM=$(printf '%s' "${TRANSACTION_ID}${TIMESTAMP}events-secret-091" | shasum -a 256 | cut -d' ' -f1)
--
--   curl -s -X POST "<PROJECT_URL>/functions/v1/wompi-webhook" \
--     -H "Content-Type: application/json" \
--     -d "{
--       \"event\": \"transaction.updated\",
--       \"data\": {\"transaction\": {\"id\": \"${TRANSACTION_ID}\", \"reference\": \"${REFERENCE}\", \"status\": \"APPROVED\", \"amount_in_cents\": 3000000, \"currency\": \"COP\", \"payment_method_type\": \"CARD\"}},
--       \"signature\": {\"properties\": [\"transaction.id\"], \"checksum\": \"${CHECKSUM}\"},
--       \"timestamp\": ${TIMESTAMP}
--     }"
--
-- EXPECT (primera vez): HTTP 200, {"received":true,"requires_manual_review":true}.
-- Verificar después:
--
--   SELECT status FROM checkout_sessions WHERE provider_reference = 'CS-TEST-091-014';
--   -- EXPECT: paid_stock_unavailable
--
--   SELECT count(*) FROM orders o JOIN checkout_sessions cs ON cs.order_id = o.id
--   WHERE cs.provider_reference = 'CS-TEST-091-014';
--   -- EXPECT: 0 — no se creó ningún pedido normal
--
--   SELECT order_id, status FROM payment_transactions WHERE provider_reference = 'CS-TEST-091-014';
--   -- EXPECT: 1 fila, order_id NULL, status='approved' — el pago queda
--   -- auditado aunque no haya pedido, listo para revisión manual/reembolso.
--
--   SELECT stock_quantity FROM product_variants WHERE id = '00000091-2222-2222-2222-222222222223';
--   -- EXPECT: sigue en 3 — el webhook NO volvió a descontar stock.
--
-- EXPECT (repetir el MISMO curl una segunda vez): HTTP 200,
-- {"received":true,"requires_manual_review":true,"already_flagged":true},
-- y la query de payment_transactions de arriba sigue devolviendo
-- exactamente 1 fila (no se duplicó).


-- ============================================================
-- CLEANUP
-- ============================================================
-- DELETE FROM public.stores WHERE id = '00000091-1111-1111-1111-111111111111';
