-- Restaurant merchandising: contextual cart upsells, reusable option
-- templates, visual linked modifiers and location-safe linked inventory.

create table if not exists public.store_cart_upsell_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Completa tu pedido',
  source_product_id uuid references public.products(id) on delete cascade,
  source_category_id uuid references public.store_product_categories(id) on delete cascade,
  target_product_id uuid references public.products(id) on delete cascade,
  target_category_id uuid references public.store_product_categories(id) on delete cascade,
  only_if_missing boolean not null default true,
  max_items integer not null default 3,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_cart_upsell_rules_title_not_blank check (btrim(title) <> ''),
  constraint store_cart_upsell_rules_source_valid check (
    num_nonnulls(source_product_id, source_category_id) <= 1
  ),
  constraint store_cart_upsell_rules_target_valid check (
    num_nonnulls(target_product_id, target_category_id) = 1
  ),
  constraint store_cart_upsell_rules_max_items_valid check (max_items between 1 and 6)
);

create index if not exists idx_store_cart_upsell_rules_store
  on public.store_cart_upsell_rules(store_id, is_active, priority);

create or replace function public.validate_store_cart_upsell_rule()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.source_product_id is not null and not exists (
    select 1 from public.products product
    where product.id = new.source_product_id and product.store_id = new.store_id
  ) then
    raise exception 'UPSELL_SOURCE_PRODUCT_STORE_MISMATCH';
  end if;
  if new.target_product_id is not null and not exists (
    select 1 from public.products product
    where product.id = new.target_product_id and product.store_id = new.store_id
  ) then
    raise exception 'UPSELL_TARGET_PRODUCT_STORE_MISMATCH';
  end if;
  if new.source_category_id is not null and not exists (
    select 1 from public.store_product_categories category
    where category.id = new.source_category_id and category.store_id = new.store_id
  ) then
    raise exception 'UPSELL_SOURCE_CATEGORY_STORE_MISMATCH';
  end if;
  if new.target_category_id is not null and not exists (
    select 1 from public.store_product_categories category
    where category.id = new.target_category_id and category.store_id = new.store_id
  ) then
    raise exception 'UPSELL_TARGET_CATEGORY_STORE_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_store_cart_upsell_rule on public.store_cart_upsell_rules;
create trigger validate_store_cart_upsell_rule
  before insert or update of store_id, source_product_id, source_category_id, target_product_id, target_category_id
  on public.store_cart_upsell_rules
  for each row execute function public.validate_store_cart_upsell_rule();

drop trigger if exists store_cart_upsell_rules_updated_at on public.store_cart_upsell_rules;
create trigger store_cart_upsell_rules_updated_at
  before update on public.store_cart_upsell_rules
  for each row execute function public.handle_updated_at();

alter table public.store_cart_upsell_rules enable row level security;

drop policy if exists "upsell_rules_select_member" on public.store_cart_upsell_rules;
create policy "upsell_rules_select_member" on public.store_cart_upsell_rules
  for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

drop policy if exists "upsell_rules_insert_write" on public.store_cart_upsell_rules;
create policy "upsell_rules_insert_write" on public.store_cart_upsell_rules
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin());

drop policy if exists "upsell_rules_update_write" on public.store_cart_upsell_rules;
create policy "upsell_rules_update_write" on public.store_cart_upsell_rules
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin())
  with check (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin());

drop policy if exists "upsell_rules_delete_write" on public.store_cart_upsell_rules;
create policy "upsell_rules_delete_write" on public.store_cart_upsell_rules
  for delete to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin());

grant select, insert, update, delete on public.store_cart_upsell_rules to authenticated;

-- Templates are reusable presets. Applying one to a product creates the
-- normal product-scoped option groups, so checkout/order history continues
-- to use the already hardened modifier pipeline.
create table if not exists public.store_product_option_templates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  groups jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_product_option_templates_name_not_blank check (btrim(name) <> ''),
  constraint store_product_option_templates_groups_valid check (
    jsonb_typeof(groups) = 'array' and jsonb_array_length(groups) between 1 and 30
  ),
  unique(store_id, name)
);

create index if not exists idx_store_product_option_templates_store
  on public.store_product_option_templates(store_id, is_active, name);

