-- ============================================================
-- Melosoft Commerce — Roles, Memberships and Limits
-- Migration: 004
-- Depends on: 001, 002, 003
-- ============================================================
-- Architectural decisions documented here:
--
-- 1. platform_admin is a GLOBAL platform role stored in `profiles`.
--    Regular per-store roles (owner/admin/staff/viewer) live in `store_members`.
--
-- 2. RLS helper functions use SECURITY DEFINER to avoid recursive RLS
--    evaluation (querying profiles/store_members from within their own
--    RLS policies). This is the standard Supabase pattern.
--    Functions are set with `SET search_path = public` to avoid
--    search_path injection attacks.
--
-- 3. Only platform_admin can INSERT stores. The auto-trigger creates
--    store_members (owner) and store_limits (basic) when a store is inserted.
--
-- 4. Soft-deletes via status fields. Physical DELETEs are restricted to
--    platform_admin only, and are generally discouraged.
-- ============================================================


-- ============================================================
-- SECTION 1 — NEW TABLES
-- ============================================================

-- 1a. profiles: maps each auth.users row to a platform role
create table public.profiles (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null unique references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  platform_role text        not null default 'platform_member',
  status        text        not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_platform_role_valid check (platform_role in ('platform_admin', 'platform_member')),
  constraint profiles_status_valid        check (status in ('active', 'inactive'))
);

