-- ============================================================
-- Melosoft Commerce — Store Commerce Settings
-- Migration: 012
-- Depends on: 001, 004
-- ============================================================

-- ── Table ────────────────────────────────────────────────────

create table public.store_commerce_settings (
  id                          uuid        primary key default gen_random_uuid(),
  store_id                    uuid        not null unique references public.stores(id) on delete cascade,
  business_category           text        not null default 'other',
  catalog_type                text        not null default 'physical_products',
  commerce_mode               text        not null default 'catalog_only',
  delivery_mode               text        not null default 'none',
  allows_pickup               boolean     not null default false,
  allows_local_delivery       boolean     not null default false,
  allows_national_shipping    boolean     not null default false,
  whatsapp_checkout_enabled   boolean     not null default true,
  online_checkout_enabled     boolean     not null default false,
  default_order_method        text        not null default 'whatsapp',
  local_delivery_notes        text,
  shipping_notes              text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint scs_business_category_valid check (
    business_category in ('restaurant','retail','fashion','beauty','technology','pets','home','services','other')
  ),
  constraint scs_catalog_type_valid check (
    catalog_type in ('menu','physical_products','services','mixed')
  ),
  constraint scs_commerce_mode_valid check (
    commerce_mode in ('catalog_only','local_orders','local_delivery_and_pickup','national_shipping','mixed')
  ),
  constraint scs_delivery_mode_valid check (
    delivery_mode in ('none','pickup_only','local_delivery','national_shipping','local_and_national')
  ),
  constraint scs_default_order_method_valid check (
    default_order_method in ('whatsapp','online_checkout')
  )
);

comment on table public.store_commerce_settings is
  'Commercial configuration per store: catalog type, commerce mode, delivery options.';

create trigger store_commerce_settings_updated_at
  before update on public.store_commerce_settings
  for each row execute function public.handle_updated_at();

-- ── Row-Level Security ───────────────────────────────────────

alter table public.store_commerce_settings enable row level security;

-- Platform admin: full access
create policy "platform_admin_all_commerce_settings"
  on public.store_commerce_settings
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- All store members: read
create policy "store_members_read_commerce_settings"
  on public.store_commerce_settings
  for select
  to authenticated
  using (public.is_store_member(store_id));

-- Owner/admin: update
create policy "store_owner_admin_update_commerce_settings"
  on public.store_commerce_settings
  for update
  to authenticated
  using (public.has_store_role(store_id, array['owner','admin']))
  with check (public.has_store_role(store_id, array['owner','admin']));

-- ── GRANTs ──────────────────────────────────────────────────

grant select, update on public.store_commerce_settings to authenticated;
grant all privileges on public.store_commerce_settings to service_role;
