-- ============================================================
-- Migration 067 — Fix Home Builder public views permissions
--
-- 066 created public_store_home_sections / public_store_home_section_items
-- with security_invoker = true, which requires anon to have a direct
-- SELECT grant on public.stores to satisfy the `join public.stores s`
-- inside the view. anon never got that grant (same reason
-- public_store_pages/public_product_pages/etc. all moved to
-- security_invoker = false in migrations 032/033/037/057/061) — so the
-- view failed for anon with "permission denied for table stores".
--
-- Fix: recreate both views with security_invoker = false (the view runs
-- as its owner, bypassing the need for anon's own grants on stores); the
-- `where s.status = 'active' and is_active = true` clause remains the
-- actual security boundary for anon reads, same as every other public
-- view in this project.
-- ============================================================

drop view if exists public.public_store_home_sections;
drop view if exists public.public_store_home_section_items;

create view public.public_store_home_sections
  with (security_invoker = false)
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
  it.rating
from public.store_home_section_items it
join public.stores s on s.id = it.store_id
where s.status = 'active'
  and it.is_active = true;

grant select on public.public_store_home_sections to anon, authenticated;
grant select on public.public_store_home_section_items to anon, authenticated;
