-- ============================================================
-- Melosoft Commerce — Storefront Hero Carousel
-- Migration: 019
-- Adds store-level hero enable flag and configurable slides.
-- ============================================================

alter table public.stores
  add column if not exists hero_enabled boolean not null default true;

create table if not exists public.store_hero_slides (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sort_order smallint not null default 1 check (sort_order between 1 and 3),
  is_active boolean not null default true,
  show_title boolean not null default true,
  show_subtitle boolean not null default true,
  show_cta boolean not null default true,
  show_main_image boolean not null default true,
  show_badge_image boolean not null default true,
  title text,
  subtitle text,
  cta_label text,
  main_image_url text,
  background_image_url text,
  badge_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, sort_order)
);

drop trigger if exists store_hero_slides_updated_at on public.store_hero_slides;

create trigger store_hero_slides_updated_at
  before update on public.store_hero_slides
  for each row execute procedure public.handle_updated_at();

create index if not exists idx_store_hero_slides_store_id
  on public.store_hero_slides(store_id, sort_order);

alter table public.store_hero_slides enable row level security;

grant select, insert, update, delete on public.store_hero_slides to authenticated;
grant select on public.store_hero_slides to anon;

drop policy if exists "store_hero_slides_select_platform_admin" on public.store_hero_slides;
drop policy if exists "store_hero_slides_insert_platform_admin" on public.store_hero_slides;
drop policy if exists "store_hero_slides_update_platform_admin" on public.store_hero_slides;
drop policy if exists "store_hero_slides_delete_platform_admin" on public.store_hero_slides;
drop policy if exists "store_hero_slides_select_member" on public.store_hero_slides;
drop policy if exists "store_hero_slides_write_owner_admin" on public.store_hero_slides;
drop policy if exists "store_hero_slides_update_owner_admin" on public.store_hero_slides;
drop policy if exists "store_hero_slides_delete_owner_admin" on public.store_hero_slides;
drop policy if exists "store_hero_slides_select_public" on public.store_hero_slides;

create policy "store_hero_slides_select_platform_admin" on public.store_hero_slides
  for select to authenticated using (public.is_platform_admin());

create policy "store_hero_slides_insert_platform_admin" on public.store_hero_slides
  for insert to authenticated with check (public.is_platform_admin());

create policy "store_hero_slides_update_platform_admin" on public.store_hero_slides
  for update to authenticated using (public.is_platform_admin());

create policy "store_hero_slides_delete_platform_admin" on public.store_hero_slides
  for delete to authenticated using (public.is_platform_admin());

create policy "store_hero_slides_select_member" on public.store_hero_slides
  for select to authenticated using (public.is_store_member(store_id));

create policy "store_hero_slides_write_owner_admin" on public.store_hero_slides
  for insert to authenticated with check (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_hero_slides_update_owner_admin" on public.store_hero_slides
  for update to authenticated using (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_hero_slides_delete_owner_admin" on public.store_hero_slides
  for delete to authenticated using (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_hero_slides_select_public" on public.store_hero_slides
  for select to anon
  using (
    exists (
      select 1
      from public.stores s
      where s.id = store_hero_slides.store_id
        and s.status = 'active'
    )
  );

drop view if exists public.public_store_pages;

create view public.public_store_pages
  with (security_invoker = true)
as
select
  s.id                            as store_id,
  s.slug                          as store_slug,
  s.name                          as store_name,
  s.slogan,
  s.business_type,
  s.description,
  s.logo_url,
  s.favicon_url,
  s.hero_enabled,
  s.hero_title,
  s.hero_subtitle,
  s.hero_cta_label,
  s.hero_image_url,
  s.hero_background_image_url,
  s.whatsapp_number,
  s.support_email,
  s.country,
  s.city,
  s.currency,
  t.mode                          as theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  p.shipping_policy,
  p.returns_policy,
  p.warranty_policy,
  p.privacy_policy,
  p.terms_and_conditions,
  case when l.is_public then l.address_line   else null end  as location_address,
  case when l.is_public then l.neighborhood   else null end  as location_neighborhood,
  case when l.is_public then l.city           else null end  as location_city,
  case when l.is_public then l.department     else null end  as location_department,
  case when l.is_public then l.country        else null end  as location_country,
  case when l.is_public then l.latitude       else null end  as location_latitude,
  case when l.is_public then l.longitude      else null end  as location_longitude,
  c.catalog_type
from public.stores s
left join public.store_theme_settings t on t.store_id = s.id
left join public.store_policies p on p.store_id = s.id
left join public.store_locations l on l.store_id = s.id
left join public.store_commerce_settings c on c.store_id = s.id
where s.status = 'active';

grant select on public.public_store_pages to anon, authenticated;
