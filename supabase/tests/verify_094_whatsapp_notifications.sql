-- ============================================================
-- Manual verification plan for migration 094 (WhatsApp order
-- notifications — queue, consent, trigger, exception isolation, RLS,
-- Wompi order-creation idempotency, WhatsApp status state machine).
--
-- Same approach as verify_090/091: paste into the Supabase Dashboard →
-- SQL Editor for the LINKED STAGING PROJECT and run top to bottom. Never
-- run this against a production project — it inserts real rows into
-- stores/orders/checkout_sessions/whatsapp_notifications (cleaned up at
-- the end, but still real writes). No psql-only syntax (\set, \gset).
-- No real WhatsApp message is ever sent and no real HTTP call to Meta
-- or Wompi is ever made by this script — it only exercises the database
-- layer (triggers, queue, RLS, claim function, the two new SECURITY
-- DEFINER functions from migration 094 sections 9-10). The Edge
-- Functions' own HTTP-facing logic (Meta error classification, webhook
-- signature verification) has no DB-only equivalent and is not covered
-- here — that's `deno check` plus manual staging sends (see the main
-- report's staging checklist).
--
-- EXACT STEPS TO RUN AGAINST STAGING:
--   1. Open the Supabase Dashboard for your STAGING project (not
--      production) → SQL Editor.
--   2. Confirm migration 094 has already been applied there (`supabase
--      db push` against staging, or check Database → Migrations).
--   3. Find-and-replace ALL occurrences of OWNER_ID_HERE with a real
--      auth.users id from THAT project (Dashboard → Authentication →
--      Users → copy the UID of any existing user) — this becomes the
--      owner of stores A and C.
--   4. Find-and-replace ALL occurrences of OTHER_OWNER_ID_HERE with a
--      DIFFERENT real auth.users id from that same project — owner of
--      store B. Two distinct ids are required here (not one reused id,
--      and not a made-up uuid): stores.owner_id has a FK to auth.users,
--      and on_store_created (migration 004) auto-grants that owner_id a
--      store_members row the instant the store is inserted — reusing
--      OWNER_ID_HERE for store B would silently grant it membership
--      there too and scenario 7/10's isolation checks would pass for
--      the wrong reason (no isolation actually being exercised).
--   5. Run section 0 (setup) once. Confirm its EXPECT before continuing.
--   6. Run each numbered scenario (1 through 14) in order, top to
--      bottom — several scenarios depend on rows created by earlier
--      ones (e.g. scenario 8 claims scenario 2's row). Do not skip
--      around.
--   7. Compare each result against its "EXPECT" comment. A mismatch
--      means something in migration 094 (or a dependency it assumes —
--      see the migration header's "Depends on" list) is not behaving as
--      designed; do not proceed to apply this migration to production
--      until every EXPECT holds.
--   8. Run the CLEANUP block at the very end, in the same session.
--
-- All test data uses store slugs 'test-whatsapp-094-a' / '-b' / '-c' and
-- ids prefixed 00000094- so cleanup is a small set of predictable
-- DELETEs, and none of it can collide with real data.
-- ============================================================

-- ============================================================
-- 0. SETUP
-- ============================================================

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000094-1111-1111-1111-111111111111', 'OWNER_ID_HERE', 'Test WhatsApp 094 A', 'test-whatsapp-094-a',
        'Tienda de prueba para migración 094 — borrar después de verificar.', '+57 300 000 0000', 'CO', 'Bogotá', 'COP', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000094-1111-1111-1111-111111111112', 'OTHER_OWNER_ID_HERE', 'Test WhatsApp 094 B', 'test-whatsapp-094-b',
        'Segunda tienda, con OTRO dueño — usada solo para probar aislamiento de RLS.', '+57 300 000 0001', 'CO', 'Bogotá', 'COP', 'active')
ON CONFLICT (id) DO NOTHING;

-- Store C: WhatsApp enabled overall, but customer_order_confirmation_enabled
-- = false — used by scenario 11 to prove a specific disabled EVENT is
-- distinct from the whole feature being disabled (store B's case).
INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000094-1111-1111-1111-111111111113', 'OWNER_ID_HERE', 'Test WhatsApp 094 C', 'test-whatsapp-094-c',
        'Tercera tienda — WhatsApp activo pero confirmación de pedido desactivada.', '+57 300 000 0002', 'CO', 'Bogotá', 'COP', 'active')
ON CONFLICT (id) DO NOTHING;

-- on_store_created (migration 004) already granted OWNER_ID_HERE an
-- owner store_members row on store A and OTHER_OWNER_ID_HERE one on
-- store B automatically — nothing further needed here. OWNER_ID_HERE
-- has no row at all on store B, which is exactly what scenario 7/9
-- rely on.

INSERT INTO public.store_commerce_settings (
  store_id, business_category, catalog_type, commerce_mode, delivery_mode,
  allows_pickup, allows_local_delivery, allows_national_shipping,
  whatsapp_checkout_enabled, web_order_enabled, cash_on_delivery_enabled, online_checkout_enabled,
  default_order_method
)
VALUES
  ('00000094-1111-1111-1111-111111111111', 'retail', 'physical_products', 'local_delivery_and_pickup', 'pickup_only',
   true, false, false, true, true, true, true, 'web_order'),
  ('00000094-1111-1111-1111-111111111112', 'retail', 'physical_products', 'local_delivery_and_pickup', 'pickup_only',
   true, false, false, true, true, true, false, 'web_order'),
  ('00000094-1111-1111-1111-111111111113', 'retail', 'physical_products', 'local_delivery_and_pickup', 'pickup_only',
   true, false, false, true, true, true, false, 'web_order')
ON CONFLICT (store_id) DO UPDATE SET web_order_enabled = true, cash_on_delivery_enabled = true, online_checkout_enabled = true;

INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000094-2222-2222-2222-222222222221', '00000094-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
        'Producto WhatsApp Test', 'producto-whatsapp-094', 'Producto simple para probar notificaciones.', 20000, NULL, 50, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

-- Same product data, but belonging to store B (WhatsApp disabled) — used
-- by scenario 5.
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000094-2222-2222-2222-222222222231', '00000094-1111-1111-1111-111111111112', 'OWNER_ID_HERE',
        'Producto WhatsApp Test B', 'producto-whatsapp-094-b', 'Producto simple en la tienda con WhatsApp deshabilitado.', 20000, NULL, 50, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

-- Store C's product — used by scenario 11 (confirmación de pedido
-- desactivada, feature otherwise enabled).
INSERT INTO public.products (id, store_id, owner_id, name, slug, description, regular_price, sale_price, stock, track_inventory, status, category)
VALUES ('00000094-2222-2222-2222-222222222241', '00000094-1111-1111-1111-111111111113', 'OWNER_ID_HERE',
        'Producto WhatsApp Test C', 'producto-whatsapp-094-c', 'Producto simple en la tienda con confirmación de pedido desactivada.', 20000, NULL, 50, true, 'active', 'Test')
