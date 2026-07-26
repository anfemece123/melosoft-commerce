-- ============================================================
-- Migration 102 — complete WhatsApp Cloud API phone registration
--
-- Embedded Signup authorizes the WABA and returns a phone_number_id,
-- but Meta still requires POST /{phone_number_id}/register before the
-- number can send. The registration call also configures the required
-- six-digit two-step verification PIN. Melosoft generates that PIN in
-- the Edge Function and stores it only in Vault; store users can see
-- registration state but never the PIN itself.
-- ============================================================

ALTER TABLE public.store_whatsapp_connections
  ADD COLUMN registration_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN registration_pin_secret_reference text,
  ADD COLUMN registered_at timestamptz,
  ADD COLUMN registration_last_error_code text,
  ADD COLUMN registration_last_error_message text,
  ADD CONSTRAINT store_whatsapp_connections_registration_status_valid CHECK (
    registration_status IN ('pending', 'registering', 'registered', 'requires_pin', 'failed')
  );

COMMENT ON COLUMN public.store_whatsapp_connections.registration_status IS
  'Cloud API phone registration state. Sending is allowed only after registered.';
COMMENT ON COLUMN public.store_whatsapp_connections.registration_pin_secret_reference IS
  'Name of the Vault secret holding the Meta two-step registration PIN. The PIN is never stored in this table.';

ALTER TABLE public.store_whatsapp_connection_events
  DROP CONSTRAINT store_whatsapp_connection_events_type_valid;
ALTER TABLE public.store_whatsapp_connection_events
  ADD CONSTRAINT store_whatsapp_connection_events_type_valid CHECK (event_type IN (
    'connect_started', 'connect_succeeded', 'connect_failed', 'connect_cancelled',
    'template_created', 'template_status_changed',
    'test_message_sent', 'disconnected', 'reconnect_started',
    'duplicate_phone_rejected', 'token_revoked_detected',
    'phone_registration_pending', 'phone_registration_registering',
    'phone_registration_registered', 'phone_registration_requires_pin',
    'phone_registration_failed'
  ));

-- A newly selected number or a reconnection must be verified again. A
-- normal token refresh for an already-connected phone preserves its
-- successful registration state.
CREATE OR REPLACE FUNCTION public.reset_whatsapp_registration_on_connection_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.registration_status := 'pending';
    NEW.registered_at := NULL;
    NEW.registration_last_error_code := NULL;
    NEW.registration_last_error_message := NULL;
  ELSIF NEW.phone_number_id IS DISTINCT FROM OLD.phone_number_id
        OR (OLD.connection_status <> 'connected' AND NEW.connection_status = 'connected') THEN
    NEW.registration_status := 'pending';
    NEW.registered_at := NULL;
    NEW.registration_last_error_code := NULL;
    NEW.registration_last_error_message := NULL;
    IF NEW.phone_number_id IS DISTINCT FROM OLD.phone_number_id THEN
      NEW.registration_pin_secret_reference := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER store_whatsapp_registration_reset
  BEFORE INSERT OR UPDATE OF phone_number_id, connection_status
  ON public.store_whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.reset_whatsapp_registration_on_connection_change();