drop trigger if exists store_product_option_templates_updated_at on public.store_product_option_templates;
create trigger store_product_option_templates_updated_at
  before update on public.store_product_option_templates
  for each row execute function public.handle_updated_at();

alter table public.store_product_option_templates enable row level security;

drop policy if exists "option_templates_select_member" on public.store_product_option_templates;
create policy "option_templates_select_member" on public.store_product_option_templates
  for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

drop policy if exists "option_templates_insert_write" on public.store_product_option_templates;
create policy "option_templates_insert_write" on public.store_product_option_templates
  for insert to authenticated
  with check (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin());

drop policy if exists "option_templates_update_write" on public.store_product_option_templates;
create policy "option_templates_update_write" on public.store_product_option_templates
  for update to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin())
  with check (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin());

drop policy if exists "option_templates_delete_write" on public.store_product_option_templates;
create policy "option_templates_delete_write" on public.store_product_option_templates
  for delete to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin());

grant select, insert, update, delete on public.store_product_option_templates to authenticated;

-- Existing restaurant stores get a safe initial global beverage rule when
-- they already have a clearly named beverage category. Merchants can edit
-- or remove it from the new merchandising panel.
insert into public.store_cart_upsell_rules (
  store_id, owner_id, title, target_category_id, only_if_missing, max_items, priority
)
select distinct on (category.store_id)
  category.store_id,
  store.owner_id,
  '¿Algo para tomar?',
  category.id,
  true,
  3,
  0
from public.store_product_categories category
join public.stores store on store.id = category.store_id
join public.store_commerce_settings commerce on commerce.store_id = category.store_id
where commerce.catalog_type = 'menu'
  and category.is_active = true
  and lower(category.name) ~ '(bebida|gaseosa|refresco|drink)'
  and not exists (
    select 1 from public.store_cart_upsell_rules existing
    where existing.store_id = category.store_id
  )
order by category.store_id, category.sort_order, category.name;

-- Linked catalog modifiers now expose the product image so the storefront
-- can render real visual choices instead of text-only chips.
create or replace view public.public_product_option_items
  with (security_invoker = false)
as
select
  i.id,
  i.group_id,
  g.product_id,
  i.label,
  i.description,
  i.price_delta,
  i.is_default,
  i.sort_order,
  i.linked_product_id,
  i.linked_variant_id,
  i.linked_quantity,
  i.price_mode,
  case
    when i.linked_product_id is null then true
    when lp.status <> 'active' or not lp.is_available then false
    when i.linked_variant_id is not null then
      lv.status = 'active' and (lv.stock_policy = 'allow_backorder' or lv.stock_quantity >= i.linked_quantity)
    else not lp.has_variants and (not lp.track_inventory or lp.stock >= i.linked_quantity)
  end as is_available,
  case
    when i.linked_product_id is null then null
    when lp.status <> 'active' or not lp.is_available then 'No disponible'
    when i.linked_variant_id is not null and lv.status <> 'active' then 'No disponible'
    when i.linked_variant_id is not null and lv.stock_policy = 'deny' and lv.stock_quantity < i.linked_quantity then 'Agotado'
    when i.linked_variant_id is null and lp.has_variants then 'Selecciona una presentación'
    when i.linked_variant_id is null and lp.track_inventory and lp.stock < i.linked_quantity then 'Agotado'
    else null
  end as unavailable_reason,
  coalesce(linked_variant_image.image_url, linked_product_image.image_url, lp.main_image_url) as image_url
from public.product_option_items i
join public.product_option_groups g on g.id = i.group_id
join public.products p on p.id = g.product_id
join public.stores s on s.id = p.store_id
left join public.products lp on lp.id = i.linked_product_id
left join public.product_variants lv on lv.id = i.linked_variant_id
left join lateral (
  select image.image_url
  from public.product_images image
  where image.variant_id = i.linked_variant_id
  order by image.is_primary desc, image.sort_order, image.created_at
  limit 1
) linked_variant_image on true
left join lateral (
  select image.image_url
  from public.product_images image
  where image.product_id = i.linked_product_id
    and image.variant_id is null
    and image.option_value_id is null
  order by image.is_primary desc, image.sort_order, image.created_at
  limit 1
) linked_product_image on true
where i.is_active = true
  and g.is_active = true
  and p.status = 'active'
  and p.is_available = true
  and s.status = 'active';

grant select on public.public_product_option_items to anon, authenticated;

