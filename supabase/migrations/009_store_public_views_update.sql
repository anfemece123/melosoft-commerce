-- ============================================================
-- Melosoft Commerce — Update Public Views
-- Migration: 009
-- Depends on: 001, 007, 008
-- ============================================================
-- Recreates public_store_pages to include new fields:
--  slogan, business_type, theme_preset, location, and
--  a JSON array of business_hours.
-- public_product_pages and public_offer_pages remain unchanged
-- structurally but are recreated for consistency.
-- ============================================================

-- Drop existing views first
drop view if exists public.public_store_pages;
drop view if exists public.public_product_pages;
drop view if exists public.public_offer_pages;


-- ── public_store_pages ───────────────────────────────────────

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
  s.whatsapp_number,
  s.support_email,
  s.instagram_url,
  s.facebook_url,
  s.tiktok_url,
  s.country,
  s.city,
  s.currency,
  -- Theme
  t.mode                          as theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  -- Policies
  p.shipping_policy,
  p.returns_policy,
  p.warranty_policy,
  p.privacy_policy,
  p.terms_and_conditions,
  -- Location (only if public)
  case when l.is_public then l.address_line   else null end  as location_address,
  case when l.is_public then l.neighborhood   else null end  as location_neighborhood,
  case when l.is_public then l.city           else null end  as location_city,
  case when l.is_public then l.department     else null end  as location_department,
  case when l.is_public then l.country        else null end  as location_country,
  case when l.is_public then l.latitude       else null end  as location_latitude,
  case when l.is_public then l.longitude      else null end  as location_longitude
from public.stores s
left join public.store_theme_settings  t on t.store_id = s.id
left join public.store_policies        p on p.store_id = s.id
left join public.store_locations       l on l.store_id = s.id
where s.status = 'active';


-- ── public_product_pages ─────────────────────────────────────

create view public.public_product_pages
  with (security_invoker = true)
as
select
  s.slug                  as store_slug,
  s.name                  as store_name,
  s.logo_url,
  t.mode                  as theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  pr.id                   as product_id,
  pr.slug                 as product_slug,
  pr.name                 as product_name,
  pr.description,
  pr.short_description,
  pr.regular_price,
  pr.sale_price,
  pr.stock,
  pr.main_image_url,
  pr.category
from public.products pr
join public.stores s on s.id = pr.store_id
left join public.store_theme_settings t on t.store_id = s.id
where s.status = 'active'
  and pr.status = 'active';


-- ── public_offer_pages ───────────────────────────────────────

create view public.public_offer_pages
  with (security_invoker = true)
as
select
  s.slug                  as store_slug,
  s.name                  as store_name,
  s.logo_url,
  t.mode                  as theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  o.id                    as offer_id,
  o.slug                  as offer_slug,
  o.title,
  o.subtitle,
  o.description,
  o.regular_price,
  o.offer_price,
  o.starts_at,
  o.ends_at,
  o.status,
  o.timer_type,
  o.whatsapp_number,
  o.whatsapp_message,
  o.cta_label,
  o.hero_image_url,
  o.terms_and_conditions,
  pr.name                 as product_name,
  pr.slug                 as product_slug,
  pr.main_image_url       as product_main_image_url
from public.offers o
join public.stores s on s.id = o.store_id
left join public.store_theme_settings t on t.store_id = s.id
left join public.products pr on pr.id = o.product_id
where s.status = 'active'
  and o.status = 'active'
  and o.ends_at > now();
