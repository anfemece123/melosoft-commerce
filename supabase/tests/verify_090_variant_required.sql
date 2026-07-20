-- ============================================================
-- Manual verification plan for migration 090 (require variant_id when a
-- product has active variants).
--
-- Same approach as verify_087_modifiers.sql / verify_088_stock.sql:
-- paste into the Supabase Dashboard → SQL Editor for the linked project
-- and run top to bottom. No psql-only syntax (\set, \gset).
--
-- HOW TO RUN:
--   1. Find-and-replace ALL occurrences of OWNER_ID_HERE with a real
--      auth.users id (Dashboard → Authentication → Users → copy the UID
--      of any existing user).
--   2. Run section 0 (setup) once.
--   3. Run each numbered scenario in order.
--   4. Compare each result against its "EXPECT" comment.
--   5. Run the cleanup block at the end.
--
-- All test data uses store slug 'test-variant-090' and ids prefixed
-- 00000090- so cleanup is a single predictable DELETE.
-- ============================================================

-- ============================================================
-- 0. SETUP
-- ============================================================

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000090-1111-1111-1111-111111111111', 'OWNER_ID_HERE', 'Test Variant Required 090', 'test-variant-090',
        'Tienda de prueba para migración 090 — borrar después de verificar.', '+57 300 000 0000', 'CO', 'Bogotá', 'COP', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_commerce_settings (
  store_id, business_category, catalog_type, commerce_mode, delivery_mode,
  allows_pickup, allows_local_delivery, allows_national_shipping,
  whatsapp_checkout_enabled, web_order_enabled, cash_on_delivery_enabled, online_checkout_enabled,
  default_order_method
)
VALUES (
  '00000090-1111-1111-1111-111111111111', 'retail', 'physical_products', 'local_delivery_and_pickup', 'pickup_only',
  true, false, false, true, true, true, false, 'web_order'
)
ON CONFLICT (store_id) DO UPDATE SET web_order_enabled = true, cash_on_delivery_enabled = true;

-- Product A — simple, no variants at all (scenario 1).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000090-2222-2222-2222-222222222221', '00000090-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
        'Producto Sin Variantes', 'producto-sin-variantes-090', 'Sin variantes en absoluto.', 15000, NULL, 20, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

-- Product B — has one ACTIVE variant (scenarios 2 and 3).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000090-2222-2222-2222-222222222222', '00000090-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
        'Producto Con Variante Activa', 'producto-variante-activa-090', 'Variante Talla M, activa.', 30000, NULL, 0, false, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, is_required, is_active, sort_order)
VALUES ('00000090-5555-5555-5555-555555555551', '00000090-1111-1111-1111-111111111111', '00000090-2222-2222-2222-222222222222',
        'OWNER_ID_HERE', 'Talla', 'size', true, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
VALUES ('00000090-5555-5555-5555-555555555552', '00000090-1111-1111-1111-111111111111', '00000090-5555-5555-5555-555555555551',
        'OWNER_ID_HERE', 'M', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, option_signature, price, stock_quantity, stock_policy, status)
VALUES ('00000090-2222-2222-2222-222222222223', '00000090-1111-1111-1111-111111111111', '00000090-2222-2222-2222-222222222222',
        'OWNER_ID_HERE', 'TEST-M-090', '00000090-5555-5555-5555-555555555552', 30000, 5, 'deny', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id)
VALUES ('00000090-2222-2222-2222-222222222223', '00000090-5555-5555-5555-555555555551', '00000090-5555-5555-5555-555555555552',
        '00000090-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Product C — has ONLY an inactive/archived variant (scenario 4).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000090-2222-2222-2222-222222222224', '00000090-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
        'Producto Con Variante Archivada', 'producto-variante-archivada-090', 'Su única variante está archivada.', 25000, NULL, 12, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, is_required, is_active, sort_order)
VALUES ('00000090-5555-5555-5555-555555555553', '00000090-1111-1111-1111-111111111111', '00000090-2222-2222-2222-222222222224',
        'OWNER_ID_HERE', 'Talla', 'size', true, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
VALUES ('00000090-5555-5555-5555-555555555554', '00000090-1111-1111-1111-111111111111', '00000090-5555-5555-5555-555555555553',
        'OWNER_ID_HERE', 'L', 0)
ON CONFLICT (id) DO NOTHING;

-- status = 'inactive' — the only variant this product has, and it's not
-- active (product_variants.status only allows 'active'/'inactive').
INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, option_signature, price, stock_quantity, stock_policy, status)
VALUES ('00000090-2222-2222-2222-222222222225', '00000090-1111-1111-1111-111111111111', '00000090-2222-2222-2222-222222222224',
        'OWNER_ID_HERE', 'TEST-L-090-OLD', '00000090-5555-5555-5555-555555555554', 25000, 3, 'deny', 'inactive')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id)