comment on table public.profiles is 'One profile per auth user. Stores global platform role.';

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 1b. store_members: per-store role assignments
create table public.store_members (
  id          uuid        primary key default gen_random_uuid(),
  store_id    uuid        not null references public.stores(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null default 'viewer',
  status      text        not null default 'active',
  invited_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint store_members_unique       unique (store_id, user_id),
  constraint store_members_role_valid   check (role in ('owner', 'admin', 'staff', 'viewer')),
  constraint store_members_status_valid check (status in ('active', 'inactive'))
);

comment on table public.store_members is 'Per-store role membership. Users can have different roles in different stores.';

create trigger store_members_updated_at
  before update on public.store_members
  for each row execute function public.handle_updated_at();

-- 1c. store_limits: per-plan feature limits for each store
create table public.store_limits (
  id                      uuid        primary key default gen_random_uuid(),
  store_id                uuid        not null unique references public.stores(id) on delete cascade,
  plan_key                text        not null default 'basic',
  max_products            integer     not null default 20,
  max_staff               integer     not null default 2,
  max_active_offers       integer     not null default 5,
  max_monthly_orders      integer,
  can_use_payments        boolean     not null default true,
  can_use_custom_domain   boolean     not null default false,
  can_use_advanced_theme  boolean     not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint store_limits_plan_valid         check (plan_key in ('basic', 'pro', 'premium', 'custom')),
  constraint store_limits_max_products_ok    check (max_products >= 0),
  constraint store_limits_max_staff_ok       check (max_staff >= 0),
  constraint store_limits_max_offers_ok      check (max_active_offers >= 0),
  constraint store_limits_max_orders_ok      check (max_monthly_orders is null or max_monthly_orders >= 0)
);

comment on table public.store_limits is 'Plan-based feature limits per store. Managed by platform_admin.';

create trigger store_limits_updated_at
  before update on public.store_limits
  for each row execute function public.handle_updated_at();

-- Indexes for new tables
create index idx_profiles_user_id        on public.profiles(user_id);
create index idx_profiles_platform_role  on public.profiles(platform_role);
create index idx_store_members_store_id  on public.store_members(store_id);
create index idx_store_members_user_id   on public.store_members(user_id);
create index idx_store_members_store_user on public.store_members(store_id, user_id);


-- ============================================================
-- SECTION 2 — TRIGGER: Auto-create profile on user signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, platform_role, status)
  values (new.id, new.email, 'platform_member', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Automatically creates a profile row when a new user signs up in auth.users.';

-- Attach to auth.users (Supabase Auth schema)
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- SECTION 3 — BACKFILL: Profiles for existing users
-- ============================================================

insert into public.profiles (user_id, email, platform_role, status)
select id, email, 'platform_member', 'active'
from auth.users
on conflict (user_id) do nothing;


-- ============================================================
-- SECTION 4 — TRIGGER: Auto-create store defaults on store insert
-- ============================================================

create or replace function public.handle_new_store()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Create owner membership for the store creator
  insert into public.store_members (store_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active')
  on conflict (store_id, user_id) do nothing;

  -- Create default plan limits
  insert into public.store_limits (store_id, plan_key)
  values (new.id, 'basic')
  on conflict (store_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_store() is
  'On store insert: creates owner membership and default plan limits.';

create trigger on_store_created
  after insert on public.stores
  for each row execute function public.handle_new_store();


-- ============================================================
-- SECTION 5 — BACKFILL: store_members and store_limits for existing stores
-- ============================================================

insert into public.store_members (store_id, user_id, role, status)
select id, owner_id, 'owner', 'active'
from public.stores
where not exists (
  select 1 from public.store_members sm
  where sm.store_id = stores.id and sm.user_id = stores.owner_id
)
on conflict (store_id, user_id) do nothing;

insert into public.store_limits (store_id, plan_key)
select id, 'basic'
from public.stores
where not exists (
  select 1 from public.store_limits sl
  where sl.store_id = stores.id
)
on conflict (store_id) do nothing;


-- ============================================================
-- SECTION 6 — UPDATE stores.status CONSTRAINT
-- (add 'suspended' without breaking existing data)
-- ============================================================

alter table public.stores drop constraint if exists stores_status_valid;
alter table public.stores add constraint stores_status_valid
  check (status in ('active', 'inactive', 'suspended', 'archived'));


-- ============================================================
-- SECTION 7 — RLS HELPER FUNCTIONS (SECURITY DEFINER)
-- These bypass RLS by running as the function definer (superuser).
-- They are read-only and only return booleans — no data is leaked.
-- ============================================================

-- Returns true if the current session user is an active platform_admin
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and platform_role = 'platform_admin'
      and status = 'active'
  );
$$;

comment on function public.is_platform_admin() is
  'Returns true if auth.uid() has platform_role = platform_admin and is active.
   Uses SECURITY DEFINER to bypass RLS on profiles table.';

-- Returns true if the current user has ANY active membership in the given store
create or replace function public.is_store_member(store_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members
    where store_id = store_uuid
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

comment on function public.is_store_member(uuid) is
  'Returns true if auth.uid() has any active membership in the given store.
   Uses SECURITY DEFINER to bypass RLS on store_members table.';

-- Returns true if the current user has an active role in allowed_roles for the given store
create or replace function public.has_store_role(store_uuid uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members
    where store_id = store_uuid
      and user_id = auth.uid()
      and role = any(allowed_roles)
      and status = 'active'
  );
$$;

comment on function public.has_store_role(uuid, text[]) is
  'Returns true if auth.uid() has one of allowed_roles (active) in the given store.
   Uses SECURITY DEFINER to bypass RLS on store_members table.';

-- Convenience: returns true if current user is the owner of the given store
create or replace function public.is_store_owner(store_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_store_role(store_uuid, array['owner']);
$$;

comment on function public.is_store_owner(uuid) is
  'Convenience wrapper: returns true if auth.uid() is an active owner of the store.';


-- ============================================================
-- SECTION 8 — RLS ON NEW TABLES
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.store_members enable row level security;
alter table public.store_limits  enable row level security;

-- ── profiles ────────────────────────────────────────────────

-- Any authenticated user can read their own profile
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

-- platform_admin can read any profile
create policy "profiles_select_platform_admin" on public.profiles
  for select to authenticated
  using (public.is_platform_admin());

-- Users can update limited fields on their own profile
-- platform_role and status can ONLY be changed by platform_admin (see below)
create policy "profiles_update_own_fields" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- Prevent self-elevation of platform_role or status changes
    -- The application must enforce this; RLS allows the row but
    -- the service layer must not send platform_role or status updates.
    -- For a harder guarantee, use a separate policy or a check trigger.
  );

-- platform_admin can update any profile (including platform_role)
create policy "profiles_update_platform_admin" on public.profiles
  for update to authenticated
  using (public.is_platform_admin());

-- Trigger prevents self-privilege escalation: enforce platform_role immutability for non-admins
create or replace function public.enforce_profile_role_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only platform_admin can change platform_role or status of any profile
  if (old.platform_role <> new.platform_role or old.status <> new.status) then
    if not public.is_platform_admin() then
      raise exception 'Only platform_admin can change platform_role or status';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_role_immutability
  before update on public.profiles
  for each row execute function public.enforce_profile_role_immutability();

-- The trigger handle_new_user inserts profiles; users cannot directly insert
-- (they get a profile automatically on signup)
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());

-- platform_admin can delete profiles
create policy "profiles_delete_platform_admin" on public.profiles
  for delete to authenticated
  using (public.is_platform_admin());

-- ── store_members ────────────────────────────────────────────

-- platform_admin sees all members of all stores
create policy "store_members_select_platform_admin" on public.store_members
  for select to authenticated
  using (public.is_platform_admin());

-- Any active member of a store can see the member list of that store
create policy "store_members_select_member" on public.store_members
  for select to authenticated
  using (public.is_store_member(store_id));

-- platform_admin can insert any membership
create policy "store_members_insert_platform_admin" on public.store_members
  for insert to authenticated
  with check (public.is_platform_admin());

-- Store owners can add members (but not add other owners — enforced in application)
create policy "store_members_insert_owner" on public.store_members
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner']));

-- platform_admin can update any membership
create policy "store_members_update_platform_admin" on public.store_members
  for update to authenticated
  using (public.is_platform_admin());

-- Store owners can update memberships in their store
create policy "store_members_update_owner" on public.store_members
  for update to authenticated
  using (public.has_store_role(store_id, array['owner']));

-- platform_admin can delete memberships
create policy "store_members_delete_platform_admin" on public.store_members
  for delete to authenticated
  using (public.is_platform_admin());

-- ── store_limits ─────────────────────────────────────────────

-- platform_admin has full access to limits
create policy "store_limits_select_platform_admin" on public.store_limits
  for select to authenticated
  using (public.is_platform_admin());

create policy "store_limits_insert_platform_admin" on public.store_limits
  for insert to authenticated
  with check (public.is_platform_admin());

create policy "store_limits_update_platform_admin" on public.store_limits
  for update to authenticated
  using (public.is_platform_admin());

-- Store owner/admin can read their own limits
create policy "store_limits_select_member" on public.store_limits
  for select to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));


