-- Professional catalog merchandising.
-- A product can have a different editorial position in the full catalog,
-- its primary category and each commercial collection.

create table if not exists public.store_catalog_product_positions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.store_product_categories(id) on delete cascade,
  collection_id uuid references public.store_product_collections(id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_catalog_product_positions_one_context check (
    num_nonnulls(category_id, collection_id) <= 1
  )
);

create unique index if not exists uq_catalog_position_global
  on public.store_catalog_product_positions(store_id, product_id)
  where category_id is null and collection_id is null;

create unique index if not exists uq_catalog_position_category
  on public.store_catalog_product_positions(store_id, category_id, product_id)
  where category_id is not null and collection_id is null;

create unique index if not exists uq_catalog_position_collection
  on public.store_catalog_product_positions(store_id, collection_id, product_id)
  where category_id is null and collection_id is not null;

create unique index if not exists uq_catalog_positions_global_order
  on public.store_catalog_product_positions(store_id, sort_order)
  where category_id is null and collection_id is null;

create unique index if not exists uq_catalog_positions_category_order
  on public.store_catalog_product_positions(store_id, category_id, sort_order)
  where category_id is not null;

create unique index if not exists uq_catalog_positions_collection_order
  on public.store_catalog_product_positions(store_id, collection_id, sort_order)
  where collection_id is not null;

drop trigger if exists store_catalog_product_positions_updated_at on public.store_catalog_product_positions;
create trigger store_catalog_product_positions_updated_at
  before update on public.store_catalog_product_positions
  for each row execute function public.handle_updated_at();

create or replace function public.validate_catalog_product_position()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.products product
    where product.id = new.product_id and product.store_id = new.store_id
  ) then
    raise exception 'CATALOG_POSITION_PRODUCT_STORE_MISMATCH';
  end if;

  if new.category_id is not null and not exists (
    select 1
    from public.products product
    join public.store_product_categories category on category.id = new.category_id
    where product.id = new.product_id
      and product.store_id = new.store_id
      and category.store_id = new.store_id
      and product.category_id = category.id
  ) then
    raise exception 'CATALOG_POSITION_CATEGORY_MISMATCH';
  end if;

  if new.collection_id is not null and not exists (
    select 1
    from public.product_collections assignment
    join public.products product on product.id = assignment.product_id
    join public.store_product_collections collection on collection.id = assignment.collection_id
    where assignment.product_id = new.product_id
      and assignment.collection_id = new.collection_id
      and product.store_id = new.store_id
      and collection.store_id = new.store_id
  ) then
    raise exception 'CATALOG_POSITION_COLLECTION_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_catalog_product_position on public.store_catalog_product_positions;
create trigger validate_catalog_product_position
  before insert or update of store_id, product_id, category_id, collection_id
  on public.store_catalog_product_positions
  for each row execute function public.validate_catalog_product_position();

alter table public.store_catalog_product_positions enable row level security;

drop policy if exists "catalog_positions_select_member" on public.store_catalog_product_positions;
create policy "catalog_positions_select_member" on public.store_catalog_product_positions
  for select to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

