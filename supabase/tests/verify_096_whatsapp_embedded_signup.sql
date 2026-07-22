-- ============================================================
-- Manual verification plan for migration 096 (WhatsApp Modelo B —
-- per-store Embedded Signup connections).
--
-- Same approach as verify_094: paste into the Supabase Dashboard → SQL
-- Editor for a STAGING project and run top to bottom. Never run against
-- production. No real call to Meta happens anywhere in this script —
-- store_whatsapp_connection_save is called directly with a FAKE token
-- string ('fake-token-...'), standing in for what the
-- whatsapp-embedded-signup Edge Function would pass after a real
-- Embedded Signup completes. That Edge Function's own logic (the code
-- exchange, WABA/phone verification calls to Meta, JWT/role check) has
-- no DB-only equivalent and is NOT covered here — it needs a live
-- Config ID and manual testing from the browser (see the main report's
-- staging checklist) or a mocked-fetch Deno test.
--
-- Likewise, "Pedido COD" / "Pedido Wompi" / "Error de Meta sin afectar
-- el pedido" from the required scenario list are Edge-Function-level
-- integration behavior, not new SQL introduced by 096 — migration 094's
-- own verify_094 script already covers the trigger's exception-safety,
-- which 096 does not touch.
--
-- HOW TO RUN:
--   1. Find-and-replace OWNER_ID_HERE / OTHER_OWNER_ID_HERE exactly as
--      in verify_094 — two distinct real auth.users ids.
--   2. Run section 0 once, then each scenario in order.
--   3. Run CLEANUP at the end.
-- ============================================================

-- ============================================================
-- 0. SETUP — two stores, same convention/ids as verify_094 but a
--    distinct id prefix (00000096-) so cleanup never collides.
-- ============================================================

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000096-1111-1111-1111-111111111111', 'OWNER_ID_HERE', 'Test WA096 A', 'test-wa096-a',
        'Tienda de prueba migración 096 — borrar después.', '+57 300 000 0000', 'CO', 'Bogotá', 'COP', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000096-1111-1111-1111-111111111112', 'OTHER_OWNER_ID_HERE', 'Test WA096 B', 'test-wa096-b',
        'Segunda tienda, OTRO dueño — aislamiento RLS.', '+57 300 000 0001', 'CO', 'Bogotá', 'COP', 'active')
ON CONFLICT (id) DO NOTHING;

COMMIT;

SELECT count(*) AS stores_created FROM stores WHERE id IN (
  '00000096-1111-1111-1111-111111111111', '00000096-1111-1111-1111-111111111112'
);
-- EXPECT: 2


-- ============================================================
-- 1. store_whatsapp_connection_save — first connection for store A.
-- EXPECT: connection row created, connection_status=connected,
--         token_secret_reference set, NO token in the row itself.
-- ============================================================
SELECT store_whatsapp_connection_save(
  p_store_id             := '00000096-1111-1111-1111-111111111111',
  p_meta_business_id     := 'biz-A-001',
  p_waba_id              := 'waba-A-001',
  p_phone_number_id      := 'phone-A-001',
  p_display_phone_number := '+57 300 111 1111',
  p_verified_name        := 'Tienda A Test',
  p_onboarding_type      := 'new_number',
  p_coexistence_enabled  := false,
  p_access_token         := 'fake-token-store-a',
  p_connected_by         := 'OWNER_ID_HERE'::uuid
);
-- EXPECT: {"ok": true, "store_id": "...", "connection_status": "connected"}

SELECT store_id, connection_status, phone_number_id, token_secret_reference,
       token_secret_reference = 'whatsapp_token_00000096-1111-1111-1111-111111111111' AS secret_name_correct
FROM store_whatsapp_connections WHERE store_id = '00000096-1111-1111-1111-111111111111';
-- EXPECT: connection_status=connected, phone_number_id=phone-A-001, secret_name_correct=true

