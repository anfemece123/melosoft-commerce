-- Let each company choose a persistent floating WhatsApp contact button or
-- an inline contact block integrated into the storefront content.

alter table public.store_theme_settings
  add column if not exists whatsapp_button_layout text not null default 'floating';

alter table public.store_theme_settings
  drop constraint if exists store_theme_settings_whatsapp_button_layout_valid,
  add constraint store_theme_settings_whatsapp_button_layout_valid
    check (whatsapp_button_layout in ('floating', 'inline'));

-- Append the new field to preserve the column order expected by dependent
-- views and existing PostgREST consumers.
create or replace view public.public_store_pages
  with (security_invoker = false)
as
select
  s.id                              as store_id,
  s.slug                            as store_slug,
  s.name                            as store_name,
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
  t.mode                            as theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  t.header_settings,
  coalesce(t.whatsapp_button_enabled, true) as whatsapp_button_enabled,
  t.whatsapp_button_color,
  p.shipping_policy,
  p.returns_policy,
  p.warranty_policy,
  p.privacy_policy,
  p.terms_and_conditions,
  case when l.is_public then l.address_line   else null end as location_address,
  case when l.is_public then l.neighborhood   else null end as location_neighborhood,
  case when l.is_public then l.city           else null end as location_city,
  case when l.is_public then l.department     else null end as location_department,
  case when l.is_public then l.country        else null end as location_country,
  case when l.is_public then l.latitude       else null end as location_latitude,
  case when l.is_public then l.longitude      else null end as location_longitude,
  c.catalog_type,
  c.business_category,
  c.commerce_mode,
  c.delivery_mode,
  c.allows_pickup,
  c.allows_local_delivery,
  c.allows_national_shipping,
  c.whatsapp_checkout_enabled,
  c.web_order_enabled,
  c.cash_on_delivery_enabled,
  c.online_checkout_enabled,
  c.default_order_method,
  c.local_delivery_notes,
  c.shipping_notes,
  c.local_delivery_base_fee,
  c.local_delivery_free_from,
  c.national_shipping_base_fee,
  c.national_shipping_free_from,
  public.store_requires_whatsapp_order_consent(s.id) as whatsapp_order_updates_required,
  coalesce(t.whatsapp_button_layout, 'floating') as whatsapp_button_layout
from public.stores s
left join public.store_theme_settings t on t.store_id = s.id
left join public.store_policies p on p.store_id = s.id
left join lateral (
  select *
  from public.store_locations
  where store_id = s.id and is_primary = true and is_active = true
  limit 1
) l on true
left join public.store_commerce_settings c on c.store_id = s.id
where s.status = 'active';

grant select on public.public_store_pages to anon, authenticated;
