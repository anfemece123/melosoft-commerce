-- ============================================================
-- Migration 079 — Promo banner per-item visual settings
--
-- "Banners promocionales" gets much richer per-banner styling (layout
-- variant, background type — theme/solid/gradient/image — background
-- color, gradient preset, content alignment/image position). All of
-- that is per-banner, not section-wide, so it belongs on
-- store_home_section_items, not store_home_sections.content.
--
-- Rather than adding one narrow typed column per new setting (layout,
-- background_type, background_color, gradient_preset, content_align —
-- and more later as this section keeps evolving), a single `settings`
-- jsonb column follows the exact same pattern store_home_sections.content
-- already uses for section-level config: one flexible column, decoded
-- defensively by the mapper, keyed by what it's used for. Generic on the
-- shared items table (every section type's items could use it later) but
-- only wired up for promo_banners in this pass — additive, default '{}',
-- every existing item's absence of settings just falls back to defaults.
-- ============================================================

alter table public.store_home_section_items
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- public_store_home_section_items — additive column, same
-- security_invoker=false fix migration 067 already applied.
drop view if exists public.public_store_home_section_items;

create view public.public_store_home_section_items
  with (security_invoker = false)
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
  it.rating,
  it.settings
from public.store_home_section_items it
join public.stores s on s.id = it.store_id
where s.status = 'active'
  and it.is_active = true;

grant select on public.public_store_home_section_items to anon, authenticated;