-- Column-level check: token itself is never a normal column value.
-- (This asserts the schema shape, not a runtime leak — there is no
-- column named anything like access_token/token on this table at all;
-- selecting * above already proves it, this is just explicit.)
SELECT count(*) AS token_columns FROM information_schema.columns
WHERE table_name = 'store_whatsapp_connections' AND column_name ILIKE '%token%' AND column_name != 'token_secret_reference';
-- EXPECT: 0

SELECT count(*) AS event_logged FROM store_whatsapp_connection_events
WHERE store_id = '00000096-1111-1111-1111-111111111111' AND event_type = 'connect_succeeded';
-- EXPECT: 1


-- ============================================================
-- 2. phone_number_id duplicado — store B tries to claim store A's
--    phone_number_id.
-- EXPECT: ERROR PHONE_NUMBER_ALREADY_CONNECTED. No row created/altered
--         for store B.
-- ============================================================
DO $$
BEGIN
  BEGIN
    PERFORM store_whatsapp_connection_save(
      p_store_id             := '00000096-1111-1111-1111-111111111112',
      p_meta_business_id     := 'biz-B-001',
      p_waba_id              := 'waba-B-001',
      p_phone_number_id      := 'phone-A-001', -- same as store A
      p_display_phone_number := '+57 300 111 1111',
      p_verified_name        := 'Tienda B Test',
      p_onboarding_type      := 'new_number',
      p_coexistence_enabled  := false,
      p_access_token         := 'fake-token-store-b',
      p_connected_by         := 'OTHER_OWNER_ID_HERE'::uuid
    );
    RAISE EXCEPTION 'TEST FAILED: duplicate phone_number_id should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%PHONE_NUMBER_ALREADY_CONNECTED%' THEN
      RAISE NOTICE 'OK: duplicate phone_number_id correctly rejected';
    ELSE
      RAISE; -- a different, unexpected error — surface it
    END IF;
  END;
END $$;

SELECT count(*) FROM store_whatsapp_connections WHERE store_id = '00000096-1111-1111-1111-111111111112';
-- EXPECT: 0 — store B never got a connection row out of the rejected attempt

SELECT count(*) FROM store_whatsapp_connection_events
WHERE store_id = '00000096-1111-1111-1111-111111111112' AND event_type = 'duplicate_phone_rejected';
-- EXPECT: 1


-- ============================================================
-- 3. Store B connects its OWN, different number — should succeed.
-- ============================================================
SELECT store_whatsapp_connection_save(
  p_store_id             := '00000096-1111-1111-1111-111111111112',
  p_meta_business_id     := 'biz-B-001',
  p_waba_id              := 'waba-B-001',
  p_phone_number_id      := 'phone-B-001',
  p_display_phone_number := '+57 300 222 2222',
  p_verified_name        := 'Tienda B Test',
  p_onboarding_type      := 'new_number',
  p_coexistence_enabled  := false,
  p_access_token         := 'fake-token-store-b',
  p_connected_by         := 'OTHER_OWNER_ID_HERE'::uuid
);
-- EXPECT: {"ok": true, ...}


-- ============================================================
-- 4. get_store_whatsapp_send_context — tienda A NUNCA usa el token o
--    número de tienda B, y viceversa.
-- EXPECT: each store's context returns ONLY its own phone_number_id and
--         its own fake token — never the other store's.
-- ============================================================
SELECT get_store_whatsapp_send_context('00000096-1111-1111-1111-111111111111') AS store_a_context;
-- EXPECT: connected=true, phone_number_id=phone-A-001, access_token=fake-token-store-a

SELECT get_store_whatsapp_send_context('00000096-1111-1111-1111-111111111112') AS store_b_context;
-- EXPECT: connected=true, phone_number_id=phone-B-001, access_token=fake-token-store-b

-- Explicit cross-check: assert the two contexts never share a
-- phone_number_id or token, rather than eyeballing the jsonb above.
DO $$
DECLARE
  v_a jsonb := get_store_whatsapp_send_context('00000096-1111-1111-1111-111111111111');
  v_b jsonb := get_store_whatsapp_send_context('00000096-1111-1111-1111-111111111112');
