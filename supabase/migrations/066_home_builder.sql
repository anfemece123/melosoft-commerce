-- ============================================================
-- Melosoft Commerce — Home Builder (per-store homepage sections)
-- Migration: 066
--
-- Adds store_home_sections + store_home_section_items so each store
-- can compose its public homepage as an ordered list of togglable
-- sections (hero marker, promo banners, featured products/categories,
-- testimonials, image+text — Phase 1; featured collections, menu
-- highlights, benefits, gallery reserved for Phase 2, no schema
-- change needed later).
--
-- RLS/view style mirrors 019_storefront_hero_carousel.sql exactly.
-- ============================================================

create table public.store_home_sections (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  section_type text not null check (section_type in (
                 'hero',                 -- Phase 1 (position/visibility marker only —
                                          -- content stays in store_hero_slides)
                 'promo_banners',        -- Phase 1
                 'featured_products',    -- Phase 1
                 'featured_categories',  -- Phase 1
                 'testimonials',         -- Phase 1
                 'image_text',           -- Phase 1
                 'featured_collections', -- Phase 2 placeholder
                 'menu_highlights',      -- Phase 2 placeholder
                 'benefits',             -- Phase 2 placeholder
                 'gallery'               -- Phase 2 placeholder
               )),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  heading      text,
  subheading   text,
  -- Type-specific single-instance settings (never repeatable lists — those
  -- live in store_home_section_items). Decoded by homeSections.mapper.ts,
  -- keyed off section_type. Same jsonb+mapper pattern already used by
  -- products.description_sections and store_theme_settings.header_settings.
  content      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_store_home_sections_store_sort
  on public.store_home_sections(store_id, sort_order, created_at);

drop trigger if exists store_home_sections_updated_at on public.store_home_sections;

create trigger store_home_sections_updated_at
  before update on public.store_home_sections
  for each row execute procedure public.handle_updated_at();

-- ── store_home_section_items ─────────────────────────────────
-- One shared table for every *repeatable* content type: promo banner
-- slides, testimonials, and manual product/category/collection picks
-- for featured_products / featured_categories / featured_collections.
-- Discriminated at read time by the parent section's section_type —
-- a row always belongs to exactly one section, whose type is authoritative.
create table public.store_home_section_items (
  id                 uuid primary key default gen_random_uuid(),
  section_id         uuid not null references public.store_home_sections(id) on delete cascade,
  store_id           uuid not null references public.stores(id) on delete cascade,
                     -- denormalized (mirrors store_hero_slides's flat-row RLS
                     -- style — avoids a join-through-parent EXISTS in every policy)
  sort_order         integer not null default 0,
  is_active          boolean not null default true,

  -- Polymorphic manual reference (featured_products / featured_categories /
  -- featured_collections in manual mode). No DB-level FK is possible across
  -- three different target tables with one column, so this is an unenforced
  -- reference by design — resolved at read time by the service; a dangling
  -- reference (e.g. product deleted after being featured) is silently
  -- skipped when building the public response.
  linked_entity_type text check (linked_entity_type in ('product', 'category', 'collection')),
  linked_entity_id   uuid,

  -- Freeform repeatable content (promo_banners / testimonials / gallery /
  -- benefits), reused generically across types instead of one column set per type:
  title       text,   -- banner heading / testimonial author name / benefit title
  subtitle    text,   -- banner subtitle / testimonial role or company / benefit caption
  body        text,   -- testimonial quote / gallery caption
  image_url   text,   -- banner image / testimonial avatar / gallery image / benefit icon image
  link_url    text,   -- banner/CTA target (external or internal path)
  link_label  text,   -- CTA button label
  rating      smallint check (rating between 1 and 5), -- testimonials only

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_store_home_section_items_section_sort
  on public.store_home_section_items(section_id, sort_order, created_at);
create index idx_store_home_section_items_store
  on public.store_home_section_items(store_id);

drop trigger if exists store_home_section_items_updated_at on public.store_home_section_items;

create trigger store_home_section_items_updated_at
  before update on public.store_home_section_items
  for each row execute procedure public.handle_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table public.store_home_sections enable row level security;
alter table public.store_home_section_items enable row level security;

grant select, insert, update, delete on public.store_home_sections to authenticated;
grant select on public.store_home_sections to anon;
grant select, insert, update, delete on public.store_home_section_items to authenticated;
grant select on public.store_home_section_items to anon;

-- store_home_sections policies

create policy "store_home_sections_select_platform_admin" on public.store_home_sections
  for select to authenticated using (public.is_platform_admin());

create policy "store_home_sections_insert_platform_admin" on public.store_home_sections
  for insert to authenticated with check (public.is_platform_admin());

create policy "store_home_sections_update_platform_admin" on public.store_home_sections
  for update to authenticated using (public.is_platform_admin());

create policy "store_home_sections_delete_platform_admin" on public.store_home_sections
  for delete to authenticated using (public.is_platform_admin());

create policy "store_home_sections_select_member" on public.store_home_sections
  for select to authenticated using (public.is_store_member(store_id));

create policy "store_home_sections_insert_owner_admin" on public.store_home_sections
  for insert to authenticated with check (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_home_sections_update_owner_admin" on public.store_home_sections
  for update to authenticated using (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_home_sections_delete_owner_admin" on public.store_home_sections
  for delete to authenticated using (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_home_sections_select_public" on public.store_home_sections
  for select to anon
  using (
    exists (
      select 1
      from public.stores s
      where s.id = store_home_sections.store_id
        and s.status = 'active'
    )
  );

-- store_home_section_items policies

create policy "store_home_section_items_select_platform_admin" on public.store_home_section_items
  for select to authenticated using (public.is_platform_admin());

create policy "store_home_section_items_insert_platform_admin" on public.store_home_section_items
  for insert to authenticated with check (public.is_platform_admin());

create policy "store_home_section_items_update_platform_admin" on public.store_home_section_items
  for update to authenticated using (public.is_platform_admin());

create policy "store_home_section_items_delete_platform_admin" on public.store_home_section_items
  for delete to authenticated using (public.is_platform_admin());

create policy "store_home_section_items_select_member" on public.store_home_section_items
  for select to authenticated using (public.is_store_member(store_id));

create policy "store_home_section_items_insert_owner_admin" on public.store_home_section_items
  for insert to authenticated with check (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_home_section_items_update_owner_admin" on public.store_home_section_items
  for update to authenticated using (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_home_section_items_delete_owner_admin" on public.store_home_section_items
  for delete to authenticated using (public.has_store_role(store_id, array['owner', 'admin']));

create policy "store_home_section_items_select_public" on public.store_home_section_items
  for select to anon
  using (
    exists (
      select 1
      from public.stores s
      where s.id = store_home_section_items.store_id
        and s.status = 'active'
    )
  );

-- ── Public views ──────────────────────────────────────────────
-- security_invoker = true (relies on the anon RLS policies above), same
-- style as public_store_hero_slides / public_store_locations.

create view public.public_store_home_sections
  with (security_invoker = true)
as
select
  hs.id,
  hs.store_id,
  hs.section_type,
  hs.sort_order,
  hs.is_active,
  hs.heading,
  hs.subheading,
  hs.content
from public.store_home_sections hs
join public.stores s on s.id = hs.store_id
where s.status = 'active'
  and hs.is_active = true;

create view public.public_store_home_section_items
  with (security_invoker = true)
as
select
  it.id,
  it.section_id,
  it.store_id,
  it.sort_order,
  it.is_active,
  it.linked_entity_type,
  it.linked_entity_id,
  it.title,
  it.subtitle,
  it.body,
  it.image_url,
  it.link_url,
  it.link_label,
  it.rating
from public.store_home_section_items it
join public.stores s on s.id = it.store_id
where s.status = 'active'
  and it.is_active = true;

grant select on public.public_store_home_sections to anon, authenticated;
grant select on public.public_store_home_section_items to anon, authenticated;
