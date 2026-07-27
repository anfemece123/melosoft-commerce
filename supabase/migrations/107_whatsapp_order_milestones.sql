-- Professional WhatsApp order updates: one initial confirmation plus only
-- meaningful customer-facing milestones. Internal transitions such as
-- "confirmed", payment approval and preparation deliberately stay silent.

alter table public.store_whatsapp_connections
  add column if not exists status_template_name text not null default 'melosoft_order_status_v1',
  add column if not exists status_template_language text not null default 'es_CO',
  add column if not exists status_template_status text not null default 'not_created',
  add column if not exists status_template_rejected_reason text;

alter table public.store_whatsapp_connections
  drop constraint if exists store_whatsapp_connections_status_template_status_valid;

alter table public.store_whatsapp_connections
  add constraint store_whatsapp_connections_status_template_status_valid check (
    status_template_status in ('not_created', 'pending', 'approved', 'rejected', 'paused', 'disabled')
  );

comment on column public.store_whatsapp_connections.status_template_name is
  'Generic utility template used only for ready/shipped, delivered and cancelled order milestones.';

create or replace function public.reset_whatsapp_status_template_on_waba_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.waba_id is distinct from new.waba_id then
    new.status_template_status := 'not_created';
    new.status_template_rejected_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists store_whatsapp_status_template_reset_on_waba_change
  on public.store_whatsapp_connections;
create trigger store_whatsapp_status_template_reset_on_waba_change
  before update of waba_id on public.store_whatsapp_connections
  for each row execute function public.reset_whatsapp_status_template_on_waba_change();