drop policy if exists "catalog_positions_write_member" on public.store_catalog_product_positions;
create policy "catalog_positions_write_member" on public.store_catalog_product_positions
  for all to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin())
  with check (public.has_store_role(store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin());

grant select, insert, update, delete on public.store_catalog_product_positions to authenticated;

-- Returns the complete ordered list for one admin merchandising context.
-- Missing positions naturally go last, so newly created products never jump
-- ahead of an order the merchant already curated.
create or replace function public.get_store_catalog_product_order(
  p_store_id uuid,
  p_category_id uuid default null,
  p_collection_id uuid default null
)
returns table(product_id uuid, sort_order integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if num_nonnulls(p_category_id, p_collection_id) > 1 then
    raise exception 'CATALOG_ORDER_INVALID_CONTEXT';
  end if;
  if not (public.is_store_member(p_store_id) or public.is_platform_admin()) then
    raise exception 'CATALOG_ORDER_FORBIDDEN';
  end if;

  return query
  select
    product.id,
    row_number() over (
      order by
        case when position.id is null then 1 else 0 end,
        position.sort_order,
        case when position.id is null then case when product.is_featured then 0 else 1 end end,
        case when position.id is null then product.created_at end desc,
        product.name,
        product.id
    )::integer - 1
  from public.products product
  left join public.store_catalog_product_positions position
    on position.store_id = product.store_id
   and position.product_id = product.id
   and position.category_id is not distinct from p_category_id
   and position.collection_id is not distinct from p_collection_id
  where product.store_id = p_store_id
    and product.status <> 'archived'
    and (p_category_id is null or product.category_id = p_category_id)
    and (
      p_collection_id is null
      or exists (
        select 1 from public.product_collections assignment
        where assignment.product_id = product.id
          and assignment.collection_id = p_collection_id
      )
    )
  order by 2;
end;
$$;

revoke all on function public.get_store_catalog_product_order(uuid, uuid, uuid) from public, anon;
grant execute on function public.get_store_catalog_product_order(uuid, uuid, uuid) to authenticated;

-- Atomically validates and persists the complete order for one context.
create or replace function public.reorder_store_catalog_products(
  p_store_id uuid,
  p_product_ids uuid[],
  p_category_id uuid default null,
  p_collection_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected_count integer;
  v_received_count integer := cardinality(coalesce(p_product_ids, '{}'::uuid[]));
  v_owner_id uuid := auth.uid();
begin
  if num_nonnulls(p_category_id, p_collection_id) > 1 then
    raise exception 'CATALOG_ORDER_INVALID_CONTEXT';
  end if;
  if not (public.has_store_role(p_store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin()) then
    raise exception 'CATALOG_ORDER_FORBIDDEN';
  end if;
  if v_owner_id is null then raise exception 'CATALOG_ORDER_UNAUTHENTICATED'; end if;

  if p_category_id is not null and not exists (
    select 1 from public.store_product_categories category
    where category.id = p_category_id and category.store_id = p_store_id
  ) then
    raise exception 'CATALOG_ORDER_INVALID_CATEGORY';
  end if;
  if p_collection_id is not null and not exists (
    select 1 from public.store_product_collections collection
    where collection.id = p_collection_id and collection.store_id = p_store_id
  ) then
    raise exception 'CATALOG_ORDER_INVALID_COLLECTION';
  end if;

  select count(*)::integer into v_expected_count
  from public.products product
  where product.store_id = p_store_id
    and product.status <> 'archived'
    and (p_category_id is null or product.category_id = p_category_id)
    and (
      p_collection_id is null
      or exists (
        select 1 from public.product_collections assignment
        where assignment.product_id = product.id
          and assignment.collection_id = p_collection_id
      )
    );

  if v_received_count <> v_expected_count
     or (select count(distinct requested.id) from unnest(coalesce(p_product_ids, '{}'::uuid[])) requested(id)) <> v_expected_count
     or exists (
       select 1
       from unnest(coalesce(p_product_ids, '{}'::uuid[])) requested(id)
       left join public.products product on product.id = requested.id
       where product.id is null
          or product.store_id <> p_store_id
          or product.status = 'archived'
          or (p_category_id is not null and product.category_id <> p_category_id)
          or (p_collection_id is not null and not exists (
            select 1 from public.product_collections assignment
            where assignment.product_id = product.id
              and assignment.collection_id = p_collection_id
          ))
     ) then
    raise exception 'CATALOG_ORDER_MUST_INCLUDE_EXACT_CONTEXT';
  end if;

  delete from public.store_catalog_product_positions position
  where position.store_id = p_store_id
    and position.category_id is not distinct from p_category_id
    and position.collection_id is not distinct from p_collection_id;

  insert into public.store_catalog_product_positions (
    store_id, product_id, owner_id, category_id, collection_id, sort_order
  )
  select p_store_id, requested.id, v_owner_id, p_category_id, p_collection_id, (requested.ordinality - 1)::integer
  from unnest(coalesce(p_product_ids, '{}'::uuid[])) with ordinality requested(id, ordinality);
end;
$$;

revoke all on function public.reorder_store_catalog_products(uuid, uuid[], uuid, uuid) from public, anon;
grant execute on function public.reorder_store_catalog_products(uuid, uuid[], uuid, uuid) to authenticated;

create or replace function public.reorder_store_product_categories(
  p_store_id uuid,
  p_category_ids uuid[],
  p_parent_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected_count integer;
begin
  if not (public.has_store_role(p_store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin()) then
    raise exception 'CATEGORY_ORDER_FORBIDDEN';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.store_product_categories parent
    where parent.id = p_parent_id and parent.store_id = p_store_id
  ) then
    raise exception 'CATEGORY_ORDER_INVALID_PARENT';
  end if;

  select count(*)::integer into v_expected_count
  from public.store_product_categories category
  where category.store_id = p_store_id
    and category.parent_id is not distinct from p_parent_id;

  if cardinality(coalesce(p_category_ids, '{}'::uuid[])) <> v_expected_count
     or (select count(distinct requested.id) from unnest(coalesce(p_category_ids, '{}'::uuid[])) requested(id)) <> v_expected_count
     or exists (
       select 1
       from unnest(coalesce(p_category_ids, '{}'::uuid[])) requested(id)
       left join public.store_product_categories category on category.id = requested.id
       where category.id is null
          or category.store_id <> p_store_id
          or category.parent_id is distinct from p_parent_id
     ) then
    raise exception 'CATEGORY_ORDER_MUST_INCLUDE_EXACT_SIBLINGS';
  end if;

  update public.store_product_categories category
  set sort_order = (requested.ordinality - 1)::integer,
      updated_at = now()
  from unnest(coalesce(p_category_ids, '{}'::uuid[])) with ordinality requested(id, ordinality)
  where category.id = requested.id;
end;
$$;

revoke all on function public.reorder_store_product_categories(uuid, uuid[], uuid) from public, anon;
grant execute on function public.reorder_store_product_categories(uuid, uuid[], uuid) to authenticated;

-- The default storefront order is now the merchant's editorial order.
-- Explicit customer sorts (price, newest, name, featured) still override it.
create or replace function public.public_catalog_search_page(
  p_store_slug text,
  p_category_slug text default null,
  p_category_parent_id uuid default null,
  p_subcategory_slug text default null,
  p_collection_slug text default null,
  p_query text default null,
  p_only_featured boolean default false,
  p_only_on_sale boolean default false,
  p_sort_key text default 'relevance',
  p_offset integer default 0,
  p_limit integer default 24
)
returns setof public.public_product_pages
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with store_context as (
    select store.id
    from public.stores store
    where store.slug = p_store_slug and store.status = 'active'
  ),
  collection_context as (
    select collection.id
    from public.store_product_collections collection
    join store_context store on store.id = collection.store_id
    where collection.slug = nullif(coalesce(p_collection_slug, ''), '')
  ),
  filtered as (
    select
      page as product_page,
      page.product_name,
      page.product_created_at,
      page.is_featured,
      page.regular_price,
      page.sale_price,
      page.variants,
      category.sort_order as category_sort_order,
      position.sort_order as editorial_sort_order
    from public.public_product_pages page
    join store_context store on true
    left join public.store_product_categories category on category.id = page.category_id
    left join collection_context selected_collection on true
    left join public.store_catalog_product_positions position
      on position.store_id = store.id
     and position.product_id = page.product_id
     and (
       (selected_collection.id is not null and position.collection_id = selected_collection.id and position.category_id is null)
       or (
         selected_collection.id is null
         and (
           nullif(coalesce(p_category_slug, ''), '') is not null
           or nullif(coalesce(p_subcategory_slug, ''), '') is not null
         )
         and position.category_id = page.category_id
         and position.collection_id is null
       )
       or (
         selected_collection.id is null
         and nullif(coalesce(p_category_slug, ''), '') is null
         and nullif(coalesce(p_subcategory_slug, ''), '') is null
         and position.category_id is null
         and position.collection_id is null
       )
     )
    where page.store_slug = p_store_slug
      and (
        nullif(coalesce(p_subcategory_slug, ''), '') is null
        or page.category_slug = p_subcategory_slug
      )
      and (
        nullif(coalesce(p_subcategory_slug, ''), '') is not null
        or nullif(coalesce(p_category_slug, ''), '') is null
        or page.category_slug = p_category_slug
        or (p_category_parent_id is not null and page.category_parent_id = p_category_parent_id)
      )
      and (
        nullif(coalesce(p_collection_slug, ''), '') is null
        or (
          selected_collection.id is not null
          and exists (
          select 1
          from jsonb_array_elements(coalesce(page.collections::jsonb, '[]'::jsonb)) collection_item
          where collection_item ->> 'id' = selected_collection.id::text
          )
        )
      )
      and (not p_only_featured or page.is_featured = true)
      and (not p_only_on_sale or (page.sale_price is not null and page.sale_price < page.regular_price))
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or page.product_name ilike '%' || btrim(p_query) || '%'
        or page.description ilike '%' || btrim(p_query) || '%'
        or coalesce(page.category_name, '') ilike '%' || btrim(p_query) || '%'
      )
  )
  select (filtered.product_page).*
  from filtered
  order by
    case when p_sort_key = 'featured' then case when filtered.is_featured then 0 else 1 end end asc nulls last,
    case when p_sort_key = 'newest' then filtered.product_created_at end desc nulls last,
    case when p_sort_key = 'name_asc' then filtered.product_name end asc nulls last,
    case when p_sort_key = 'price_asc'
      then public.public_catalog_min_price(filtered.regular_price, filtered.sale_price, filtered.variants::jsonb)
    end asc nulls last,
    case when p_sort_key = 'price_desc'
      then public.public_catalog_max_price(filtered.regular_price, filtered.sale_price, filtered.variants::jsonb)
    end desc nulls last,
    case when p_sort_key in ('relevance', 'featured')
      and nullif(coalesce(p_category_slug, ''), '') is not null
      and nullif(coalesce(p_collection_slug, ''), '') is null
      and filtered.editorial_sort_order is not null
      then filtered.category_sort_order
    end asc nulls last,
    case when p_sort_key in ('relevance', 'featured') then case when filtered.editorial_sort_order is null then 1 else 0 end end asc nulls last,
    case when p_sort_key in ('relevance', 'featured') then filtered.editorial_sort_order end asc nulls last,
    case when p_sort_key in ('relevance', 'featured') and filtered.editorial_sort_order is null
      then case when filtered.is_featured then 0 else 1 end
    end asc nulls last,
    case when p_sort_key in ('relevance', 'featured') and filtered.editorial_sort_order is null
      then filtered.product_created_at
    end desc nulls last,
    filtered.product_name asc,
    ((filtered.product_page).product_id) asc
  offset greatest(p_offset, 0)
  limit greatest(p_limit, 1);
$$;

revoke all on function public.public_catalog_search_page(text, text, uuid, text, text, text, boolean, boolean, text, integer, integer) from public;
grant execute on function public.public_catalog_search_page(text, text, uuid, text, text, text, boolean, boolean, text, integer, integer) to anon, authenticated;