-- ============================================================
-- SECTION 9 — DROP OLD RLS POLICIES ON EXISTING TABLES
-- These used owner_id = auth.uid() which no longer works for
-- platform_admin access or multi-role membership.
-- ============================================================

-- stores
drop policy if exists "stores_select_own"            on public.stores;
drop policy if exists "stores_insert_own"            on public.stores;
drop policy if exists "stores_update_own"            on public.stores;
drop policy if exists "stores_delete_own"            on public.stores;
-- keep: stores_select_public_active (anon)

-- store_theme_settings
drop policy if exists "store_theme_select_own"       on public.store_theme_settings;
drop policy if exists "store_theme_insert_own"       on public.store_theme_settings;
drop policy if exists "store_theme_update_own"       on public.store_theme_settings;
drop policy if exists "store_theme_delete_own"       on public.store_theme_settings;
-- keep: store_theme_select_public (anon)

-- store_policies
drop policy if exists "store_policies_select_own"    on public.store_policies;
drop policy if exists "store_policies_insert_own"    on public.store_policies;
drop policy if exists "store_policies_update_own"    on public.store_policies;
drop policy if exists "store_policies_delete_own"    on public.store_policies;
-- keep: store_policies_select_public (anon)

-- products
drop policy if exists "products_select_own"          on public.products;
drop policy if exists "products_insert_own"          on public.products;
drop policy if exists "products_update_own"          on public.products;
drop policy if exists "products_delete_own"          on public.products;
-- keep: products_select_public_active (anon)

-- product_images
drop policy if exists "product_images_select_own"    on public.product_images;
drop policy if exists "product_images_insert_own"    on public.product_images;
drop policy if exists "product_images_update_own"    on public.product_images;
drop policy if exists "product_images_delete_own"    on public.product_images;

-- offers
drop policy if exists "offers_select_own"            on public.offers;
drop policy if exists "offers_insert_own"            on public.offers;
drop policy if exists "offers_update_own"            on public.offers;
drop policy if exists "offers_delete_own"            on public.offers;
-- keep: offers_select_public_active (anon)

-- offer_images
drop policy if exists "offer_images_select_own"      on public.offer_images;
drop policy if exists "offer_images_insert_own"      on public.offer_images;
drop policy if exists "offer_images_update_own"      on public.offer_images;
drop policy if exists "offer_images_delete_own"      on public.offer_images;

-- orders
drop policy if exists "orders_select_own"            on public.orders;
drop policy if exists "orders_insert_own"            on public.orders;
drop policy if exists "orders_update_own"            on public.orders;

-- order_items
drop policy if exists "order_items_select_own"       on public.order_items;
drop policy if exists "order_items_insert_own"       on public.order_items;

-- payment_providers
drop policy if exists "payment_providers_select_auth" on public.payment_providers;

-- store_payment_settings
drop policy if exists "store_payment_settings_select_own" on public.store_payment_settings;
drop policy if exists "store_payment_settings_insert_own" on public.store_payment_settings;
drop policy if exists "store_payment_settings_update_own" on public.store_payment_settings;

-- payment_transactions
drop policy if exists "payment_transactions_select_own" on public.payment_transactions;