create or replace function public.get_store_whatsapp_send_context(
  p_store_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_conn  record;
  v_token text;
begin
  select phone_number_id, connection_status,
         template_name, template_language, template_status,
         status_template_name, status_template_language, status_template_status,
         token_secret_reference
    into v_conn
    from public.store_whatsapp_connections
   where store_id = p_store_id;

  if not found or v_conn.connection_status <> 'connected' or v_conn.phone_number_id is null then
    return jsonb_build_object('connected', false);
  end if;

  if v_conn.token_secret_reference is not null then
    select decrypted_secret
      into v_token
      from vault.decrypted_secrets
     where name = v_conn.token_secret_reference;
  end if;

  if v_token is null then
    return jsonb_build_object('connected', false);
  end if;

  return jsonb_build_object(
    'connected', true,
    'phone_number_id', v_conn.phone_number_id,
    'access_token', v_token,
    'template_name', v_conn.template_name,
    'template_language', v_conn.template_language,
    'template_status', v_conn.template_status,
    'status_template_name', v_conn.status_template_name,
    'status_template_language', v_conn.status_template_language,
    'status_template_status', v_conn.status_template_status
  );
end;
$$;

revoke all on function public.get_store_whatsapp_send_context(uuid) from public;
revoke all on function public.get_store_whatsapp_send_context(uuid) from anon;
revoke all on function public.get_store_whatsapp_send_context(uuid) from authenticated;
grant execute on function public.get_store_whatsapp_send_context(uuid) to service_role;

create or replace function public.store_whatsapp_connection_update_template_statuses(
  p_store_id uuid,
  p_order_template_status text,
  p_order_rejected_reason text,
  p_status_template_status text,
  p_status_rejected_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_order_template_status not in ('not_created', 'pending', 'approved', 'rejected', 'paused', 'disabled')
     or p_status_template_status not in ('not_created', 'pending', 'approved', 'rejected', 'paused', 'disabled') then
    raise exception 'INVALID_TEMPLATE_STATUS';
  end if;

  update public.store_whatsapp_connections
     set template_status = p_order_template_status,
         template_rejected_reason = case when p_order_template_status = 'rejected'
           then left(p_order_rejected_reason, 300) else null end,
         status_template_status = p_status_template_status,
         status_template_rejected_reason = case when p_status_template_status = 'rejected'
           then left(p_status_rejected_reason, 300) else null end,
         updated_at = now()
   where store_id = p_store_id;

  insert into public.store_whatsapp_connection_events (store_id, event_type, detail)
  values (
    p_store_id,
    'template_status_changed',
    left('order=' || p_order_template_status || ' status=' || p_status_template_status, 500)
  );
end;
$$;

revoke all on function public.store_whatsapp_connection_update_template_statuses(uuid, text, text, text, text) from public;
revoke all on function public.store_whatsapp_connection_update_template_statuses(uuid, text, text, text, text) from anon;
revoke all on function public.store_whatsapp_connection_update_template_statuses(uuid, text, text, text, text) from authenticated;
grant execute on function public.store_whatsapp_connection_update_template_statuses(uuid, text, text, text, text) to service_role;

-- A template-status webhook can now target either of the two templates used
-- by a store connection. Matching remains WABA + exact name + language.
create or replace function public.apply_whatsapp_template_status_event(
  p_waba_id text,
  p_template_name text,
  p_template_language text,
  p_template_status text,
  p_rejected_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_matched integer;
  v_applied integer;
  v_rejected_reason text := case
    when p_template_status = 'rejected' then left(nullif(trim(p_rejected_reason), ''), 300)
    else null
  end;
begin
  if nullif(trim(p_waba_id), '') is null or nullif(trim(p_template_name), '') is null then
    raise exception 'INVALID_TEMPLATE_IDENTITY';
  end if;
  if p_template_status not in ('pending', 'approved', 'rejected', 'paused', 'disabled') then
    raise exception 'INVALID_TEMPLATE_STATUS';
  end if;

  select count(*)
    into v_matched
    from public.store_whatsapp_connections
   where waba_id = p_waba_id
     and connection_status in ('connected', 'requires_attention')
     and (
       (template_name = p_template_name and (
         nullif(trim(p_template_language), '') is null
         or replace(lower(template_language), '-', '_') = replace(lower(trim(p_template_language)), '-', '_')
       ))
       or
       (status_template_name = p_template_name and (
         nullif(trim(p_template_language), '') is null
         or replace(lower(status_template_language), '-', '_') = replace(lower(trim(p_template_language)), '-', '_')
       ))
     );

  with updated as (
    update public.store_whatsapp_connections
       set template_status = case when template_name = p_template_name then p_template_status else template_status end,
           template_rejected_reason = case when template_name = p_template_name then v_rejected_reason else template_rejected_reason end,
           status_template_status = case when status_template_name = p_template_name then p_template_status else status_template_status end,
           status_template_rejected_reason = case when status_template_name = p_template_name then v_rejected_reason else status_template_rejected_reason end,
           updated_at = now()
     where waba_id = p_waba_id
       and connection_status in ('connected', 'requires_attention')
       and (
         (template_name = p_template_name and (
           nullif(trim(p_template_language), '') is null
           or replace(lower(template_language), '-', '_') = replace(lower(trim(p_template_language)), '-', '_')
         ))
         or
         (status_template_name = p_template_name and (
           nullif(trim(p_template_language), '') is null
           or replace(lower(status_template_language), '-', '_') = replace(lower(trim(p_template_language)), '-', '_')
         ))
       )
       and (
         (template_name = p_template_name and (
           template_status is distinct from p_template_status
           or template_rejected_reason is distinct from v_rejected_reason
         ))
         or
         (status_template_name = p_template_name and (
           status_template_status is distinct from p_template_status
           or status_template_rejected_reason is distinct from v_rejected_reason
         ))
       )
    returning store_id
  ), inserted as (
    insert into public.store_whatsapp_connection_events (store_id, event_type, detail)
    select store_id, 'template_status_changed',
           left('source=webhook status=' || p_template_status || ' template=' || p_template_name, 500)
      from updated
    returning id
  )
  select count(*) into v_applied from inserted;

  return jsonb_build_object('matched', v_matched, 'applied', v_applied);
end;
$$;

revoke all on function public.apply_whatsapp_template_status_event(text, text, text, text, text) from public;
revoke all on function public.apply_whatsapp_template_status_event(text, text, text, text, text) from anon;
revoke all on function public.apply_whatsapp_template_status_event(text, text, text, text, text) from authenticated;
grant execute on function public.apply_whatsapp_template_status_event(text, text, text, text, text) to service_role;

create or replace function public.enqueue_whatsapp_order_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings record;
  v_connection record;
  v_event_type text;
  v_event_enabled boolean := false;
  v_store_country text;
  v_recipient_phone text;
begin
  begin
    if old.status is not distinct from new.status or not new.whatsapp_consent then
      return new;
    end if;

    select enabled, order_ready_for_pickup_enabled, order_shipped_enabled,
           order_delivered_enabled, order_cancelled_enabled, locale
      into v_settings
      from public.store_whatsapp_settings
     where store_id = new.store_id;

    if not found or not v_settings.enabled then
      return new;
    end if;

    if new.status = 'shipped' then
      if new.fulfillment_method = 'pickup' then
        v_event_type := 'order_ready_for_pickup';
        v_event_enabled := v_settings.order_ready_for_pickup_enabled;
      else
        v_event_type := 'order_shipped';
        v_event_enabled := v_settings.order_shipped_enabled;
      end if;
    elsif new.status = 'delivered' then
      v_event_type := 'order_delivered';
      v_event_enabled := v_settings.order_delivered_enabled;
    elsif new.status = 'cancelled' then
      v_event_type := 'order_cancelled';
      v_event_enabled := v_settings.order_cancelled_enabled;
    else
      -- confirmed, payment and preparation are intentionally silent.
      return new;
    end if;

    if not v_event_enabled then
      return new;
    end if;

    select status_template_name, status_template_language, status_template_status,
           connection_status, registration_status
      into v_connection
      from public.store_whatsapp_connections
     where store_id = new.store_id;

    -- Do not create a doomed queue row. The panel only enables these toggles
    -- once the generic status template is approved.
    if not found
       or v_connection.connection_status <> 'connected'
       or v_connection.registration_status <> 'registered'
       or v_connection.status_template_status <> 'approved' then
      return new;
    end if;

    select country into v_store_country from public.stores where id = new.store_id;
    v_recipient_phone := public.normalize_whatsapp_phone(
      new.customer_phone,
      coalesce(v_store_country, 'CO')
    );

    if v_recipient_phone is null then
      insert into public.whatsapp_notifications (
        store_id, order_id, event_type, recipient_phone, template_name, template_language,
        status, attempts, max_attempts, is_permanent_failure,
        last_error_category, last_error_code, last_error_message, failed_at
      ) values (
        new.store_id, new.id, v_event_type, coalesce(new.customer_phone, ''),
        v_connection.status_template_name, v_connection.status_template_language,
        'invalid_recipient', 0, 0, true,
        'invalid_phone', 'INVALID_PHONE', 'El número de teléfono del pedido no es válido para WhatsApp.', now()
      ) on conflict do nothing;
      return new;
    end if;

    insert into public.whatsapp_notifications (
      store_id, order_id, event_type, recipient_phone, template_name, template_language, status
    ) values (
      new.store_id, new.id, v_event_type, v_recipient_phone,
      v_connection.status_template_name,
      coalesce(v_connection.status_template_language, v_settings.locale, 'es_CO'),
      'queued'
    ) on conflict do nothing;

    return new;
  exception when others then
    raise warning 'whatsapp_status_notification_enqueue_failed order_id=% store_id=% sqlstate=%',
      new.id, new.store_id, sqlstate;
    return new;
  end;
end;
$$;

drop trigger if exists trg_enqueue_whatsapp_order_status_notification on public.orders;
create trigger trg_enqueue_whatsapp_order_status_notification
  after update of status on public.orders
  for each row execute function public.enqueue_whatsapp_order_status_notification();

comment on function public.enqueue_whatsapp_order_status_notification() is
  'Queues only customer-meaningful WhatsApp milestones: ready/shipped, delivered and cancelled.';
