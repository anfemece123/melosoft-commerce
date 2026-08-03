-- A phone can be disconnected or moved in Meta/WhatsApp Business without
-- Melosoft receiving a synchronous callback. Until now the historical row in
-- store_whatsapp_connections retained phone_number_id forever, so a later,
-- fully verified Embedded Signup was rejected as a duplicate.
--
-- The Edge Function calls this service-role-only function only AFTER Meta has
-- exchanged the OAuth code and confirmed that the selected phone belongs to
-- the selected WABA. That fresh Meta authorization is the source of truth. If
-- another Melosoft store still holds the local claim, the move is completed in
-- the same database transaction as the new connection: the old token is
-- revoked locally, its claim is released, and both sides receive audit events.

alter table public.store_whatsapp_connection_events
  drop constraint if exists store_whatsapp_connection_events_type_valid;

alter table public.store_whatsapp_connection_events
  add constraint store_whatsapp_connection_events_type_valid check (event_type in (
    'connect_started', 'connect_succeeded', 'connect_failed', 'connect_cancelled',
    'template_created', 'template_status_changed',
    'test_message_sent', 'disconnected', 'reconnect_started',
    'duplicate_phone_rejected', 'token_revoked_detected',
    'phone_registration_pending', 'phone_registration_registering',
    'phone_registration_registered', 'phone_registration_requires_pin',
    'phone_registration_failed',
    'phone_reassigned_out', 'phone_reassigned_in',
    'waba_auto_resolved', 'phone_auto_resolved'
  ));

comment on index public.store_whatsapp_connections_phone_number_id_uq is
  'One current Melosoft claim per Meta phone_number_id. A fresh, server-verified Embedded Signup moves a stale claim atomically through store_whatsapp_connection_save; browser-provided IDs alone can never move it.';

