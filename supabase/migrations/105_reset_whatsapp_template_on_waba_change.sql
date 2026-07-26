-- Message templates are scoped to a WABA. Reconnecting a store to a different
-- WABA must never retain the previous WABA's approval state; otherwise the UI
-- reports "Aprobada" and the worker reaches Meta only to receive 132001.

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
  v_secret_name         text;
  v_existing_secret_id  uuid;
  v_now                 timestamptz := now();
begin
  if p_store_id is null or p_phone_number_id is null
     or p_access_token is null or p_access_token = '' then
    raise exception 'INVALID_CONNECTION_PAYLOAD';
  end if;

  if exists (
    select 1
      from public.store_whatsapp_connections
     where phone_number_id = p_phone_number_id
       and store_id <> p_store_id
  ) then
    insert into public.store_whatsapp_connection_events (
      store_id, event_type, actor_user_id, detail
    ) values (
      p_store_id,
      'duplicate_phone_rejected',
      p_connected_by,
      'phone_number_id already connected to another store'
    );
    raise exception 'PHONE_NUMBER_ALREADY_CONNECTED';
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
    'onboarding_type=' || coalesce(p_onboarding_type, 'unknown')
  );

  return jsonb_build_object(
    'ok', true,
    'store_id', p_store_id,
    'connection_status', 'connected'
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

-- Repair currently connected stores that already exposed the stale-approval
-- bug. Their next page load will create/query the template in the active WABA.
update public.store_whatsapp_connections as connection
   set template_status = 'not_created',
       template_rejected_reason = null,
       updated_at = now()
 where connection.connection_status = 'connected'
   and connection.template_status = 'approved'
   and exists (
     select 1
       from public.whatsapp_notifications as notification
      where notification.store_id = connection.store_id
        and notification.event_type = 'test_message'
        and notification.last_error_code = '132001'
        and notification.created_at >= connection.connected_at
   );
