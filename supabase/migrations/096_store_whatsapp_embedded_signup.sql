-- ============================================================
-- Migration 096 — Modelo B: WhatsApp Embedded Signup per store
--
-- Migration 094 shipped Modelo A (a single central Melosoft number).
-- That was never wired to real Meta credentials — no secret was ever
-- configured, the pg_cron worker was never scheduled, and no real
-- message has ever been sent — so there is no real "central sending
-- history" to migrate or preserve. What DOES exist and must be
-- preserved untouched: whatsapp_notifications (the queue/history),
-- store_whatsapp_settings (per-store feature toggles), and every order/
-- checkout_session row with its consent columns. This migration adds
-- the per-store connection layer alongside all of that — it does not
-- rewrite, drop, or backfill anything 094 created.
--
-- What changes conceptually: store_whatsapp_settings stays exactly what
-- it was — "does this store WANT notifications, and for which events" —
-- and a new table, store_whatsapp_connections, answers a completely
-- different question: "does this store HAVE a working Meta connection
-- to send them through". A store can have enabled=true in the first
-- table and no row at all in the second (never connected) — that is
-- the expected, common state for every existing store today, and it is
-- deliberately NOT auto-populated with Melosoft's own number. Nothing
-- in this migration makes any store senda message on anyone else's
-- behalf.
--
-- Depends on: 001 (handle_updated_at), 004 (is_platform_admin,
-- is_store_member, has_store_role), 094 (whatsapp_notifications,
-- store_whatsapp_settings, orders.whatsapp_consent — read but not
-- altered in shape).
-- ============================================================

-- ============================================================
-- 1. store_whatsapp_connections — one row per store, holds the current
--    Meta connection state. NEVER stores the access token itself —
--    token_secret_reference only names a Supabase Vault secret; the
--    token is written to and read from Vault exclusively inside
--    SECURITY DEFINER functions below, never via a plain table column.
-- ============================================================

CREATE TABLE public.store_whatsapp_connections (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                 uuid        NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,

  meta_business_id         text,
  waba_id                  text,
  phone_number_id          text,
  display_phone_number     text,
  verified_name            text,

  connection_status        text        NOT NULL DEFAULT 'not_connected',
  onboarding_type          text,
  coexistence_enabled      boolean     NOT NULL DEFAULT false,

  template_name            text        NOT NULL DEFAULT 'melosoft_order_confirmation_v1',
  template_language        text        NOT NULL DEFAULT 'es_CO',
  template_status          text        NOT NULL DEFAULT 'not_created',
  template_rejected_reason text,

  -- Name of the Vault secret holding this store's access token —
  -- never the token. See store_whatsapp_connection_save below for the
  -- only code path that ever writes a real token, and
  -- get_store_whatsapp_send_context for the only one that ever reads it.
  token_secret_reference   text,

  connected_by             uuid        REFERENCES auth.users(id),
  connected_at             timestamptz,
  last_verified_at         timestamptz,
  disconnected_at          timestamptz,
  last_error_code          text,
  last_error_message       text,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_whatsapp_connections_status_valid CHECK (connection_status IN (
    'not_connected', 'connecting', 'connected', 'requires_attention', 'disconnected'
  )),
  CONSTRAINT store_whatsapp_connections_onboarding_type_valid CHECK (
    onboarding_type IS NULL OR onboarding_type IN ('coexistence', 'new_number', 'existing_cloud_api')
  ),
  CONSTRAINT store_whatsapp_connections_template_status_valid CHECK (template_status IN (
    'not_created', 'pending', 'approved', 'rejected', 'paused', 'disabled'
  ))
);

COMMENT ON TABLE public.store_whatsapp_connections IS
  'One row per store — its Meta WhatsApp Embedded Signup connection state. Never holds a real access token, only a Vault secret name.';
COMMENT ON COLUMN public.store_whatsapp_connections.token_secret_reference IS
  'Name of a Supabase Vault secret (whatsapp_token_<store_id>). The token itself lives only in Vault.';

-- Cross-tenant duplicate guard: a real WhatsApp phone number can only
-- ever back one Cloud API connection at a time. Partial (only rows that
-- actually have a phone_number_id) so unconnected stores never collide
-- with each other on NULL.
CREATE UNIQUE INDEX store_whatsapp_connections_phone_number_id_uq
  ON public.store_whatsapp_connections (phone_number_id)
  WHERE phone_number_id IS NOT NULL;

