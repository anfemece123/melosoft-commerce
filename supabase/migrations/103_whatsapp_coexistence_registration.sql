-- ============================================================
-- Migration 103 — distinguish coexistence from new-number registration
--
-- A number that remains active in the WhatsApp Business mobile app is
-- already registered. Meta explicitly requires coexistence onboarding
-- to skip POST /{phone_number_id}/register. Expose the persisted
-- onboarding mode to the service-role-only recovery function so it can
-- verify Meta's coexistence flags instead of attempting a new-number
-- registration.
-- ============================================================

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
         onboarding_type, coexistence_enabled,
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
    'onboarding_type', v_conn.onboarding_type,
    'coexistence_enabled', v_conn.coexistence_enabled,
    'registration_pin', v_registration_pin,
    'access_token', v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_whatsapp_registration_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_store_whatsapp_registration_context(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_store_whatsapp_registration_context(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_whatsapp_registration_context(uuid) TO service_role;

COMMENT ON FUNCTION public.get_store_whatsapp_registration_context(uuid) IS
  'Service-role-only WhatsApp phone context. Includes onboarding mode so coexistence skips /register.';