ON CONFLICT (id) DO NOTHING;

-- WhatsApp enabled + order_received on for store A.
INSERT INTO public.store_whatsapp_settings (store_id, enabled, sender_mode, customer_order_confirmation_enabled, locale)
VALUES ('00000094-1111-1111-1111-111111111111', true, 'central', true, 'es_CO')
ON CONFLICT (store_id) DO UPDATE SET enabled = true, customer_order_confirmation_enabled = true;

-- Store B: WhatsApp deliberately left disabled (no settings row) — used
-- by scenario 3.

-- Store C: WhatsApp enabled overall, but this specific event disabled —
-- used by scenario 11.
INSERT INTO public.store_whatsapp_settings (store_id, enabled, sender_mode, customer_order_confirmation_enabled, locale)
VALUES ('00000094-1111-1111-1111-111111111113', true, 'central', false, 'es_CO')
ON CONFLICT (store_id) DO UPDATE SET enabled = true, customer_order_confirmation_enabled = false;

COMMIT;

-- Sanity check.
SELECT
  (SELECT count(*) FROM stores WHERE id IN ('00000094-1111-1111-1111-111111111111', '00000094-1111-1111-1111-111111111112', '00000094-1111-1111-1111-111111111113')) AS stores,
  (SELECT count(*) FROM store_whatsapp_settings WHERE store_id = '00000094-1111-1111-1111-111111111111') AS settings_a,
  (SELECT count(*) FROM store_whatsapp_settings WHERE store_id = '00000094-1111-1111-1111-111111111112') AS settings_b,
  (SELECT count(*) FROM store_whatsapp_settings WHERE store_id = '00000094-1111-1111-1111-111111111113') AS settings_c,
  (SELECT count(*) FROM payment_providers WHERE code = 'wompi') AS wompi_provider_seeded;
-- EXPECT: stores=3, settings_a=1, settings_b=0, settings_c=1, wompi_provider_seeded=1
-- (if wompi_provider_seeded=0, migration 003's seed didn't run in this
-- environment — scenario 13 below will fail on the payment_providers
-- lookup; seed it manually or skip scenario 14)


-- ============================================================
-- 1. normalize_whatsapp_phone — formatos válidos e inválidos
-- ============================================================
SELECT
  normalize_whatsapp_phone('3001234567', 'CO')      AS a,  -- EXPECT +573001234567
  normalize_whatsapp_phone('573001234567', 'CO')     AS b,  -- EXPECT +573001234567
  normalize_whatsapp_phone('+573001234567', 'CO')    AS c,  -- EXPECT +573001234567
  normalize_whatsapp_phone('03001234567', 'CO')      AS d,  -- EXPECT +573001234567
  normalize_whatsapp_phone('123', 'CO')              AS e,  -- EXPECT NULL
  normalize_whatsapp_phone('', 'CO')                 AS f,  -- EXPECT NULL
  normalize_whatsapp_phone(NULL, 'CO')               AS g,  -- EXPECT NULL
  normalize_whatsapp_phone('6141234567', 'CO')       AS h;  -- EXPECT NULL (10 digits but not starting with 3 — landline, not accepted)