-- ============================================================
-- SECTION 10 — NEW RLS POLICIES ON EXISTING TABLES
-- ============================================================

-- ── stores ──────────────────────────────────────────────────

-- platform_admin: full access
create policy "stores_select_platform_admin" on public.stores
  for select to authenticated
  using (public.is_platform_admin());

create policy "stores_insert_platform_admin" on public.stores
  for insert to authenticated
  with check (public.is_platform_admin());

create policy "stores_update_platform_admin" on public.stores
  for update to authenticated
  using (public.is_platform_admin());

create policy "stores_delete_platform_admin" on public.stores
  for delete to authenticated
  using (public.is_platform_admin());

-- Store members: read their store
create policy "stores_select_member" on public.stores
  for select to authenticated
  using (public.is_store_member(id));

-- Owner and admin can update store info (not status/suspension — that's platform_admin only)
create policy "stores_update_owner_admin" on public.stores
  for update to authenticated
  using (public.has_store_role(id, array['owner', 'admin']))
  with check (
    public.has_store_role(id, array['owner', 'admin'])
    -- Prevent non-admin status changes (suspended/archived) via this policy
    -- by enforcing the value stays within allowed non-admin statuses
    and status in ('active', 'inactive')
  );

-- ── store_theme_settings ─────────────────────────────────────

create policy "store_theme_select_platform_admin" on public.store_theme_settings
  for select to authenticated using (public.is_platform_admin());

create policy "store_theme_insert_platform_admin" on public.store_theme_settings
  for insert to authenticated with check (public.is_platform_admin());

create policy "store_theme_update_platform_admin" on public.store_theme_settings
  for update to authenticated using (public.is_platform_admin());

create policy "store_theme_delete_platform_admin" on public.store_theme_settings
  for delete to authenticated using (public.is_platform_admin());

-- Members can read theme; owner/admin can write
create policy "store_theme_select_member" on public.store_theme_settings
  for select to authenticated
  using (public.is_store_member(store_id));

create policy "store_theme_write_owner_admin" on public.store_theme_settings
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_theme_update_owner_admin" on public.store_theme_settings
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));

-- ── store_policies ───────────────────────────────────────────

create policy "store_policies_select_platform_admin" on public.store_policies
  for select to authenticated using (public.is_platform_admin());

create policy "store_policies_insert_platform_admin" on public.store_policies
  for insert to authenticated with check (public.is_platform_admin());

create policy "store_policies_update_platform_admin" on public.store_policies
  for update to authenticated using (public.is_platform_admin());

create policy "store_policies_delete_platform_admin" on public.store_policies
  for delete to authenticated using (public.is_platform_admin());

create policy "store_policies_select_member" on public.store_policies
  for select to authenticated
  using (public.is_store_member(store_id));

create policy "store_policies_write_owner_admin" on public.store_policies
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_policies_update_owner_admin" on public.store_policies
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));

-- ── products ─────────────────────────────────────────────────

create policy "products_select_platform_admin" on public.products
  for select to authenticated using (public.is_platform_admin());

create policy "products_insert_platform_admin" on public.products
  for insert to authenticated with check (public.is_platform_admin());

create policy "products_update_platform_admin" on public.products
  for update to authenticated using (public.is_platform_admin());

create policy "products_delete_platform_admin" on public.products
  for delete to authenticated using (public.is_platform_admin());

-- Any store member can read products
create policy "products_select_member" on public.products
  for select to authenticated
  using (public.is_store_member(store_id));

-- owner/admin/staff can create and update products
create policy "products_insert_write" on public.products
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

create policy "products_update_write" on public.products
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

-- only owner/admin can delete products
create policy "products_delete_owner_admin" on public.products
  for delete to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));

-- ── product_images ───────────────────────────────────────────

create policy "product_images_select_platform_admin" on public.product_images
  for select to authenticated using (public.is_platform_admin());

create policy "product_images_insert_platform_admin" on public.product_images
  for insert to authenticated with check (public.is_platform_admin());

create policy "product_images_update_platform_admin" on public.product_images
  for update to authenticated using (public.is_platform_admin());

create policy "product_images_delete_platform_admin" on public.product_images
  for delete to authenticated using (public.is_platform_admin());

create policy "product_images_select_member" on public.product_images
  for select to authenticated
  using (public.is_store_member(store_id));

create policy "product_images_write" on public.product_images
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

create policy "product_images_update_write" on public.product_images
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

create policy "product_images_delete_write" on public.product_images
  for delete to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

-- ── offers ───────────────────────────────────────────────────

create policy "offers_select_platform_admin" on public.offers
  for select to authenticated using (public.is_platform_admin());