create or replace function public.store_whatsapp_connection_save(
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
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret_name             text;
  v_existing_secret_id      uuid;
  v_now                     timestamptz := now();
  v_previous                record;
  v_current                 record;
  v_transferred_pin         text;
  v_reassigned              boolean := false;
begin
  if p_store_id is null or p_phone_number_id is null
     or p_access_token is null or p_access_token = '' then
    raise exception 'INVALID_CONNECTION_PAYLOAD';
  end if;

  -- The unique index is still the final invariant, but this transaction-level
  -- lock also makes two simultaneous verified signups for the same Meta phone
  -- run one after the other. The second transaction therefore observes the
  -- first transaction's completed move instead of racing into a unique-index
  -- error after secrets or audit rows have already been prepared.
  perform pg_advisory_xact_lock(hashtext('whatsapp_phone:' || p_phone_number_id));

  -- Serialize ownership changes for this phone. Reaching this function is
  -- already evidence that the Edge Function verified the fresh Meta token,
  -- WABA and phone relationship. The function itself remains service-role
  -- only, so a browser can never invoke this reassignment directly.
  select connection.store_id,
         connection.token_secret_reference,
         connection.registration_pin_secret_reference
    into v_previous
    from public.store_whatsapp_connections as connection
   where connection.phone_number_id = p_phone_number_id
     and connection.store_id <> p_store_id
   for update;

  if found then
    v_reassigned := true;

    if v_previous.registration_pin_secret_reference is not null then
      select secret.decrypted_secret
        into v_transferred_pin
        from vault.decrypted_secrets as secret
       where secret.name = v_previous.registration_pin_secret_reference;
    end if;

    if v_previous.token_secret_reference is not null then
      delete from vault.secrets where name = v_previous.token_secret_reference;
    end if;
    if v_previous.registration_pin_secret_reference is not null then
      delete from vault.secrets where name = v_previous.registration_pin_secret_reference;
    end if;

    update public.store_whatsapp_connections
       set connection_status = 'disconnected',
           phone_number_id = null,
           token_secret_reference = null,
           registration_pin_secret_reference = null,
           registration_status = 'pending',
           registered_at = null,
           registration_last_error_code = null,
           registration_last_error_message = null,
           disconnected_at = v_now,
           last_error_code = 'PHONE_REASSIGNED',
           last_error_message = 'El número fue conectado nuevamente mediante un Embedded Signup verificado por Meta.',
           updated_at = v_now
     where store_id = v_previous.store_id;

    insert into public.store_whatsapp_connection_events (
      store_id, event_type, actor_user_id, detail
    ) values (
      v_previous.store_id,
      'phone_reassigned_out',
      p_connected_by,
      'Fresh Meta authorization released the previous local phone claim'
    );

    insert into public.store_whatsapp_connection_events (
      store_id, event_type, actor_user_id, detail
    ) values (
      p_store_id,
      'phone_reassigned_in',
      p_connected_by,
      'Fresh Meta authorization replaced a previous local phone claim'
    );
  end if;

  -- If the target store itself is replacing a different phone, its previous
  -- registration PIN belongs to that old phone and must not remain as an
  -- orphaned Vault secret or be reused for the new asset.
  select connection.phone_number_id,
         connection.registration_pin_secret_reference
    into v_current
    from public.store_whatsapp_connections as connection
   where connection.store_id = p_store_id
   for update;

  if found
     and v_current.phone_number_id is distinct from p_phone_number_id
     and v_current.registration_pin_secret_reference is not null then
    delete from vault.secrets
     where name = v_current.registration_pin_secret_reference;
  end if;

  v_secret_name := 'whatsapp_token_' || p_store_id::text;

  select id
    into v_existing_secret_id
    from vault.secrets
   where name = v_secret_name;

  if v_existing_secret_id is not null then
    perform vault.update_secret(v_existing_secret_id, p_access_token);
  else
    perform vault.create_secret(p_access_token, v_secret_name);
  end if;

  insert into public.store_whatsapp_connections as current_connection (
    store_id,
    meta_business_id,
    waba_id,
    phone_number_id,
    display_phone_number,
    verified_name,
    connection_status,
    onboarding_type,
    coexistence_enabled,
    template_name,
    template_language,
    token_secret_reference,
    connected_by,
    connected_at,
    last_verified_at,
    disconnected_at,
    last_error_code,
    last_error_message
  ) values (
    p_store_id,
    p_meta_business_id,
    p_waba_id,
    p_phone_number_id,
    p_display_phone_number,
    p_verified_name,
    'connected',
    p_onboarding_type,
    coalesce(p_coexistence_enabled, false),
    'melosoft_order_confirmation_v1',
    'es_CO',
    v_secret_name,
    p_connected_by,
    v_now,
    v_now,
    null,
    null,
    null
  )
  on conflict (store_id) do update set
    meta_business_id = excluded.meta_business_id,
    waba_id = excluded.waba_id,
    phone_number_id = excluded.phone_number_id,
    display_phone_number = excluded.display_phone_number,
    verified_name = excluded.verified_name,
    connection_status = 'connected',
    onboarding_type = excluded.onboarding_type,
    coexistence_enabled = excluded.coexistence_enabled,
    template_name = excluded.template_name,
    template_language = excluded.template_language,
    template_status = case
      when current_connection.waba_id is not distinct from excluded.waba_id
       and current_connection.template_name = excluded.template_name
       and replace(lower(current_connection.template_language), '-', '_') =
           replace(lower(excluded.template_language), '-', '_')
      then current_connection.template_status
      else 'not_created'
    end,
    template_rejected_reason = case
      when current_connection.waba_id is not distinct from excluded.waba_id
       and current_connection.template_name = excluded.template_name
       and replace(lower(current_connection.template_language), '-', '_') =
           replace(lower(excluded.template_language), '-', '_')
      then current_connection.template_rejected_reason
      else null
    end,
    token_secret_reference = excluded.token_secret_reference,
    connected_by = excluded.connected_by,
    connected_at = v_now,
    last_verified_at = v_now,
    disconnected_at = null,
    last_error_code = null,
    last_error_message = null,
    updated_at = v_now;

  insert into public.store_whatsapp_connection_events (
    store_id, event_type, actor_user_id, detail
  ) values (
    p_store_id,
    'connect_succeeded',
    p_connected_by,
    'onboarding_type=' || coalesce(p_onboarding_type, 'unknown') ||
      ' reassigned=' || v_reassigned::text
  );

  return jsonb_build_object(
    'ok', true,
    'store_id', p_store_id,
    'connection_status', 'connected',
    'phone_reassigned', v_reassigned,
    -- Returned only to the service-role Edge Function. It is used once to
    -- preserve the Meta registration PIN during a legitimate move and is
    -- never included in the HTTP response sent to the browser.
    'transferred_registration_pin', v_transferred_pin
  );
end;
$$;

revoke all on function public.store_whatsapp_connection_save(
  uuid, text, text, text, text, text, text, boolean, text, uuid
) from public;
revoke all on function public.store_whatsapp_connection_save(
  uuid, text, text, text, text, text, text, boolean, text, uuid
) from anon;
revoke all on function public.store_whatsapp_connection_save(
  uuid, text, text, text, text, text, text, boolean, text, uuid
) from authenticated;
grant execute on function public.store_whatsapp_connection_save(
  uuid, text, text, text, text, text, text, boolean, text, uuid
) to service_role;
