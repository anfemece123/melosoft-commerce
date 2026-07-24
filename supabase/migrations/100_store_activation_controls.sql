-- ============================================================
-- Superadmin store activation controls
-- ============================================================
-- Store status already gates every public storefront view, hostname
-- resolver, checkout RPC and payment Edge Function. This migration adds
-- one narrow, auditable operation for switching between active/inactive
-- and prevents store members from changing that platform-owned state.

create table public.store_activation_events (
  id              uuid        primary key default gen_random_uuid(),
  store_id        uuid        not null references public.stores(id) on delete cascade,
  previous_status text        not null,
  new_status      text        not null,
  changed_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint store_activation_events_previous_status_valid
    check (previous_status in ('active', 'inactive')),
  constraint store_activation_events_new_status_valid
    check (new_status in ('active', 'inactive')),
  constraint store_activation_events_status_changed
    check (previous_status <> new_status)
);

create index store_activation_events_store_created_idx
  on public.store_activation_events (store_id, created_at desc);

comment on table public.store_activation_events is
  'Immutable audit trail for active/inactive changes made by a platform admin.';

alter table public.store_activation_events enable row level security;

create policy "store_activation_events_select_platform_admin"
  on public.store_activation_events
  for select
  to authenticated
  using (public.is_platform_admin());

-- Browser clients can only read the audit trail when RLS identifies them as a
-- platform admin. Writes happen atomically inside set_store_activation().
revoke all on public.store_activation_events from anon, authenticated;
grant select on public.store_activation_events to authenticated;

-- RLS policies cannot compare OLD.status with NEW.status. A BEFORE UPDATE
-- trigger is therefore the database-level guarantee that a store member cannot
-- reactivate their own company by calling the REST API directly. The service
-- role remains available for trusted server-side maintenance.
create or replace function public.enforce_store_status_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_platform_admin() then
    raise exception 'Only an active platform admin can change store status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_store_status_admin_only() from public;

drop trigger if exists stores_status_admin_only on public.stores;
create trigger stores_status_admin_only
  before update of status on public.stores
  for each row execute function public.enforce_store_status_admin_only();

create or replace function public.set_store_activation(
  p_store_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_status text;
  v_new_status text := case when p_active then 'active' else 'inactive' end;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select status
    into v_previous_status
    from public.stores
   where id = p_store_id
   for update;

  if not found then
    raise exception 'store_not_found' using errcode = 'P0002';
  end if;

  -- Suspended and archived are intentionally outside this simple switch. They
  -- represent administrative lifecycle states and require a future dedicated
  -- workflow instead of being silently overwritten.
  if v_previous_status not in ('active', 'inactive') then
    raise exception 'store_status_not_toggleable' using errcode = '22023';
  end if;

  if v_previous_status = v_new_status then
    return;
  end if;

  update public.stores
     set status = v_new_status,
         updated_at = now()
   where id = p_store_id;

  insert into public.store_activation_events (
    store_id,
    previous_status,
    new_status,
    changed_by
  )
  values (
    p_store_id,
    v_previous_status,
    v_new_status,
    auth.uid()
  );
end;
$$;

comment on function public.set_store_activation(uuid, boolean) is
  'platform_admin-only atomic activation/deactivation with an immutable audit event.';

revoke all on function public.set_store_activation(uuid, boolean) from public;
grant execute on function public.set_store_activation(uuid, boolean) to authenticated;