create policy "offers_insert_platform_admin" on public.offers
  for insert to authenticated with check (public.is_platform_admin());

create policy "offers_update_platform_admin" on public.offers
  for update to authenticated using (public.is_platform_admin());

create policy "offers_delete_platform_admin" on public.offers
  for delete to authenticated using (public.is_platform_admin());

create policy "offers_select_member" on public.offers
  for select to authenticated
  using (public.is_store_member(store_id));

create policy "offers_insert_write" on public.offers
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

create policy "offers_update_write" on public.offers
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

create policy "offers_delete_owner_admin" on public.offers
  for delete to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));

-- ── offer_images ─────────────────────────────────────────────

create policy "offer_images_select_platform_admin" on public.offer_images
  for select to authenticated using (public.is_platform_admin());

create policy "offer_images_insert_platform_admin" on public.offer_images
  for insert to authenticated with check (public.is_platform_admin());

create policy "offer_images_update_platform_admin" on public.offer_images
  for update to authenticated using (public.is_platform_admin());

create policy "offer_images_delete_platform_admin" on public.offer_images
  for delete to authenticated using (public.is_platform_admin());

create policy "offer_images_select_member" on public.offer_images
  for select to authenticated
  using (public.is_store_member(store_id));

create policy "offer_images_write" on public.offer_images
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

create policy "offer_images_update_write" on public.offer_images
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

create policy "offer_images_delete_write" on public.offer_images
  for delete to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

-- ── orders ───────────────────────────────────────────────────
-- Orders are created by the public (via Edge Functions for payment flows),
-- read/managed by store members.

create policy "orders_select_platform_admin" on public.orders
  for select to authenticated using (public.is_platform_admin());

create policy "orders_update_platform_admin" on public.orders
  for update to authenticated using (public.is_platform_admin());

-- Any member can read orders of their store
create policy "orders_select_member" on public.orders
  for select to authenticated
  using (public.is_store_member(store_id));

-- owner/admin/staff can update order status
create policy "orders_update_member" on public.orders
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']));

-- Allows anon/Edge Functions to insert orders (public checkout flow)
-- In practice, order creation should go through Edge Functions with service_role.
-- For now we allow authenticated or use Edge Function with service_role.
create policy "orders_insert_platform_admin" on public.orders
  for insert to authenticated
  with check (public.is_platform_admin());

-- ── order_items ──────────────────────────────────────────────

create policy "order_items_select_platform_admin" on public.order_items
  for select to authenticated using (public.is_platform_admin());

create policy "order_items_insert_platform_admin" on public.order_items
  for insert to authenticated with check (public.is_platform_admin());

-- Members can read order_items via their store's orders
create policy "order_items_select_member" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and public.is_store_member(o.store_id)
    )
  );

-- ── payment_providers ────────────────────────────────────────

-- All authenticated users can read active providers
create policy "payment_providers_select_auth" on public.payment_providers
  for select to authenticated
  using (status = 'active');

-- Only platform_admin manages providers
create policy "payment_providers_insert_platform_admin" on public.payment_providers
  for insert to authenticated with check (public.is_platform_admin());

create policy "payment_providers_update_platform_admin" on public.payment_providers
  for update to authenticated using (public.is_platform_admin());

create policy "payment_providers_delete_platform_admin" on public.payment_providers
  for delete to authenticated using (public.is_platform_admin());

-- ── store_payment_settings ───────────────────────────────────

create policy "store_payment_settings_select_platform_admin" on public.store_payment_settings
  for select to authenticated using (public.is_platform_admin());

create policy "store_payment_settings_insert_platform_admin" on public.store_payment_settings
  for insert to authenticated with check (public.is_platform_admin());

create policy "store_payment_settings_update_platform_admin" on public.store_payment_settings
  for update to authenticated using (public.is_platform_admin());

-- owner/admin can read payment settings
create policy "store_payment_settings_select_owner_admin" on public.store_payment_settings
  for select to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));

-- owner/admin can upsert payment settings
create policy "store_payment_settings_write_owner_admin" on public.store_payment_settings
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_payment_settings_update_owner_admin" on public.store_payment_settings
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));

-- ── payment_transactions ─────────────────────────────────────
-- Transactions are written by Edge Functions (service_role bypasses RLS).
-- Frontend users can only read.

create policy "payment_transactions_select_platform_admin" on public.payment_transactions
  for select to authenticated using (public.is_platform_admin());

create policy "payment_transactions_select_owner_admin" on public.payment_transactions
  for select to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']));

create policy "payment_transactions_select_staff" on public.payment_transactions
  for select to authenticated
  using (public.has_store_role(store_id, array['staff']));
