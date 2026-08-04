-- Rich, rename-safe destinations for every public-cover CTA.

alter table public.store_hero_slides
  add column if not exists cta_target_type text not null default 'catalog',
  add column if not exists cta_target_id uuid,
  add column if not exists cta_target_url text;

alter table public.store_hero_slides
  drop constraint if exists store_hero_slides_cta_target_type_check;

alter table public.store_hero_slides
  add constraint store_hero_slides_cta_target_type_check
  check (cta_target_type in (
    'catalog', 'category', 'collection', 'featured', 'sale',
    'product', 'offer', 'custom'
  ));

alter table public.store_hero_slides
  drop constraint if exists store_hero_slides_cta_target_shape_check;

alter table public.store_hero_slides
  add constraint store_hero_slides_cta_target_shape_check
  check (
    not show_cta
    or (
      cta_target_type in ('catalog', 'featured', 'sale')
      and cta_target_id is null
      and cta_target_url is null
    )
    or (
      cta_target_type in ('category', 'collection', 'product', 'offer')
      and cta_target_id is not null
      and cta_target_url is null
    )
    or (
      cta_target_type = 'custom'
      and cta_target_id is null
      and nullif(btrim(cta_target_url), '') is not null
    )
  );

create or replace view public.public_store_hero_slides
  with (security_invoker = false)
as
select
  hs.id,
  hs.store_id,
  hs.sort_order,
  hs.is_active,
  hs.show_title,
  hs.show_subtitle,
  hs.show_cta,
  hs.show_main_image,
  hs.show_badge_image,
  hs.title,
  hs.subtitle,
  hs.cta_label,
  hs.main_image_url,
  hs.background_image_url,
  hs.badge_image_url,
  hs.cta_target_type,
  hs.cta_target_id,
  hs.cta_target_url
from public.store_hero_slides hs
join public.stores s on s.id = hs.store_id
where s.status = 'active'
  and hs.is_active = true;

grant select on public.public_store_hero_slides to anon, authenticated;
