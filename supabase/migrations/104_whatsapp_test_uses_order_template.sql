-- A test send must exercise the same template that the connection reports as
-- approved. Previously this RPC queued melosoft_whatsapp_test_v1 while the UI
-- only tracked melosoft_order_confirmation_v1, allowing a false "ready" state
-- followed by Meta error 132001.

create or replace function public.enqueue_test_whatsapp_notification(
  p_store_id uuid,
  p_phone    text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_country    text;
  v_recipient_phone  text;
  v_recent_count     integer;
  v_locale           text;
  v_template_name    text;
  v_template_language text;
  v_notification_id  uuid;
begin
  if not public.has_store_role(p_store_id, array['owner', 'admin']) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select count(*) into v_recent_count
  from public.whatsapp_notifications
  where store_id = p_store_id
    and event_type = 'test_message'
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 3 then
    raise exception 'TEST_RATE_LIMIT_EXCEEDED';
  end if;

  select country
    into v_store_country
    from public.stores
   where id = p_store_id;

  v_recipient_phone := public.normalize_whatsapp_phone(
    p_phone,
    coalesce(v_store_country, 'CO')
  );

  if v_recipient_phone is null then
    raise exception 'INVALID_PHONE';
  end if;

  select locale
    into v_locale
    from public.store_whatsapp_settings
   where store_id = p_store_id;

  select template_name, template_language
    into v_template_name, v_template_language
    from public.store_whatsapp_connections
   where store_id = p_store_id
     and connection_status = 'connected';

  insert into public.whatsapp_notifications (
    store_id,
    order_id,
    event_type,
    recipient_phone,
    template_name,
    template_language,
    status
  ) values (
    p_store_id,
    null,
    'test_message',
    v_recipient_phone,
    coalesce(v_template_name, 'melosoft_order_confirmation_v1'),
    coalesce(v_template_language, v_locale, 'es_CO'),
    'queued'
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

comment on function public.enqueue_test_whatsapp_notification(uuid, text) is
  'Queues a rate-limited test using the store connection''s single approved order template.';

revoke all on function public.enqueue_test_whatsapp_notification(uuid, text) from public;
grant execute on function public.enqueue_test_whatsapp_notification(uuid, text) to authenticated;