VALUES ('00000090-2222-2222-2222-222222222225', '00000090-5555-5555-5555-555555555553', '00000090-5555-5555-5555-555555555554',
        '00000090-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Product D — has a modifier group, no variants (scenario 5, confirms
-- modifiers still work untouched by this migration).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000090-2222-2222-2222-222222222226', '00000090-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
        'Producto Con Modificador', 'producto-modificador-090', 'Base 20.000, sin variantes.', 20000, NULL, 10, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_groups (id, store_id, product_id, owner_id, name, selection_type, min_select, max_select, is_required, is_active, sort_order)
VALUES ('00000090-3333-3333-3333-333333333331', '00000090-1111-1111-1111-111111111111', '00000090-2222-2222-2222-222222222226',
        'OWNER_ID_HERE', 'Adiciones', 'multiple', 0, 2, false, true, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_option_items (id, store_id, group_id, owner_id, label, price_delta, is_default, is_active, sort_order)
VALUES ('00000090-4444-4444-4444-444444444441', '00000090-1111-1111-1111-111111111111', '00000090-3333-3333-3333-333333333331',
        'OWNER_ID_HERE', 'Queso extra', 2000, false, true, 0)
ON CONFLICT (id) DO NOTHING;

-- Product E — simple, track_inventory=true, stock=4 (scenario 6,
-- confirms stock deduction from 088 still works untouched).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000090-2222-2222-2222-222222222227', '00000090-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
        'Producto Stock Simple', 'producto-stock-simple-090', 'track_inventory=true, stock=4.', 12000, NULL, 4, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Sanity check — expect 5 products, 2 variants (1 active + 1 archived), 1 group, 1 item.
SELECT
  (SELECT count(*) FROM products WHERE store_id = '00000090-1111-1111-1111-111111111111') AS products,
  (SELECT count(*) FROM product_variants WHERE store_id = '00000090-1111-1111-1111-111111111111') AS variants,
  (SELECT count(*) FROM product_variants WHERE store_id = '00000090-1111-1111-1111-111111111111' AND status = 'active') AS active_variants,
  (SELECT count(*) FROM product_option_groups WHERE store_id = '00000090-1111-1111-1111-111111111111') AS groups;


-- ============================================================
-- 1. Producto simple sin variantes, sin variant_id
-- EXPECT: succeeds — VARIANT_REQUIRED never applies to a product with
--         zero variants.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-variant-090',
  p_customer_name := 'Test Escenario 1',
  p_customer_phone := '3000000901',
  p_items := '[{"product_id": "00000090-2222-2222-2222-222222222221", "quantity": 1}]'::jsonb
);

SELECT total_amount FROM orders WHERE store_id = '00000090-1111-1111-1111-111111111111' AND customer_phone = '3000000901';
-- EXPECT: 15000


-- ============================================================
-- 2. Producto CON variante activa, pero sin variant_id (bypass directo)
-- EXPECT: rejected — VARIANT_REQUIRED:00000090-2222-2222-2222-222222222222,
--         no se crea pedido, no se toca stock de la variante.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-variant-090',
  p_customer_name := 'Test Escenario 2',
  p_customer_phone := '3000000902',
  p_items := '[{"product_id": "00000090-2222-2222-2222-222222222222", "quantity": 1}]'::jsonb
);
-- EXPECT: ERROR: VARIANT_REQUIRED:00000090-2222-2222-2222-222222222222