-- ============================================================
-- 2. Pedido CON consentimiento y teléfono válido
-- EXPECT: order created, exactly one whatsapp_notifications row,
--         status='queued', event_type='order_received'.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-whatsapp-094-a',
  p_customer_name := 'Cliente Consentido',
  p_customer_phone := '3000000941',
  p_items := '[{"product_id": "00000094-2222-2222-2222-222222222221", "quantity": 1}]'::jsonb,
  p_whatsapp_consent := true
);

SELECT wn.status, wn.event_type, wn.recipient_phone, wn.template_name, o.whatsapp_consent
FROM whatsapp_notifications wn JOIN orders o ON o.id = wn.order_id
WHERE o.store_id = '00000094-1111-1111-1111-111111111111' AND o.customer_phone = '3000000941';
-- EXPECT: status=queued, event_type=order_received, recipient_phone=+573000000941 wait — 3000000941 has 10 digits starting with 3, normalizes to +573000000941; template_name=melosoft_order_confirmation_v1, whatsapp_consent=true


-- ============================================================
-- 3. Pedido SIN consentimiento
-- EXPECT: order created, NO whatsapp_notifications row at all (not
--         even a failed one — consent is checked before anything else).
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-whatsapp-094-a',
  p_customer_name := 'Cliente Sin Consentimiento',
  p_customer_phone := '3000000942',
  p_items := '[{"product_id": "00000094-2222-2222-2222-222222222221", "quantity": 1}]'::jsonb,
  p_whatsapp_consent := false
);

SELECT count(*) FROM whatsapp_notifications wn JOIN orders o ON o.id = wn.order_id
WHERE o.store_id = '00000094-1111-1111-1111-111111111111' AND o.customer_phone = '3000000942';
-- EXPECT: 0


-- ============================================================
-- 4. Pedido CON consentimiento pero teléfono inválido
-- EXPECT: order created, ONE whatsapp_notifications row with
--         status='invalid_recipient' (NOT 'failed' — Meta is never
--         called for this row, so it must not look like a provider
--         failure), last_error_category='invalid_phone',
--         is_permanent_failure=true, attempts=0.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-whatsapp-094-a',
  p_customer_name := 'Cliente Telefono Invalido',
  p_customer_phone := '123',
  p_items := '[{"product_id": "00000094-2222-2222-2222-222222222221", "quantity": 1}]'::jsonb,
  p_whatsapp_consent := true
);

SELECT wn.status, wn.last_error_category, wn.is_permanent_failure, wn.attempts
FROM whatsapp_notifications wn JOIN orders o ON o.id = wn.order_id
WHERE o.store_id = '00000094-1111-1111-1111-111111111111' AND o.customer_phone = '123';
-- EXPECT: status=invalid_recipient, last_error_category=invalid_phone, is_permanent_failure=true, attempts=0


-- ============================================================
-- 4b. Pedido CON consentimiento pero teléfono VACÍO (distinct scenario
--     from 4 — same normalize_whatsapp_phone NULL result, but worth
--     confirming explicitly since it's a different real-world input:
--     a customer record with no phone captured at all).
-- EXPECT: same as scenario 4 — status='invalid_recipient', Meta never
--         called, order still created normally.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-whatsapp-094-a',
  p_customer_name := 'Cliente Sin Telefono',
  p_customer_phone := '',
  p_items := '[{"product_id": "00000094-2222-2222-2222-222222222221", "quantity": 1}]'::jsonb,
  p_whatsapp_consent := true
);

SELECT o.id IS NOT NULL AS order_exists, wn.status, wn.last_error_category
FROM orders o
LEFT JOIN whatsapp_notifications wn ON wn.order_id = o.id
WHERE o.store_id = '00000094-1111-1111-1111-111111111111' AND o.customer_phone = '' AND o.customer_name = 'Cliente Sin Telefono';
-- EXPECT: order_exists=true, status=invalid_recipient, last_error_category=invalid_phone


-- ============================================================
-- 5. Tienda con WhatsApp deshabilitado (store B — sin fila de settings)
-- EXPECT: order created normally, NO whatsapp_notifications row, even
--         with consent=true and a valid phone.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-whatsapp-094-b',
  p_customer_name := 'Cliente Tienda B',
  p_customer_phone := '3000000943',
  p_items := '[{"product_id": "00000094-2222-2222-2222-222222222231", "quantity": 1}]'::jsonb,
  p_whatsapp_consent := true
);

SELECT count(*) FROM whatsapp_notifications wn JOIN orders o ON o.id = wn.order_id
WHERE o.store_id = '00000094-1111-1111-1111-111111111112' AND o.customer_phone = '3000000943';
-- EXPECT: 0