BEGIN
  IF v_a->>'phone_number_id' = v_b->>'phone_number_id' THEN
    RAISE EXCEPTION 'TEST FAILED: store A and B resolved to the same phone_number_id';
  END IF;
  IF v_a->>'access_token' = v_b->>'access_token' THEN
    RAISE EXCEPTION 'TEST FAILED: store A and B resolved to the same access token';
  END IF;
  RAISE NOTICE 'OK: store A and B contexts are fully isolated';
END $$;


-- ============================================================
-- 5. Tienda SIN conexión — no envía.
-- EXPECT: connected=false for a store with no store_whatsapp_connections
--         row at all.
-- ============================================================
SELECT get_store_whatsapp_send_context('00000094-1111-1111-1111-111111111111') AS unconnected_store_context;
-- EXPECT: {"connected": false}
-- (reusing verify_094's store A id here deliberately — it has never
-- had a store_whatsapp_connections row, which is exactly the "enabled
-- in store_whatsapp_settings but never connected" state every existing
-- store is in today after 096.)


-- ============================================================
-- 6. Plantilla pendiente / aprobada — template_status flows through
--    get_store_whatsapp_send_context so the worker can gate on it.
-- ============================================================
SELECT store_whatsapp_connection_update_template_status(
  '00000096-1111-1111-1111-111111111111', 'pending', NULL
);
SELECT (get_store_whatsapp_send_context('00000096-1111-1111-1111-111111111111')->>'template_status') AS status_after_pending;
-- EXPECT: pending

SELECT store_whatsapp_connection_update_template_status(
  '00000096-1111-1111-1111-111111111111', 'approved', NULL
);
SELECT (get_store_whatsapp_send_context('00000096-1111-1111-1111-111111111111')->>'template_status') AS status_after_approved;
-- EXPECT: approved

SELECT store_whatsapp_connection_update_template_status(
  '00000096-1111-1111-1111-111111111112', 'rejected', 'Header image does not match brand guidelines'
);
SELECT template_status, template_rejected_reason FROM store_whatsapp_connections
WHERE store_id = '00000096-1111-1111-1111-111111111112';
-- EXPECT: template_status=rejected, template_rejected_reason set

SELECT count(*) FROM store_whatsapp_connection_events
WHERE store_id = '00000096-1111-1111-1111-111111111112' AND event_type = 'template_status_changed';
-- EXPECT: 1


-- ============================================================
-- 7. Token revocado → requiere atención.
-- EXPECT: connection_status flips from connected to requires_attention,
--         last_error_code/message set, event logged.
-- ============================================================
SELECT store_whatsapp_connection_mark_requires_attention(
  '00000096-1111-1111-1111-111111111111', '190', 'Access token invalid or expired'
);

SELECT connection_status, last_error_code FROM store_whatsapp_connections
WHERE store_id = '00000096-1111-1111-1111-111111111111';
-- EXPECT: connection_status=requires_attention, last_error_code=190

-- A store already 'disconnected' must NOT be silently flipped back to
-- requires_attention by this function (it only ever acts on rows
-- currently 'connected' — see its WHERE clause).
SELECT store_whatsapp_connection_mark_requires_attention(
  '00000096-1111-1111-1111-111111111112', '190', 'should not apply — store B is still connected, not disconnected, so this SHOULD apply'
);
SELECT connection_status FROM store_whatsapp_connections WHERE store_id = '00000096-1111-1111-1111-111111111112';
-- EXPECT: requires_attention (store B WAS connected, so this one does apply — see scenario 8 for the disconnected-store case)