COMMENT ON INDEX public.store_whatsapp_connections_phone_number_id_uq IS
  'Enforces one store per phone_number_id across all of Melosoft. A DISCONNECTED store''s row keeps its phone_number_id (history is preserved), so that number stays reserved to it until a platform_admin manually clears it — the system never silently reassigns a number between stores.';

CREATE INDEX store_whatsapp_connections_status_idx
  ON public.store_whatsapp_connections (connection_status);

CREATE TRIGGER store_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.store_whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.store_whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- Reads: platform_admin (all), owner/admin/staff of the store (their
-- own row only). No INSERT/UPDATE/DELETE policy for anon or
-- authenticated at all — every write happens through the SECURITY
-- DEFINER functions below (which each do their own role check) or
-- through an Edge Function using service_role.
CREATE POLICY "store_whatsapp_connections_select_platform_admin" ON public.store_whatsapp_connections
  FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE POLICY "store_whatsapp_connections_select_members" ON public.store_whatsapp_connections
  FOR SELECT TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

GRANT SELECT ON public.store_whatsapp_connections TO authenticated;
GRANT ALL ON public.store_whatsapp_connections TO service_role;

-- ============================================================
-- 2. store_whatsapp_connection_events — sanitized audit trail of the
--    connection lifecycle (connect/disconnect/reconnect/template/test-
--    send/error). Never holds tokens, never holds full webhook
--    payloads — `detail` is a short, hand-built sanitized string, the
--    same discipline as whatsapp_notifications.last_error_message.
-- ============================================================

CREATE TABLE public.store_whatsapp_connection_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type    text        NOT NULL,
  actor_user_id uuid        REFERENCES auth.users(id),
  detail        text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_whatsapp_connection_events_type_valid CHECK (event_type IN (
    'connect_started', 'connect_succeeded', 'connect_failed', 'connect_cancelled',
    'template_created', 'template_status_changed',
    'test_message_sent', 'disconnected', 'reconnect_started',
    'duplicate_phone_rejected', 'token_revoked_detected'
  )),
  CONSTRAINT store_whatsapp_connection_events_detail_length CHECK (char_length(detail) <= 500)
);

COMMENT ON TABLE public.store_whatsapp_connection_events IS
  'Sanitized audit trail of WhatsApp connection lifecycle events. Never a token, never a raw Meta payload — detail is a short hand-built string only.';

CREATE INDEX store_whatsapp_connection_events_store_created_idx
  ON public.store_whatsapp_connection_events (store_id, created_at DESC);

ALTER TABLE public.store_whatsapp_connection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_whatsapp_connection_events_select_platform_admin" ON public.store_whatsapp_connection_events
  FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE POLICY "store_whatsapp_connection_events_select_owner_admin" ON public.store_whatsapp_connection_events
  FOR SELECT TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']));

GRANT SELECT ON public.store_whatsapp_connection_events TO authenticated;
GRANT ALL ON public.store_whatsapp_connection_events TO service_role;