-- ============================================================
-- 6. Idempotencia: no se puede encolar el mismo evento dos veces para
--    el mismo pedido (protege contra un trigger duplicado o un retry
--    de webhook de Wompi).
-- EXPECT: the direct duplicate insert is rejected by the unique index.
-- ============================================================
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  SELECT o.id INTO v_order_id FROM orders o
  WHERE o.store_id = '00000094-1111-1111-1111-111111111111' AND o.customer_phone = '3000000941';

  BEGIN
    INSERT INTO whatsapp_notifications (store_id, order_id, event_type, recipient_phone, template_name)
    VALUES ('00000094-1111-1111-1111-111111111111', v_order_id, 'order_received', '+573000000941', 'melosoft_order_confirmation_v1');
    RAISE EXCEPTION 'TEST FAILED: duplicate insert should have been rejected by the unique index';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK: duplicate event correctly rejected by whatsapp_notifications_idempotent_uq';
  END;
END $$;


-- ============================================================
-- 7. RLS: el owner de la tienda A puede ver sus notificaciones, pero NO
--    las de una tienda de la que no es miembro (tienda B), aunque sea
--    el mismo uid real.
-- ============================================================
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "OWNER_ID_HERE", "role": "authenticated"}';

SELECT count(*) FROM whatsapp_notifications WHERE store_id = '00000094-1111-1111-1111-111111111111';
-- EXPECT: 3 (scenario 2's queued row + scenario 4's invalid_recipient
-- row + scenario 4b's invalid_recipient row)

SELECT count(*) FROM whatsapp_notifications WHERE store_id = '00000094-1111-1111-1111-111111111112';
-- EXPECT: 0 — RLS hides store B's rows even though B exists and this
-- uid can read store A fine, because there is no store_members row for
-- this uid on store B.
COMMIT;


-- ============================================================
-- 8. claim_pending_whatsapp_notifications — claim + no double-claim,
--    then reclaim after the lock goes stale.
-- ============================================================

-- First claim: should pick up the 'queued' row from scenario 2.
SELECT id, status, attempts, locked_by FROM claim_pending_whatsapp_notifications(10, 'test-worker-1');
-- EXPECT: one row (scenario 2's), status now 'sending', attempts=1, locked_by='test-worker-1'

-- Second claim immediately after: must NOT re-claim the same row (still
-- locked, well within the 2-minute staleness window).
SELECT count(*) FROM claim_pending_whatsapp_notifications(10, 'test-worker-2');
-- EXPECT: 0

-- Simulate a crashed worker: backdate locked_at past the 2-minute window.
UPDATE whatsapp_notifications
SET locked_at = now() - interval '5 minutes'
WHERE store_id = '00000094-1111-1111-1111-111111111111' AND status = 'sending';

SELECT id, status, attempts, locked_by FROM claim_pending_whatsapp_notifications(10, 'test-worker-3');
-- EXPECT: the same row, now attempts=2, locked_by='test-worker-3' — recovered
-- from a stale lock instead of being stuck forever.


-- ============================================================
-- 9. enqueue_test_whatsapp_notification — autorización + rate limit
-- ============================================================
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "OWNER_ID_HERE", "role": "authenticated"}';

SELECT enqueue_test_whatsapp_notification('00000094-1111-1111-1111-111111111111', '3000000999');
SELECT enqueue_test_whatsapp_notification('00000094-1111-1111-1111-111111111111', '3000000999');
SELECT enqueue_test_whatsapp_notification('00000094-1111-1111-1111-111111111111', '3000000999');
-- EXPECT: three uuids returned, no error.

SELECT enqueue_test_whatsapp_notification('00000094-1111-1111-1111-111111111111', '3000000999');
-- EXPECT: ERROR: TEST_RATE_LIMIT_EXCEEDED (4th test send within the hour)
COMMIT;

BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "OWNER_ID_HERE", "role": "authenticated"}';

SELECT enqueue_test_whatsapp_notification('00000094-1111-1111-1111-111111111112', '3000000999');
-- EXPECT: ERROR: NOT_AUTHORIZED — this uid has no store_members row on
-- store B, so has_store_role(...) fails even though it's a valid owner
-- elsewhere.
COMMIT;


-- ============================================================
-- 10. RLS: anon has NO access at all to configuraciones ni notificaciones
--     — not even SELECT. Public storefront visitors and the checkout
--     flow (which runs as anon) must never be able to read this data.
-- ============================================================
BEGIN;
SET LOCAL role anon;

SELECT count(*) FROM store_whatsapp_settings WHERE store_id = '00000094-1111-1111-1111-111111111111';
-- EXPECT: 0 — no RLS policy grants anon SELECT on this table at all.

SELECT count(*) FROM whatsapp_notifications WHERE store_id = '00000094-1111-1111-1111-111111111111';
-- EXPECT: 0 — same: zero anon-facing SELECT policies on this table.