-- ============================================================
-- 8. Reconexión — store A reconnects after requires_attention.
-- EXPECT: connection_status back to connected, new token secret,
--         disconnected_at/last_error_* cleared.
-- ============================================================
SELECT store_whatsapp_connection_save(
  p_store_id             := '00000096-1111-1111-1111-111111111111',
  p_meta_business_id     := 'biz-A-001',
  p_waba_id              := 'waba-A-001',
  p_phone_number_id      := 'phone-A-001',
  p_display_phone_number := '+57 300 111 1111',
  p_verified_name        := 'Tienda A Test',
  p_onboarding_type      := 'new_number',
  p_coexistence_enabled  := false,
  p_access_token         := 'fake-token-store-a-v2',
  p_connected_by         := 'OWNER_ID_HERE'::uuid
);

SELECT connection_status, last_error_code, last_error_message
FROM store_whatsapp_connections WHERE store_id = '00000096-1111-1111-1111-111111111111';
-- EXPECT: connection_status=connected, last_error_code=NULL, last_error_message=NULL

SELECT (get_store_whatsapp_send_context('00000096-1111-1111-1111-111111111111')->>'access_token') AS token_after_reconnect;
-- EXPECT: fake-token-store-a-v2 (the NEW token — Vault secret was updated in place, not duplicated)


-- ============================================================
-- 9. Desconexión — conserva historial, no borra pedidos/notificaciones.
-- ============================================================
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "OWNER_ID_HERE", "role": "authenticated"}';

SELECT disconnect_store_whatsapp_connection('00000096-1111-1111-1111-111111111111');
-- EXPECT: {"ok": true, "connection_status": "disconnected"}
COMMIT;

SELECT connection_status, token_secret_reference, phone_number_id, disconnected_at IS NOT NULL AS has_disconnected_at
FROM store_whatsapp_connections WHERE store_id = '00000096-1111-1111-1111-111111111111';
-- EXPECT: connection_status=disconnected, token_secret_reference=NULL (Vault secret deleted),
-- phone_number_id STILL SET (history/number reservation preserved), has_disconnected_at=true

SELECT get_store_whatsapp_send_context('00000096-1111-1111-1111-111111111111') AS context_after_disconnect;
-- EXPECT: {"connected": false} — no usable token even though the row still exists

SELECT count(*) FROM store_whatsapp_connection_events WHERE store_id = '00000096-1111-1111-1111-111111111111';
-- EXPECT: > 0 (connect_started, connect_succeeded, template_status_changed, token_revoked_detected,
-- disconnected — full history preserved, nothing deleted)


-- ============================================================
-- 10. Usuario de otra tienda NO puede desconectar/actuar sobre una
--     conexión que no le pertenece.
-- EXPECT: ERROR NOT_AUTHORIZED.
-- ============================================================
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "OTHER_OWNER_ID_HERE", "role": "authenticated"}';

DO $$
BEGIN
  BEGIN
    PERFORM disconnect_store_whatsapp_connection('00000096-1111-1111-1111-111111111112');
    -- Store B's OWN owner disconnecting store B is fine — this is the
    -- baseline "should succeed" case, run first so the next DO block's
    -- failure is unambiguous.
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Setup for scenario 10 failed unexpectedly: %', SQLERRM;
  END;
END $$;
ROLLBACK; -- undo store B's disconnect — it was only to prove authorization, not the actual intent of this scenario

BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "OTHER_OWNER_ID_HERE", "role": "authenticated"}';
-- OTHER_OWNER_ID_HERE owns store B, NOT store A — reconnect store A
-- first (scenario 8 left it connected) then confirm this uid cannot
-- touch it.

DO $$
BEGIN
  BEGIN
    PERFORM disconnect_store_whatsapp_connection('00000096-1111-1111-1111-111111111111');
    RAISE EXCEPTION 'TEST FAILED: a non-member should not be able to disconnect store A''s WhatsApp';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%NOT_AUTHORIZED%' THEN
      RAISE NOTICE 'OK: cross-tenant disconnect correctly rejected';
    ELSE
      RAISE;
    END IF;
  END;
END $$;
ROLLBACK;


-- ============================================================
-- 11. RLS — el owner de la tienda A ve su propia conexión, no la de B.
--     Platform member sin membresía en ninguna tienda no ve nada.
-- ============================================================
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "OWNER_ID_HERE", "role": "authenticated"}';