-- ============================================================
-- 3. whatsapp_notifications gains 'blocked' — a store with no working
--    connection (or a connection whose template isn't approved yet)
--    never reaches Meta at all. Same discipline as 'invalid_recipient'
--    from migration 094: no attempt consumed, never auto-retried,
--    visible in history, distinguishable from a real provider failure.
--    'blocked' is written only by send-whatsapp-notification, never by
--    the 094 trigger (which is untouched by this migration).
-- ============================================================

ALTER TABLE public.whatsapp_notifications
  DROP CONSTRAINT IF EXISTS whatsapp_notifications_status_valid;
ALTER TABLE public.whatsapp_notifications
  ADD CONSTRAINT whatsapp_notifications_status_valid CHECK (status IN (
    'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'invalid_recipient', 'blocked'
  ));

-- ============================================================
-- 4. store_whatsapp_settings.sender_mode — default only, no data
--    rewrite. Existing rows keep whatever value they already have
--    (every one of them is 'central' today, and that is preserved
--    exactly, per instruction — this migration does not UPDATE a
--    single existing row). New settings rows going forward default to
--    'dedicated', matching the fact that 'central' has no real sending
--    path anymore.
-- ============================================================

ALTER TABLE public.store_whatsapp_settings
  ALTER COLUMN sender_mode SET DEFAULT 'dedicated';

COMMENT ON COLUMN public.store_whatsapp_settings.sender_mode IS
  'dedicated = store connects its own WhatsApp Business number via Embedded Signup (store_whatsapp_connections) — the only mode with a real sending path since migration 096. central is preserved on existing rows for history only; it has no functional effect on send-whatsapp-notification.';

-- ============================================================
-- 5. store_whatsapp_connection_save — the ONLY place a real access
--    token is ever written. Called by the whatsapp-embedded-signup
--    Edge Function (service_role) after it has already: validated the
--    caller's JWT and store role, exchanged the code with Meta,
--    fetched and validated business_id/waba_id/phone_number_id, and
--    confirmed the phone number actually belongs to that WABA. This
--    function does not talk to Meta — it only persists what the Edge
--    Function already verified, and performs the one check that must
--    happen at the database layer to be race-safe: the cross-tenant
--    phone_number_id duplicate guard (re-checked here under the
--    function's own transaction, backed by the UNIQUE index above as
--    the real guarantee — same "check + real constraint" pattern as
--    migration 094's Wompi session function).
--
--    SECURITY DEFINER is required here (unlike the Wompi/WhatsApp-
--    status functions in 094, which only needed it for consistency):
--    this function calls vault.create_secret/vault.update_secret, and
--    the vault schema's functions are not exposed to service_role by
--    grant — they run as the function owner. Without DEFINER, even
--    service_role calling this function could not write to Vault.
-- ============================================================

CREATE OR REPLACE FUNCTION public.store_whatsapp_connection_save(
  p_store_id             uuid,
  p_meta_business_id     text,
  p_waba_id              text,
  p_phone_number_id      text,
  p_display_phone_number text,
  p_verified_name        text,
  p_onboarding_type      text,
  p_coexistence_enabled  boolean,
  p_access_token         text,
  p_connected_by         uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_secret_name         text;
  v_existing_secret_id  uuid;
  v_now                 timestamptz := now();
BEGIN
  IF p_store_id IS NULL OR p_phone_number_id IS NULL OR p_access_token IS NULL OR p_access_token = '' THEN
    RAISE EXCEPTION 'INVALID_CONNECTION_PAYLOAD';
  END IF;

  IF EXISTS (
    SELECT 1 FROM store_whatsapp_connections
    WHERE phone_number_id = p_phone_number_id AND store_id <> p_store_id
  ) THEN
    INSERT INTO store_whatsapp_connection_events (store_id, event_type, actor_user_id, detail)
    VALUES (p_store_id, 'duplicate_phone_rejected', p_connected_by, 'phone_number_id already connected to another store');
    RAISE EXCEPTION 'PHONE_NUMBER_ALREADY_CONNECTED';
  END IF;

  v_secret_name := 'whatsapp_token_' || p_store_id::text;

  SELECT id INTO v_existing_secret_id FROM vault.secrets WHERE name = v_secret_name;
  IF v_existing_secret_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing_secret_id, p_access_token);
  ELSE
    PERFORM vault.create_secret(p_access_token, v_secret_name);
  END IF;

  INSERT INTO store_whatsapp_connections (
    store_id, meta_business_id, waba_id, phone_number_id, display_phone_number, verified_name,
    connection_status, onboarding_type, coexistence_enabled,
    template_name, template_language,
    token_secret_reference, connected_by, connected_at, last_verified_at,
    disconnected_at, last_error_code, last_error_message
  ) VALUES (
    p_store_id, p_meta_business_id, p_waba_id, p_phone_number_id, p_display_phone_number, p_verified_name,
    'connected', p_onboarding_type, COALESCE(p_coexistence_enabled, false),
    'melosoft_order_confirmation_v1', 'es_CO',
    v_secret_name, p_connected_by, v_now, v_now,
    NULL, NULL, NULL
  )
  ON CONFLICT (store_id) DO UPDATE SET
    meta_business_id = EXCLUDED.meta_business_id,
    waba_id = EXCLUDED.waba_id,
    phone_number_id = EXCLUDED.phone_number_id,
    display_phone_number = EXCLUDED.display_phone_number,
    verified_name = EXCLUDED.verified_name,
    connection_status = 'connected',
    onboarding_type = EXCLUDED.onboarding_type,
    coexistence_enabled = EXCLUDED.coexistence_enabled,
    token_secret_reference = EXCLUDED.token_secret_reference,
    connected_by = EXCLUDED.connected_by,
    connected_at = v_now,
    last_verified_at = v_now,
    disconnected_at = NULL,
    last_error_code = NULL,
    last_error_message = NULL,
    updated_at = v_now;

  INSERT INTO store_whatsapp_connection_events (store_id, event_type, actor_user_id, detail)
  VALUES (p_store_id, 'connect_succeeded', p_connected_by, 'onboarding_type=' || COALESCE(p_onboarding_type, 'unknown'));

  RETURN jsonb_build_object('ok', true, 'store_id', p_store_id, 'connection_status', 'connected');
END;
$$;

REVOKE ALL ON FUNCTION public.store_whatsapp_connection_save(uuid, text, text, text, text, text, text, boolean, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_whatsapp_connection_save(uuid, text, text, text, text, text, text, boolean, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.store_whatsapp_connection_save(uuid, text, text, text, text, text, text, boolean, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.store_whatsapp_connection_save(uuid, text, text, text, text, text, text, boolean, text, uuid) TO service_role;

-- ============================================================
-- 6. get_store_whatsapp_send_context — the ONLY place a real access
--    token is ever read back out. service_role only (called by
--    send-whatsapp-notification). Returns NULL fields (not an error)
--    when there is no usable connection — the caller decides what that
--    means (mark 'blocked'), this function just reports the fact.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_store_whatsapp_send_context(
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_conn   record;
  v_token  text;
BEGIN
  SELECT phone_number_id, connection_status, template_name, template_language, template_status,
         token_secret_reference
  INTO v_conn
  FROM store_whatsapp_connections
  WHERE store_id = p_store_id;

  IF NOT FOUND OR v_conn.connection_status <> 'connected' OR v_conn.phone_number_id IS NULL THEN
    RETURN jsonb_build_object('connected', false);
  END IF;

  IF v_conn.token_secret_reference IS NOT NULL THEN
    SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets
    WHERE name = v_conn.token_secret_reference;
  END IF;

  IF v_token IS NULL THEN
    -- Connection row says 'connected' but the Vault secret is gone —
    -- treat as not usable rather than sending with no token.
    RETURN jsonb_build_object('connected', false);
  END IF;

  RETURN jsonb_build_object(
    'connected', true,
    'phone_number_id', v_conn.phone_number_id,
    'access_token', v_token,
    'template_name', v_conn.template_name,
    'template_language', v_conn.template_language,
    'template_status', v_conn.template_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_whatsapp_send_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_store_whatsapp_send_context(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_store_whatsapp_send_context(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_whatsapp_send_context(uuid) TO service_role;

-- ============================================================
-- 7. store_whatsapp_connection_mark_requires_attention — called by
--    send-whatsapp-notification when Meta reports the token/connection
--    as invalid (expired, revoked, or the WABA/number was disconnected
--    on Meta's side). service_role only — this is a worker-internal
--    signal, not something a store admin triggers directly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.store_whatsapp_connection_mark_requires_attention(
  p_store_id     uuid,
  p_error_code   text,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE store_whatsapp_connections
  SET connection_status = 'requires_attention',
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      updated_at = now()
  WHERE store_id = p_store_id AND connection_status = 'connected';

  INSERT INTO store_whatsapp_connection_events (store_id, event_type, detail)
  VALUES (p_store_id, 'token_revoked_detected', 'error_code=' || COALESCE(p_error_code, 'unknown'));
END;
$$;

REVOKE ALL ON FUNCTION public.store_whatsapp_connection_mark_requires_attention(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_whatsapp_connection_mark_requires_attention(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.store_whatsapp_connection_mark_requires_attention(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.store_whatsapp_connection_mark_requires_attention(uuid, text, text) TO service_role;

-- ============================================================
-- 8. store_whatsapp_connection_update_template_status — called by the
--    whatsapp-template-sync Edge Function (service_role) after querying
--    Meta for the template's current review status.
-- ============================================================

CREATE OR REPLACE FUNCTION public.store_whatsapp_connection_update_template_status(
  p_store_id        uuid,
  p_template_status text,
  p_rejected_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_template_status NOT IN ('not_created', 'pending', 'approved', 'rejected', 'paused', 'disabled') THEN
    RAISE EXCEPTION 'INVALID_TEMPLATE_STATUS';
  END IF;

  UPDATE store_whatsapp_connections
  SET template_status = p_template_status,
      template_rejected_reason = CASE WHEN p_template_status = 'rejected' THEN p_rejected_reason ELSE NULL END,
      updated_at = now()
  WHERE store_id = p_store_id;

  INSERT INTO store_whatsapp_connection_events (store_id, event_type, detail)
  VALUES (p_store_id, 'template_status_changed', 'status=' || p_template_status);
END;
$$;

REVOKE ALL ON FUNCTION public.store_whatsapp_connection_update_template_status(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_whatsapp_connection_update_template_status(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.store_whatsapp_connection_update_template_status(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.store_whatsapp_connection_update_template_status(uuid, text, text) TO service_role;

-- ============================================================
-- 9. disconnect_store_whatsapp_connection — owner/admin-triggered,
--    callable directly by `authenticated` (role checked inside, same
--    convention as migration 094's enqueue_test_whatsapp_notification).
--    Deletes the Vault secret (our only copy of the token — this is
--    "revocación segura" from Melosoft's side; it does NOT and cannot
--    call any Meta endpoint to revoke the token remotely — Graph API
--    has no documented endpoint for a Tech Provider to force-revoke a
--    System User token it did not itself mint via System User
--    management, so this is intentionally NOT attempted here, see
--    docs/whatsapp/deployment.md for the manual fallback), marks the
--    connection 'disconnected' (row and its phone_number_id are KEPT,
--    not deleted — see the UNIQUE index comment above), and never
--    touches orders, whatsapp_notifications, or the store's own
--    WhatsApp Business mobile app (nothing in this system has any
--    control over that app regardless).
-- ============================================================

CREATE OR REPLACE FUNCTION public.disconnect_store_whatsapp_connection(
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_secret_name text;
BEGIN
  IF NOT public.has_store_role(p_store_id, array['owner', 'admin']) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT token_secret_reference INTO v_secret_name
  FROM store_whatsapp_connections
  WHERE store_id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_CONNECTED';
  END IF;

  IF v_secret_name IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE name = v_secret_name;
  END IF;

  UPDATE store_whatsapp_connections
  SET connection_status = 'disconnected',
      token_secret_reference = NULL,
      disconnected_at = now(),
      updated_at = now()
  WHERE store_id = p_store_id;

  INSERT INTO store_whatsapp_connection_events (store_id, event_type, actor_user_id)
  VALUES (p_store_id, 'disconnected', auth.uid());

  RETURN jsonb_build_object('ok', true, 'store_id', p_store_id, 'connection_status', 'disconnected');
END;
$$;

REVOKE ALL ON FUNCTION public.disconnect_store_whatsapp_connection(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disconnect_store_whatsapp_connection(uuid) TO authenticated;

-- ============================================================
-- 10. platform_whatsapp_connections_overview — read-only view for the
--     platform_admin operational page. Masks the phone number
--     structurally (not just in the frontend) as a UX precaution — the
--     real access control is still store_whatsapp_connections' own RLS
--     (a store owner querying this view only ever sees their own row
--     regardless; platform_admin already has full-table SELECT via its
--     existing policy, this view is a convenience projection, not an
--     additional security boundary for that role). No token, no
--     token_secret_reference, ever exposed here.
-- ============================================================

CREATE OR REPLACE VIEW public.platform_whatsapp_connections_overview AS
SELECT
  swc.store_id,
  s.name AS store_name,
  swc.connection_status,
  CASE
    WHEN swc.display_phone_number IS NULL OR length(swc.display_phone_number) < 6 THEN swc.display_phone_number
    ELSE left(swc.display_phone_number, 4) || repeat('•', length(swc.display_phone_number) - 6) || right(swc.display_phone_number, 2)
  END AS display_phone_number_masked,
  swc.waba_id,
  swc.template_status,
  swc.onboarding_type,
  swc.coexistence_enabled,
  swc.last_verified_at,
  swc.last_error_code,
  swc.last_error_message,
  swc.connected_at,
  swc.disconnected_at
FROM public.store_whatsapp_connections swc
JOIN public.stores s ON s.id = swc.store_id;

GRANT SELECT ON public.platform_whatsapp_connections_overview TO authenticated;