DO $$
BEGIN
  BEGIN
    INSERT INTO whatsapp_notifications (store_id, order_id, event_type, recipient_phone, template_name)
    VALUES ('00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000000', 'melosoft_whatsapp_test_v1');
    RAISE EXCEPTION 'TEST FAILED: anon should never be able to INSERT into whatsapp_notifications';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: anon correctly denied INSERT on whatsapp_notifications';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO store_whatsapp_settings (store_id, enabled) VALUES ('00000094-1111-1111-1111-111111111111', true);
    RAISE EXCEPTION 'TEST FAILED: anon should never be able to INSERT into store_whatsapp_settings';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: anon correctly denied INSERT on store_whatsapp_settings';
  END;
END $$;
COMMIT;


-- ============================================================
-- 11. Confirmación de pedidos desactivada (WhatsApp enabled overall,
--     store C) — distinct from store B (whole feature disabled).
-- EXPECT: order created normally, NO whatsapp_notifications row, even
--         with consent=true and a valid phone — because
--         customer_order_confirmation_enabled=false specifically.
-- ============================================================
SELECT create_store_order(
  p_store_slug := 'test-whatsapp-094-c',
  p_customer_name := 'Cliente Tienda C',
  p_customer_phone := '3000000944',
  p_items := '[{"product_id": "00000094-2222-2222-2222-222222222241", "quantity": 1}]'::jsonb,
  p_whatsapp_consent := true
);

SELECT count(*) FROM whatsapp_notifications wn JOIN orders o ON o.id = wn.order_id
WHERE o.store_id = '00000094-1111-1111-1111-111111111113' AND o.customer_phone = '3000000944';
-- EXPECT: 0


