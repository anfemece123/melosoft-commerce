-- ============================================================
-- Melosoft Commerce — Storefront Hero Settings
-- Migration: 017
-- Adds configurable hero content/assets per store and exposes
-- them through public_store_pages.
-- ============================================================

alter table public.stores
  add column if not exists hero_title text,
  add column if not exists hero_subtitle text,
  add column if not exists hero_cta_label text,
  add column if not exists hero_image_url text,
  add column if not exists hero_background_image_url text;

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