-- Service-role-only context for the registration Edge Function. This is
-- the second and only other controlled code path (besides the sender)
-- allowed to read a store's Meta token back from Vault.
CREATE OR REPLACE FUNCTION public.get_store_whatsapp_registration_context(
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_conn record;
  v_token text;
  v_registration_pin text;
BEGIN
  SELECT phone_number_id, connection_status, registration_status,
         token_secret_reference, registration_pin_secret_reference
  INTO v_conn
  FROM store_whatsapp_connections
  WHERE store_id = p_store_id;

  IF NOT FOUND OR v_conn.connection_status <> 'connected' OR v_conn.phone_number_id IS NULL THEN
    RETURN jsonb_build_object('connected', false);
  END IF;

  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name = v_conn.token_secret_reference;

  IF v_token IS NULL THEN
    RETURN jsonb_build_object('connected', false);
  END IF;

  IF v_conn.registration_pin_secret_reference IS NOT NULL THEN
    SELECT decrypted_secret INTO v_registration_pin
    FROM vault.decrypted_secrets
    WHERE name = v_conn.registration_pin_secret_reference;
  END IF;

  RETURN jsonb_build_object(
    'connected', true,
    'phone_number_id', v_conn.phone_number_id,
    'registration_status', v_conn.registration_status,
    'registration_pin', v_registration_pin,
    'access_token', v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_whatsapp_registration_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_store_whatsapp_registration_context(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_store_whatsapp_registration_context(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_whatsapp_registration_context(uuid) TO service_role;

-- Stores a PIN only after Meta accepted it. Passing NULL updates state
-- without creating or exposing a secret (used for already-registered
-- phone numbers and failure states).
CREATE OR REPLACE FUNCTION public.store_whatsapp_registration_mark(
  p_store_id uuid,
  p_status text,
  p_registration_pin text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_secret_name text;
  v_existing_secret_id uuid;
BEGIN
  IF p_status NOT IN ('pending', 'registering', 'registered', 'requires_pin', 'failed') THEN
    RAISE EXCEPTION 'INVALID_REGISTRATION_STATUS';
  END IF;
  IF p_registration_pin IS NOT NULL AND p_registration_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'INVALID_REGISTRATION_PIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM store_whatsapp_connections WHERE store_id = p_store_id) THEN
    RAISE EXCEPTION 'CONNECTION_NOT_FOUND';
  END IF;

  IF p_registration_pin IS NOT NULL THEN
    v_secret_name := 'whatsapp_registration_pin_' || p_store_id::text;
    SELECT id INTO v_existing_secret_id FROM vault.secrets WHERE name = v_secret_name;
    IF v_existing_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(v_existing_secret_id, p_registration_pin);
    ELSE
      PERFORM vault.create_secret(p_registration_pin, v_secret_name);
    END IF;
  END IF;

  UPDATE store_whatsapp_connections
  SET registration_status = p_status,
      registration_pin_secret_reference = CASE
        WHEN p_registration_pin IS NOT NULL THEN v_secret_name
        ELSE registration_pin_secret_reference
      END,
      registered_at = CASE WHEN p_status = 'registered' THEN COALESCE(registered_at, now()) ELSE registered_at END,
      registration_last_error_code = CASE WHEN p_status = 'registered' THEN NULL ELSE left(p_error_code, 100) END,
      registration_last_error_message = CASE WHEN p_status = 'registered' THEN NULL ELSE left(p_error_message, 500) END,
      updated_at = now()
  WHERE store_id = p_store_id;

  INSERT INTO store_whatsapp_connection_events (store_id, event_type, actor_user_id, detail)
  VALUES (
    p_store_id,
    'phone_registration_' || p_status,
    p_actor_user_id,
    CASE WHEN p_error_code IS NULL THEN NULL ELSE 'code=' || left(p_error_code, 100) END
  );

  RETURN jsonb_build_object('ok', true, 'store_id', p_store_id, 'registration_status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.store_whatsapp_registration_mark(uuid, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_whatsapp_registration_mark(uuid, text, text, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.store_whatsapp_registration_mark(uuid, text, text, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.store_whatsapp_registration_mark(uuid, text, text, text, text, uuid) TO service_role;

-- A connection is not sendable until Meta accepted phone registration.
CREATE OR REPLACE FUNCTION public.get_store_whatsapp_send_context(
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_conn record;
  v_token text;
BEGIN
  SELECT phone_number_id, connection_status, registration_status,
         template_name, template_language, template_status,
         token_secret_reference
  INTO v_conn
  FROM store_whatsapp_connections
  WHERE store_id = p_store_id;

  IF NOT FOUND
     OR v_conn.connection_status <> 'connected'
     OR v_conn.registration_status <> 'registered'
     OR v_conn.phone_number_id IS NULL THEN
    RETURN jsonb_build_object(
      'connected', false,
      'registration_status', COALESCE(v_conn.registration_status, 'missing')
    );
  END IF;

  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name = v_conn.token_secret_reference;

  IF v_token IS NULL THEN
    RETURN jsonb_build_object('connected', false, 'registration_status', v_conn.registration_status);
  END IF;

  RETURN jsonb_build_object(
    'connected', true,
    'registration_status', v_conn.registration_status,
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

-- Disconnecting removes the access token but deliberately retains the
-- registration PIN in Vault. Meta keeps the phone registered, so losing
-- that PIN would make a later reconnection unnecessarily ask the owner.
-- It does not deregister the phone and does not affect the mobile app.
CREATE OR REPLACE FUNCTION public.disconnect_store_whatsapp_connection(
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_token_secret_name text;
BEGIN
  IF NOT public.has_store_role(p_store_id, array['owner', 'admin']) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT token_secret_reference
  INTO v_token_secret_name
  FROM store_whatsapp_connections
  WHERE store_id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_CONNECTED';
  END IF;

  IF v_token_secret_name IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE name = v_token_secret_name;
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