-- ============================================================
-- 12. El pedido SOBREVIVE a un fallo deliberado del encolado de WhatsApp
--     — proves the EXCEPTION block in enqueue_whatsapp_order_notification
--     actually isolates the order transaction from a bug in the trigger.
--
--     STAGING ONLY. NEVER RUN THIS SCENARIO AGAINST A PRODUCTION
--     PROJECT — it deliberately breaks normalize_whatsapp_phone, a
--     function every real checkout in every store depends on, even
--     though the breakage is designed to never survive past this block.
--
--     Method, and why it's safe even if something goes wrong mid-way:
--     the CREATE OR REPLACE that breaks the function, the test order,
--     and every assertion all run inside ONE explicit transaction that
--     ends in ROLLBACK, never COMMIT. CREATE OR REPLACE FUNCTION is
--     transactional DDL in Postgres — rolling back this transaction
--     reverts the function to whatever it was immediately before this
--     block ran, with the exact same guarantee as any other undone
--     write in the same transaction. This is deliberately NOT a
--     "save the original body as text, then CREATE OR REPLACE it back
--     afterward" approach: that pattern is fragile (a transcription
--     mistake would leave a subtly wrong function in place) and does
--     NOT protect against the script dying mid-way. This one does,
--     automatically, because of two independent facts:
--       1. If any statement below fails unexpectedly, Postgres aborts
--          the transaction — nothing before the eventual ROLLBACK (or
--          the connection closing) is ever visible outside it.
--       2. If the SQL Editor tab is closed, the connection drops, or
--          anything else terminates the session before an explicit
--          ROLLBACK is reached, Postgres itself rolls back any
--          open, uncommitted transaction on disconnect. There is no
--          code path — error, crash, or human closing the tab — that
--          leaves the broken function committed.
--     Do not add a COMMIT anywhere in this block.
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_phone(
  p_phone   text,
  p_country text DEFAULT 'CO'
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RAISE EXCEPTION 'DELIBERATE_TEST_FAILURE_094_SCENARIO_12';
END;
$$;

SELECT create_store_order(
  p_store_slug := 'test-whatsapp-094-a',
  p_customer_name := 'Cliente Fallo Encolado',
  p_customer_phone := '3000000945',
  p_items := '[{"product_id": "00000094-2222-2222-2222-222222222221", "quantity": 1}]'::jsonb,
  p_whatsapp_consent := true
);
-- EXPECT: succeeds and returns a normal jsonb result with order_id/
-- order_number — NOT an error, even though normalize_whatsapp_phone
-- above always raises within this same transaction. If this statement
-- itself errors, the EXCEPTION block failed to isolate the order from
-- the notification bug — that would be the test failing, not passing.

SELECT
  (SELECT count(*) FROM orders WHERE store_id = '00000094-1111-1111-1111-111111111111' AND customer_phone = '3000000945') AS order_created,
  (SELECT count(*) FROM whatsapp_notifications wn JOIN orders o ON o.id = wn.order_id
   WHERE o.store_id = '00000094-1111-1111-1111-111111111111' AND o.customer_phone = '3000000945') AS notification_rows,
  (SELECT status FROM orders WHERE store_id = '00000094-1111-1111-1111-111111111111' AND customer_phone = '3000000945') AS order_status;
-- EXPECT (read these BEFORE the ROLLBACK below — they won't exist
-- after it): order_created=1, notification_rows=0 (the enqueue attempt
-- failed and was swallowed — no row exists, but crucially no error
-- propagated either), order_status='pending' — a completely normal
-- order, indistinguishable from one where WhatsApp was never involved.
-- The corresponding RAISE WARNING ('whatsapp_notification_enqueue_failed
-- order_id=... store_id=... sqlstate=...') should be visible in
-- Supabase's Postgres Logs for this timestamp if you want to confirm
-- the sanitized diagnostic fired too (logs are not rolled back with
-- the transaction — they already happened by the time WARNING is
-- emitted).

ROLLBACK;

-- Sanity check, in a fresh statement/transaction, that normal_whatsapp_
-- phone is exactly as it was before this scenario ran (the ROLLBACK
-- above undid the CREATE OR REPLACE, the test order, and the
-- notification-attempt row together, atomically).
SELECT normalize_whatsapp_phone('3001234567', 'CO') AS restored_ok;
-- EXPECT: +573001234567 (NOT an error — if this raises, the ROLLBACK
-- above did not happen, e.g. because a COMMIT was mistakenly added, and
-- every later scenario's phone handling is now suspect. Stop and
-- investigate before continuing — do not proceed to scenario 13.)

SELECT count(*) FROM orders WHERE store_id = '00000094-1111-1111-1111-111111111111' AND customer_phone = '3000000945';
-- EXPECT: 0 — the test order from inside the rolled-back transaction
-- does not exist here, confirming the ROLLBACK really did undo
-- everything in that block, not just the function.


-- ============================================================
-- 13. create_order_from_wompi_approved_session — a checkout_session can
--     only ever produce ONE order, and only ONE WhatsApp notification,
--     even when "the same webhook" is processed twice.
--
--     Two sequential calls with the same checkout_session_id stand in
--     for two webhook deliveries. This proves idempotency of repeated/
--     retried calls; it does NOT prove true concurrent-transaction
--     racing (that needs two simultaneous sessions, which a single
--     SQL Editor script can't produce) — the SELECT ... FOR UPDATE lock
--     inside the function is what provides that guarantee, verified by
--     code review (see migration 094 section 9's header comment), not
--     by this script.
-- ============================================================
INSERT INTO public.checkout_sessions (
  id, store_id, store_slug, provider, provider_reference, amount_in_cents, currency, status,
  customer_name, customer_phone, fulfillment_method, items_snapshot,
  subtotal_amount, shipping_amount, total_amount, checkout_url,
  whatsapp_consent, whatsapp_consent_at, whatsapp_consent_source, whatsapp_consent_version,
  expires_at
) VALUES (
  '00000094-7777-7777-7777-777777777701', '00000094-1111-1111-1111-111111111111', 'test-whatsapp-094-a',
  'wompi', 'CS-TEST-094-WOMPI-001', 2000000, 'COP', 'created',
  'Cliente Wompi Test', '3000000950', 'pickup',
  '[{"product_id": "00000094-2222-2222-2222-222222222221", "variant_id": null, "product_name": "Producto WhatsApp Test", "product_slug": "producto-whatsapp-094", "product_image_url": null, "variant_label": null, "variant_sku": null, "quantity": 1, "unit_price": 20000, "total_price": 20000, "customization_notes": null}]'::jsonb,
  20000, 0, 20000, 'https://example.com/checkout-test-094',
  true, now(), 'checkout_web', 'v1',
  now() + interval '2 hours'
)
ON CONFLICT (id) DO NOTHING;

SELECT create_order_from_wompi_approved_session(
  '00000094-7777-7777-7777-777777777701', 'WOMPI-TXN-TEST-094-001', 'CARD', '{}'::jsonb
);
-- EXPECT: {"outcome": "created", "order_id": "...", "order_number": "..."}

-- Second "delivery" of the same webhook for the same session.
SELECT create_order_from_wompi_approved_session(
  '00000094-7777-7777-7777-777777777701', 'WOMPI-TXN-TEST-094-001', 'CARD', '{}'::jsonb
);
-- EXPECT: {"outcome": "already_created", "order_id": "..."} — SAME
-- order_id as the first call, no new order created.

SELECT
  (SELECT count(*) FROM orders WHERE store_id = '00000094-1111-1111-1111-111111111111' AND customer_phone = '3000000950') AS orders_created,
  (SELECT count(*) FROM whatsapp_notifications wn JOIN orders o ON o.id = wn.order_id
   WHERE o.customer_phone = '3000000950') AS notifications_created,
  (SELECT order_id FROM checkout_sessions WHERE id = '00000094-7777-7777-7777-777777777701') AS session_order_id;
-- EXPECT: orders_created=1 (never 2, despite two calls),
-- notifications_created=1 (the orders AFTER INSERT trigger only ever
-- fired once, because only one INSERT INTO orders ever happened),
-- session_order_id = the same order_id returned by both calls above.

-- Defense-in-depth check: the UNIQUE constraint on checkout_sessions.
-- order_id must independently reject two DIFFERENT sessions ever
-- pointing at the same order — even though the FOR UPDATE lock inside
-- create_order_from_wompi_approved_session is what actually prevents
-- this from happening in practice. A second, unrelated session
-- (created fresh here, never passed through the function above) trying
-- to claim scenario 13's order_id directly must be rejected by Postgres
-- itself, not just by application logic.
INSERT INTO public.checkout_sessions (
  id, store_id, store_slug, provider, provider_reference, amount_in_cents, currency, status,
  customer_name, customer_phone, fulfillment_method, items_snapshot,
  subtotal_amount, shipping_amount, total_amount, checkout_url, expires_at
) VALUES (
  '00000094-7777-7777-7777-777777777702', '00000094-1111-1111-1111-111111111111', 'test-whatsapp-094-a',
  'wompi', 'CS-TEST-094-WOMPI-002', 2000000, 'COP', 'created',
  'Cliente Wompi Test 2', '3000000951', 'pickup', '[]'::jsonb,
  20000, 0, 20000, 'https://example.com/checkout-test-094-2',
  now() + interval '2 hours'
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  BEGIN
    UPDATE checkout_sessions
    SET order_id = (SELECT order_id FROM checkout_sessions WHERE id = '00000094-7777-7777-7777-777777777701')
    WHERE id = '00000094-7777-7777-7777-777777777702';
    RAISE EXCEPTION 'TEST FAILED: checkout_sessions_order_id_unique should have rejected a second session reusing the same order_id';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK: checkout_sessions.order_id UNIQUE constraint holds as a defense-in-depth backstop';
  END;
END $$;


-- ============================================================
-- 14. apply_whatsapp_status_event — the corrected state machine.
--     Each row below is independent (distinct provider_message_id) so
--     the scenarios don't interact with each other.
-- ============================================================
INSERT INTO whatsapp_notifications (id, store_id, order_id, event_type, recipient_phone, template_name, status, provider_message_id)
VALUES
  ('00000094-8888-8888-8888-888888888801', '00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000961', 'melosoft_whatsapp_test_v1', 'sent',      'wamid.TEST094.progression'),
  ('00000094-8888-8888-8888-888888888802', '00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000962', 'melosoft_whatsapp_test_v1', 'read',      'wamid.TEST094.read_to_sent'),
  ('00000094-8888-8888-8888-888888888803', '00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000963', 'melosoft_whatsapp_test_v1', 'delivered', 'wamid.TEST094.delivered_to_sent'),
  ('00000094-8888-8888-8888-888888888804', '00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000964', 'melosoft_whatsapp_test_v1', 'read',      'wamid.TEST094.read_to_failed'),
  ('00000094-8888-8888-8888-888888888805', '00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000965', 'melosoft_whatsapp_test_v1', 'delivered', 'wamid.TEST094.delivered_to_failed'),
  ('00000094-8888-8888-8888-888888888806', '00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000966', 'melosoft_whatsapp_test_v1', 'sent',      'wamid.TEST094.failed_to_delivered'),
  ('00000094-8888-8888-8888-888888888807', '00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000967', 'melosoft_whatsapp_test_v1', 'sent',      'wamid.TEST094.repeated_event'),
  ('00000094-8888-8888-8888-888888888808', '00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000968', 'melosoft_whatsapp_test_v1', 'sent',      'wamid.TEST094.unknown_status'),
  ('00000094-8888-8888-8888-888888888809', '00000094-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000969', 'melosoft_whatsapp_test_v1', 'sent',      'wamid.TEST094.late_event')
ON CONFLICT (id) DO NOTHING;

-- 14a. sent → delivered → read (normal progression).
SELECT apply_whatsapp_status_event('wamid.TEST094.progression', 'delivered');
SELECT apply_whatsapp_status_event('wamid.TEST094.progression', 'read');
SELECT status FROM whatsapp_notifications WHERE provider_message_id = 'wamid.TEST094.progression';
-- EXPECT: read

-- 14b. read → sent (backwards — must be a no-op, stays read).
SELECT apply_whatsapp_status_event('wamid.TEST094.read_to_sent', 'sent');
SELECT status FROM whatsapp_notifications WHERE provider_message_id = 'wamid.TEST094.read_to_sent';
-- EXPECT: read (unchanged)

-- 14c. delivered → sent (backwards — no-op, stays delivered).
SELECT apply_whatsapp_status_event('wamid.TEST094.delivered_to_sent', 'sent');
SELECT status FROM whatsapp_notifications WHERE provider_message_id = 'wamid.TEST094.delivered_to_sent';
-- EXPECT: delivered (unchanged)

-- 14d. read → failed (must NOT downgrade a terminal positive status to failed).
SELECT apply_whatsapp_status_event('wamid.TEST094.read_to_failed', 'failed', '131026', 'Message undeliverable');
SELECT status, last_error_category FROM whatsapp_notifications WHERE provider_message_id = 'wamid.TEST094.read_to_failed';
-- EXPECT: read, last_error_category=NULL (failed was rejected outright, nothing recorded)

-- 14e. delivered → failed (same rule — delivered must not become failed).
SELECT apply_whatsapp_status_event('wamid.TEST094.delivered_to_failed', 'failed', '131026', 'Message undeliverable');
SELECT status, last_error_category FROM whatsapp_notifications WHERE provider_message_id = 'wamid.TEST094.delivered_to_failed';
-- EXPECT: delivered, last_error_category=NULL

-- 14f. failed → delivered (documented decision: failed is terminal by
--      default — see migration 094 section 10's header comment for why).
SELECT apply_whatsapp_status_event('wamid.TEST094.failed_to_delivered', 'failed', '131026', 'Message undeliverable');
SELECT apply_whatsapp_status_event('wamid.TEST094.failed_to_delivered', 'delivered');
SELECT status FROM whatsapp_notifications WHERE provider_message_id = 'wamid.TEST094.failed_to_delivered';
-- EXPECT: failed (the 'failed' from the first call applied — sent is
-- pre-delivery; the 'delivered' from the second call was rejected)

-- 14g. Repeated event (same status arriving twice — must be a no-op the
--      second time, not an error, not a duplicate side-effect).
SELECT apply_whatsapp_status_event('wamid.TEST094.repeated_event', 'sent');
SELECT apply_whatsapp_status_event('wamid.TEST094.repeated_event', 'sent') AS second_call_result;
-- EXPECT: second_call_result shows applied=false (matched=true, but no
-- change — rank(sent) is not > rank(sent))
SELECT status FROM whatsapp_notifications WHERE provider_message_id = 'wamid.TEST094.repeated_event';
-- EXPECT: sent

-- 14h. Unknown status string — ignored safely, no error, no match.
SELECT apply_whatsapp_status_event('wamid.TEST094.unknown_status', 'some_future_status_meta_might_add') AS unknown_result;
-- EXPECT: {"matched": false, "applied": false, "reason": "unknown_status"}
SELECT status FROM whatsapp_notifications WHERE provider_message_id = 'wamid.TEST094.unknown_status';
-- EXPECT: sent (untouched)

-- 14i. Evento atrasado — full realistic sequence: progresses normally to
--      'read', then a late 'sent' redelivery (Meta or network-level
--      out-of-order delivery) arrives afterward and must not regress it.
SELECT apply_whatsapp_status_event('wamid.TEST094.late_event', 'delivered');
SELECT apply_whatsapp_status_event('wamid.TEST094.late_event', 'read');
SELECT apply_whatsapp_status_event('wamid.TEST094.late_event', 'sent'); -- the late arrival
SELECT status FROM whatsapp_notifications WHERE provider_message_id = 'wamid.TEST094.late_event';
-- EXPECT: read (the late 'sent' had no effect)

-- 14j. Unmatched provider_message_id (no row has it) — safe no-op.
SELECT apply_whatsapp_status_event('wamid.TEST094.does_not_exist', 'delivered') AS not_found_result;
-- EXPECT: {"matched": false, "applied": false, "reason": "not_found"}


-- ============================================================
-- Resumen final
-- ============================================================
SELECT event_type, status, count(*) FROM whatsapp_notifications
WHERE store_id = '00000094-1111-1111-1111-111111111111'
GROUP BY event_type, status
ORDER BY event_type, status;


-- ============================================================
-- CLEANUP — run this in the same staging session once every EXPECT
-- above has been checked. Uncomment and execute (kept commented so
-- pasting the whole script doesn't silently wipe test data before
-- you've reviewed the results).
-- ============================================================
-- DELETE FROM public.stores WHERE id IN (
--   '00000094-1111-1111-1111-111111111111',
--   '00000094-1111-1111-1111-111111111112',
--   '00000094-1111-1111-1111-111111111113'
-- );
-- (cascades to store_commerce_settings, store_members, products,
--  store_whatsapp_settings, orders, order_items, order_item_customizations,
--  checkout_sessions, inventory_movements, whatsapp_notifications — all
--  via ON DELETE CASCADE on their own store_id FK. This also removes the
--  scenario 14 synthetic rows, which have order_id=NULL but still carry
--  store_id = store A.)
--
-- Verify nothing is left behind:
-- SELECT
--   (SELECT count(*) FROM stores WHERE id::text LIKE '00000094-%') AS stores_left,
--   (SELECT count(*) FROM whatsapp_notifications WHERE id::text LIKE '00000094-%') AS notifications_left,
--   (SELECT count(*) FROM checkout_sessions WHERE id::text LIKE '00000094-%') AS checkout_sessions_left;
-- EXPECT: stores_left=0, notifications_left=0, checkout_sessions_left=0