SELECT count(*) FROM store_whatsapp_connections WHERE store_id = '00000096-1111-1111-1111-111111111111';
-- EXPECT: 1 (own store)

SELECT count(*) FROM store_whatsapp_connections WHERE store_id = '00000096-1111-1111-1111-111111111112';
-- EXPECT: 0 (store B, not a member)

SELECT count(*) FROM store_whatsapp_connection_events WHERE store_id = '00000096-1111-1111-1111-111111111112';
-- EXPECT: 0 (same isolation on the audit table)
COMMIT;


-- ============================================================
-- 12. anon — no acceso en absoluto.
-- ============================================================
BEGIN;
SET LOCAL role anon;

SELECT count(*) FROM store_whatsapp_connections;
-- EXPECT: 0 — no anon SELECT policy exists on this table at all.

SELECT count(*) FROM store_whatsapp_connection_events;
-- EXPECT: 0

DO $$
BEGIN
  BEGIN
    PERFORM disconnect_store_whatsapp_connection('00000096-1111-1111-1111-111111111111');
    RAISE EXCEPTION 'TEST FAILED: anon should never be able to call disconnect_store_whatsapp_connection';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: anon correctly denied EXECUTE on disconnect_store_whatsapp_connection';
  END;
END $$;
COMMIT;


-- ============================================================
-- 13. whatsapp_notifications gains 'blocked' — status constraint check.
-- ============================================================
DO $$
BEGIN
  BEGIN
    INSERT INTO whatsapp_notifications (store_id, order_id, event_type, recipient_phone, template_name, status)
    VALUES ('00000096-1111-1111-1111-111111111111', NULL, 'test_message', '+573000000000', 'melosoft_whatsapp_test_v1', 'blocked');
    RAISE NOTICE 'OK: ''blocked'' accepted by the status CHECK constraint';
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'TEST FAILED: ''blocked'' should be a valid whatsapp_notifications.status value';
  END;
END $$;


-- ============================================================
-- 14. platform_whatsapp_connections_overview — masked number, no token
--     column at all in the view definition.
-- ============================================================
SELECT store_name, connection_status, display_phone_number_masked
FROM platform_whatsapp_connections_overview
WHERE store_id = '00000096-1111-1111-1111-111111111112';
-- EXPECT: one row, display_phone_number_masked shows only the first 4
-- and last 2 digits of +57 300 222 2222 (the rest replaced with •)

SELECT count(*) FROM information_schema.columns
WHERE table_name = 'platform_whatsapp_connections_overview' AND column_name ILIKE '%token%';
-- EXPECT: 0


-- ============================================================
-- Resumen final
-- ============================================================
SELECT store_id, connection_status, template_status, phone_number_id
FROM store_whatsapp_connections
WHERE store_id IN ('00000096-1111-1111-1111-111111111111', '00000096-1111-1111-1111-111111111112')
ORDER BY store_id;


-- ============================================================
-- CLEANUP — run after reviewing every EXPECT above.
-- ============================================================
-- DELETE FROM public.stores WHERE id IN (
--   '00000096-1111-1111-1111-111111111111',
--   '00000096-1111-1111-1111-111111111112'
-- );
-- (cascades to store_whatsapp_connections, store_whatsapp_connection_events,
--  and any whatsapp_notifications rows created in this script via their
--  own store_id FK ON DELETE CASCADE)
--
-- Also remove any leftover Vault secrets this script's fake tokens
-- created (store_whatsapp_connection_save writes to Vault even for a
-- fake token — disconnect in scenario 9 already deleted store A's, but
-- store B's was never disconnected in this script):
-- SELECT vault.delete_secret(id) FROM vault.secrets
--   WHERE name = 'whatsapp_token_00000096-1111-1111-1111-111111111112';
--
-- Verify nothing is left:
-- SELECT count(*) FROM stores WHERE id::text LIKE '00000096-%';
-- EXPECT: 0