-- Resolve contextual suggestions on the server. Explicit merchant rules
-- outrank product featured/order settings and products already in the cart
-- are always excluded.
create or replace function public.get_public_cart_upsells(
  p_store_slug text,
  p_product_ids uuid[],
  p_limit integer default 3
)
returns table (
  rule_title text,
  product_data jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cart_products as (
    select product.id, product.category_id
    from public.products product
    join public.stores store on store.id = product.store_id
    where store.slug = p_store_slug
      and product.id = any(coalesce(p_product_ids, '{}'::uuid[]))
  ),
  applicable_rules as (
    select rule.*
    from public.store_cart_upsell_rules rule
    join public.stores store on store.id = rule.store_id
    where store.slug = p_store_slug
      and store.status = 'active'
      and rule.is_active = true
      and (
        (rule.source_product_id is null and rule.source_category_id is null)
        or rule.source_product_id in (select id from cart_products)
        or exists (
          select 1
          from cart_products cart
          left join public.store_product_categories cart_category on cart_category.id = cart.category_id
          where cart.category_id = rule.source_category_id
             or cart_category.parent_id = rule.source_category_id
        )
      )
      and (
        not rule.only_if_missing
        or (
          (rule.target_product_id is null or rule.target_product_id <> all(coalesce(p_product_ids, '{}'::uuid[])))
          and (
            rule.target_category_id is null
            or not exists (
              select 1
              from cart_products cart
              left join public.store_product_categories cart_category on cart_category.id = cart.category_id
              where cart.category_id = rule.target_category_id
                 or cart_category.parent_id = rule.target_category_id
            )
          )
        )
      )
  ),
  candidates as (
    select
      page.product_id,
      rule.title,
      rule.priority,
      rule.max_items,
      row_number() over (
        partition by rule.id
        order by product.is_featured desc, product.sort_order, product.created_at desc
      ) as rule_position
    from applicable_rules rule
    join public.products product on product.store_id = rule.store_id
    left join public.store_product_categories product_category on product_category.id = product.category_id
    join public.public_product_pages page on page.product_id = product.id
    where product.status = 'active'
      and product.is_available = true
      and product.show_in_ecommerce = true
      and product.id <> all(coalesce(p_product_ids, '{}'::uuid[]))
      and (
        product.id = rule.target_product_id
        or product.category_id = rule.target_category_id
        or product_category.parent_id = rule.target_category_id
      )
  ),
  eligible as (
    select product_id, title, priority, rule_position
    from candidates
    where rule_position <= max_items
  ),
  deduplicated as (
    select distinct on (product_id)
      product_id, title, priority, rule_position
    from eligible
    order by product_id, priority, rule_position
  )
  select suggestion.title, to_jsonb(page)
  from deduplicated suggestion
  join public.public_product_pages page on page.product_id = suggestion.product_id
  order by suggestion.priority, suggestion.rule_position, page.product_name
  limit least(greatest(coalesce(p_limit, 3), 1), 6);
$$;

revoke all on function public.get_public_cart_upsells(text, uuid[], integer) from public;
grant execute on function public.get_public_cart_upsells(text, uuid[], integer) to anon, authenticated;

-- A linked beverage/side disabled at the selected location must be rejected
-- by the server as well as hidden by the storefront.
create or replace function public.snapshot_linked_option_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_location_id uuid;
begin
  if new.option_item_id is not null then
    select item.linked_product_id, item.linked_variant_id,
           case when item.linked_product_id is null then null else item.linked_quantity end
      into new.linked_product_id_snapshot, new.linked_variant_id_snapshot, new.linked_quantity_snapshot
      from public.product_option_items item
      where item.id = new.option_item_id;

    if new.linked_product_id_snapshot is not null then
      select orders.store_location_id
        into v_location_id
        from public.order_items line
        join public.orders orders on orders.id = line.order_id
        where line.id = new.order_item_id;

      if v_location_id is not null and exists (
        select 1
        from public.product_location_availability availability
        where availability.product_id = new.linked_product_id_snapshot
          and availability.store_location_id = v_location_id
          and availability.is_available = false
      ) then
        raise exception 'LINKED_PRODUCT_UNAVAILABLE_AT_LOCATION:%', new.linked_product_id_snapshot;
      end if;
    end if;
  end if;
  return new;
end;
$$;