SELECT count(*) FROM orders WHERE store_id = '00000090-1111-1111-1111-111111111111' AND customer_phone = '3000000902';
-- EXPECT: 0

SELECT stock_quantity FROM product_variants WHERE id = '00000090-2222-2222-2222-222222222223';
-- EXPECT: still 5 (unchanged)


-- ============================================================
-- 3. Mismo producto, ahora CON variant_id válido
-- EXPECT: succeeds — funciona igual que antes de esta migración, stock
--         de la variante se descuenta (5 → 4).
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-variant-090',
  p_customer_name := 'Test Escenario 3',
  p_customer_phone := '3000000903',
  p_items := '[{"product_id": "00000090-2222-2222-2222-222222222222", "variant_id": "00000090-2222-2222-2222-222222222223", "quantity": 1}]'::jsonb
);

SELECT stock_quantity FROM product_variants WHERE id = '00000090-2222-2222-2222-222222222223';
-- EXPECT: 4


-- ============================================================
-- 4. Producto cuya ÚNICA variante está archivada (no activa), sin
--    variant_id
-- EXPECT: succeeds — no debe bloquear por VARIANT_REQUIRED, porque no
--         hay ninguna variante con status='active'. Se compra como
--         producto simple (track_inventory=true, stock=12 → 11).
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-variant-090',
  p_customer_name := 'Test Escenario 4',
  p_customer_phone := '3000000904',
  p_items := '[{"product_id": "00000090-2222-2222-2222-222222222224", "quantity": 1}]'::jsonb
);

SELECT stock FROM products WHERE id = '00000090-2222-2222-2222-222222222224';
-- EXPECT: 11


-- ============================================================
-- 5. Producto con modificadores, sin variantes — confirma que 087 sigue
--    intacto
-- EXPECT: succeeds, unit_price=22000 (20000 + 2000 del modificador),
--         no afectado por el guard de variantes.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-variant-090',
  p_customer_name := 'Test Escenario 5',
  p_customer_phone := '3000000905',
  p_items := '[{
    "product_id": "00000090-2222-2222-2222-222222222226",
    "quantity": 1,
    "customizations": [
      {"option_group_id": "00000090-3333-3333-3333-333333333331", "option_item_id": "00000090-4444-4444-4444-444444444441"}
    ]
  }]'::jsonb
);

SELECT oi.unit_price, (SELECT count(*) FROM order_item_customizations WHERE order_item_id = oi.id) AS customization_rows
FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE o.store_id = '00000090-1111-1111-1111-111111111111' AND o.customer_phone = '3000000905';
-- EXPECT: unit_price=22000, customization_rows=1


-- ============================================================
-- 6. Producto simple, track_inventory=true, stock=4 — confirma que 088
--    sigue intacto
-- EXPECT: succeeds, stock 4 → 4-quantity, movimiento order_placed creado.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-variant-090',
  p_customer_name := 'Test Escenario 6',
  p_customer_phone := '3000000906',
  p_items := '[{"product_id": "00000090-2222-2222-2222-222222222227", "quantity": 2}]'::jsonb
);

SELECT stock FROM products WHERE id = '00000090-2222-2222-2222-222222222227';
-- EXPECT: 2

SELECT movement_type, quantity_change FROM inventory_movements
WHERE product_id = '00000090-2222-2222-2222-222222222227'
ORDER BY created_at DESC LIMIT 1;
-- EXPECT: order_placed, -2


-- ============================================================
-- Resumen final
-- ============================================================
SELECT customer_phone, status, total_amount FROM orders
WHERE store_id = '00000090-1111-1111-1111-111111111111'
ORDER BY customer_phone;
-- EXPECT: 901, 903, 904, 905, 906 con pedido creado; 902 SIN fila (rechazado)


-- ============================================================
-- CLEANUP
-- ============================================================
-- DELETE FROM public.stores WHERE id = '00000090-1111-1111-1111-111111111111';
