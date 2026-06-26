-- ============================================================
-- Melosoft Commerce — Store Location and Business Hours
-- Migration: 008
-- Depends on: 001, 004, 006
-- ============================================================


-- ── store_locations ─────────────────────────────────────────

create table public.store_locations (
  id              uuid          primary key default gen_random_uuid(),
  store_id        uuid          not null unique references public.stores(id) on delete cascade,
  address_line    text,
  neighborhood    text,
  city            text,
  department      text,
  country         text          not null default 'CO',
  postal_code     text,
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  is_public       boolean       not null default true,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

comment on table public.store_locations is 'Physical location for a store. Optional, one per store.';

create trigger store_locations_updated_at
  before update on public.store_locations
  for each row execute function public.handle_updated_at();

create index idx_store_locations_store_id on public.store_locations(store_id);


-- ── store_business_hours ────────────────────────────────────

create table public.store_business_hours (
  id               uuid        primary key default gen_random_uuid(),
  store_id         uuid        not null references public.stores(id) on delete cascade,
  day_of_week      integer     not null,
  is_open          boolean     not null default true,
  opens_at         time,
  closes_at        time,
  break_starts_at  time,
  break_ends_at    time,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint store_hours_unique         unique (store_id, day_of_week),
  constraint store_hours_day_valid      check (day_of_week between 0 and 6),
  constraint store_hours_time_order     check (opens_at is null or closes_at is null or opens_at < closes_at),
  constraint store_hours_break_order    check (break_starts_at is null or break_ends_at is null or break_starts_at < break_ends_at)
);

comment on table public.store_business_hours is
  'Weekly operating hours per store. day_of_week: 0=Sunday … 6=Saturday.';

create trigger store_business_hours_updated_at
  before update on public.store_business_hours
  for each row execute function public.handle_updated_at();

create index idx_store_business_hours_store_id on public.store_business_hours(store_id);


-- ── RLS: store_locations ─────────────────────────────────────

alter table public.store_locations enable row level security;

-- platform_admin: full access
create policy "store_locations_select_platform_admin" on public.store_locations
  for select to authenticated using (public.is_platform_admin());
create policy "store_locations_insert_platform_admin" on public.store_locations
  for insert to authenticated with check (public.is_platform_admin());
create policy "store_locations_update_platform_admin" on public.store_locations
  for update to authenticated using (public.is_platform_admin());
create policy "store_locations_delete_platform_admin" on public.store_locations
  for delete to authenticated using (public.is_platform_admin());

-- Any store member can read the location
create policy "store_locations_select_member" on public.store_locations
  for select to authenticated
  using (public.is_store_member(store_id));

-- owner/admin can write location
create policy "store_locations_insert_owner_admin" on public.store_locations
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_locations_update_owner_admin" on public.store_locations
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));

-- Public can read if is_public = true (for storefront)
create policy "store_locations_select_anon_public" on public.store_locations
  for select to anon
  using (is_public = true);


-- ── RLS: store_business_hours ────────────────────────────────

alter table public.store_business_hours enable row level security;

create policy "store_hours_select_platform_admin" on public.store_business_hours
  for select to authenticated using (public.is_platform_admin());
create policy "store_hours_insert_platform_admin" on public.store_business_hours
  for insert to authenticated with check (public.is_platform_admin());
create policy "store_hours_update_platform_admin" on public.store_business_hours
  for update to authenticated using (public.is_platform_admin());
create policy "store_hours_delete_platform_admin" on public.store_business_hours
  for delete to authenticated using (public.is_platform_admin());

create policy "store_hours_select_member" on public.store_business_hours
  for select to authenticated
  using (public.is_store_member(store_id));

create policy "store_hours_write_owner_admin" on public.store_business_hours
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_hours_update_owner_admin" on public.store_business_hours
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));

-- Public can read hours (they're non-sensitive)
create policy "store_hours_select_anon" on public.store_business_hours
  for select to anon using (true);
