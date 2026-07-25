-- Keep per-store template state synchronized when Meta finishes reviewing a
-- message template. One WABA may serve several connected phone numbers, so a
-- WABA-scoped template event intentionally updates every active connection
-- using the same exact template name and language.

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'store_whatsapp_connections'
  ) then
    alter publication supabase_realtime add table public.store_whatsapp_connections;
  end if;
end $$;

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
  if nullif(trim(p_waba_id), '') is null
     or nullif(trim(p_template_name), '') is null then
    raise exception 'INVALID_TEMPLATE_IDENTITY';
  end if;

  if p_template_status not in ('pending', 'approved', 'rejected', 'paused', 'disabled') then
    raise exception 'INVALID_TEMPLATE_STATUS';
  end if;

  select count(*)
    into v_matched
    from public.store_whatsapp_connections
   where waba_id = p_waba_id
     and template_name = p_template_name
     and connection_status in ('connected', 'requires_attention')
     and (
       nullif(trim(p_template_language), '') is null
       or replace(lower(template_language), '-', '_') =
          replace(lower(trim(p_template_language)), '-', '_')
     );

  with updated as (
    update public.store_whatsapp_connections
       set template_status = p_template_status,
           template_rejected_reason = v_rejected_reason,
           updated_at = now()
     where waba_id = p_waba_id
       and template_name = p_template_name
       and connection_status in ('connected', 'requires_attention')
       and (
         nullif(trim(p_template_language), '') is null
         or replace(lower(template_language), '-', '_') =
            replace(lower(trim(p_template_language)), '-', '_')
       )
       and (
         template_status is distinct from p_template_status
         or template_rejected_reason is distinct from v_rejected_reason
       )
    returning store_id
  ), inserted as (
    insert into public.store_whatsapp_connection_events (
      store_id,
      event_type,
      detail
    )
    select
      store_id,
      'template_status_changed',
      left('source=webhook status=' || p_template_status ||
        ' template=' || p_template_name, 500)
    from updated
    returning id
  )
  select count(*) into v_applied from inserted;

  return jsonb_build_object(
    'matched', v_matched,
    'applied', v_applied
  );
end;
$$;

comment on function public.apply_whatsapp_template_status_event(text, text, text, text, text) is
  'Service-role-only idempotent application of Meta message_template_status_update webhooks.';

revoke all on function public.apply_whatsapp_template_status_event(text, text, text, text, text) from public;
revoke all on function public.apply_whatsapp_template_status_event(text, text, text, text, text) from anon;
revoke all on function public.apply_whatsapp_template_status_event(text, text, text, text, text) from authenticated;
grant execute on function public.apply_whatsapp_template_status_event(text, text, text, text, text) to service_role;
