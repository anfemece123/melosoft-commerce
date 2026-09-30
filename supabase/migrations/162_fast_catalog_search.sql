-- Fast storefront search and catalog pages.
--
-- Problem (measured in production, Velaire, 294 products): every search
-- function read public.public_product_pages. That view builds, for EVERY
-- product, its facet list, collections, variant options, variants and
-- images as JSON — ~1.2 s just to list ids and ~5 s once facet_values is
-- touched. public_catalog_suggest scanned it several times per keystroke
-- (matcher + one scan per brand/category shortcut) and hit the statement
-- timeout; catalog pages paid ~1 s on every load.
--
-- Fix: the same rules, evaluated on the base tables (a few ms), and the
-- heavy view is only read for the rows actually returned (≤ 24 on a
-- catalog page, never for suggestions).
--
-- Visibility rules mirror the view exactly:
--   * product listed: products.status = 'active' and stores.status = 'active'
--   * facet values: product also is_available, facet and value is_active
--     (public_product_facet_values)
--   * collections: product_collections of an active collection
--   * main image: first product_images row (no variant / option value),
--     primary first, else products.main_image_url
--   * variant prices: active product_variants.price, else the active price

-- Counting products per brand/attribute value (suggestion shortcuts) looks
-- rows up by value; the table's primary key starts with product_id.
create index if not exists idx_product_facet_values_facet_value_id
  on public.product_facet_values (facet_value_id);

-- ── Matcher ────────────────────────────────────────────────────────────
create or replace function public.public_catalog_query_matches(p_store_slug text, p_query text)
returns table(product_id uuid, score numeric)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with params as (
    select
      public.catalog_search_normalize(p_query) as phrase,
      public.catalog_search_tokens(p_query) as tokens
  ),
  store_context as (
    select store.id
    from public.stores store
    where store.slug = p_store_slug and store.status = 'active'
  ),
  visible as materialized (
    select
      product.id,
      product.name,
      product.short_description,
      product.description,
      product.category_id,
      product.is_available
    from public.products product
    join store_context store on store.id = product.store_id
    cross join params
    where product.status = 'active'
      and cardinality(params.tokens) > 0
  ),
  facet_text as (
    select assigned.product_id, string_agg(facet_value.value, ' ') as text
    from visible
    join public.product_facet_values assigned on assigned.product_id = visible.id
    join public.store_product_facet_values facet_value
      on facet_value.id = assigned.facet_value_id
     and facet_value.is_active = true
    join store_context store on store.id = facet_value.store_id
    join public.store_product_facets facet
      on facet.id = facet_value.facet_id
     and facet.store_id = facet_value.store_id
     and facet.is_active = true
    where visible.is_available = true
    group by assigned.product_id
  ),
  docs as (
    select
      visible.id as product_id,
      public.catalog_search_normalize(visible.name) as name,
      public.catalog_search_normalize(concat_ws(' ', category.name, facet_text.text)) as meta,
      public.catalog_search_normalize(concat_ws(' ', visible.short_description, visible.description)) as body
    from visible
    left join public.store_product_categories category on category.id = visible.category_id
    left join facet_text on facet_text.product_id = visible.id
  ),
  scored as materialized (
    select
      docs.product_id,
      docs.name,
      docs.meta,
      not exists (
        select 1 from unnest(params.tokens) token
        where not public.catalog_search_token_in(docs.name || ' ' || docs.meta || ' ' || docs.body, token)
      ) as matches_all,
      not exists (
        select 1 from unnest(params.tokens) token
        where not public.catalog_search_token_in(docs.name, token)
      ) as all_in_name,
      not exists (
        select 1 from unnest(params.tokens) token
        where not public.catalog_search_token_in(docs.name || ' ' || docs.meta, token)
      ) as all_in_name_or_meta,
      (
        select count(*) from unnest(params.tokens) token
        where strpos(' ' || docs.name, ' ' || token) > 0
      ) as name_word_starts,
      docs.name = params.phrase as name_exact,
      left(docs.name, length(params.phrase)) = params.phrase as name_prefix,
      strpos(' ' || docs.name, ' ' || params.phrase) > 0 as phrase_in_name
    from docs
    cross join params
  ),
  exact_matches as materialized (
    select
      scored.product_id,
      (
        case when scored.name_exact then 1000 else 0 end
        + case when scored.name_prefix then 500 else 0 end
        + case when scored.phrase_in_name then 250 else 0 end
        + case when scored.all_in_name then 200 when scored.all_in_name_or_meta then 100 else 0 end
        + scored.name_word_starts * 20
      )::numeric as score
    from scored
    where scored.matches_all
  ),
  fuzzy_matches as (
    select
      scored.product_id,
      (
        select min(word_similarity(token, scored.name || ' ' || scored.meta))
        from unnest(params.tokens) token
        where length(token) >= 3
      )::numeric * 100 as score
    from scored
    cross join params
    where not exists (select 1 from exact_matches)
  )
  select exact_matches.product_id, exact_matches.score from exact_matches
  union all
  select fuzzy_matches.product_id, fuzzy_matches.score
  from fuzzy_matches
  where fuzzy_matches.score >= 50;
$$;

-- ── Live suggestions ───────────────────────────────────────────────────
create or replace function public.public_catalog_suggest(
  p_store_slug text,
  p_query text,
  p_limit integer default 6
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with params as (
    select public.catalog_search_normalize(p_query) as phrase
  ),
  store_context as (
    select store.id
    from public.stores store
    where store.slug = p_store_slug and store.status = 'active'
  ),
  matches as materialized (
    select * from public.public_catalog_query_matches(p_store_slug, p_query)
  ),
  top_products as materialized (
    select
      matches.product_id,
      matches.score,
      product.slug,
      product.name,
      product.main_image_url,
      product.category_id,
      product.regular_price,
      product.sale_price,
      product.has_variants,
      product.is_available,
      product.stock,
      product.track_inventory,
      product.is_featured
    from matches
    join public.products product on product.id = matches.product_id
    order by matches.score desc, product.is_featured desc, product.name asc
    limit least(greatest(coalesce(p_limit, 6), 1), 12)
  ),
  products as (
    select
      top_products.product_id,
      top_products.slug as product_slug,
      top_products.name as product_name,
      coalesce(
        (
          select image.image_url
          from public.product_images image
          where image.product_id = top_products.product_id
            and image.variant_id is null
            and image.option_value_id is null
          order by image.is_primary desc, image.sort_order asc
          limit 1
        ),
        top_products.main_image_url
      ) as main_image_url,
      category.name as category_name,
      top_products.regular_price,
      top_products.sale_price,
      top_products.has_variants,
      top_products.is_available,
      top_products.stock,
      top_products.track_inventory,
      top_products.is_featured,
      coalesce(variant_prices.min_price, coalesce(top_products.sale_price, top_products.regular_price)) as min_price,
      coalesce(variant_prices.max_price, coalesce(top_products.sale_price, top_products.regular_price)) as max_price,
      (
        select facet_value.value
        from public.product_facet_values assigned
        join public.store_product_facet_values facet_value
          on facet_value.id = assigned.facet_value_id
         and facet_value.is_active = true
        join public.store_product_facets facet
          on facet.id = facet_value.facet_id
         and facet.store_id = facet_value.store_id
         and facet.is_active = true
         and facet.slug = 'marca'
        where assigned.product_id = top_products.product_id
          and top_products.is_available = true
        limit 1
      ) as brand,
      top_products.score
    from top_products
    left join public.store_product_categories category on category.id = top_products.category_id
    left join lateral (
      select
        min(coalesce(variant.price, coalesce(top_products.sale_price, top_products.regular_price))) as min_price,
        max(coalesce(variant.price, coalesce(top_products.sale_price, top_products.regular_price))) as max_price
      from public.product_variants variant
      where variant.product_id = top_products.product_id
        and variant.status = 'active'
    ) variant_prices on true
  ),
  facet_candidates as materialized (
    select
      facet.name as facet_name,
      facet.slug as facet_slug,
      facet_value.id as value_id,
      facet_value.value,
      facet_value.slug as value_slug,
      public.catalog_search_normalize(facet_value.value) = params.phrase as exact
    from public.store_product_facets facet
    join store_context store on store.id = facet.store_id
    join public.store_product_facet_values facet_value
      on facet_value.facet_id = facet.id
     and facet_value.store_id = facet.store_id
     and facet_value.is_active = true
    cross join params
    where facet.is_active = true
      and facet.show_in_catalog_filters = true
      and length(params.phrase) >= 2
      and (
        strpos(' ' || public.catalog_search_normalize(facet_value.value), ' ' || params.phrase) > 0
        or strpos(' ' || params.phrase || ' ', ' ' || public.catalog_search_normalize(facet_value.value) || ' ') > 0
      )
    limit 10
  ),
  facet_terms as (
    select
      facet_candidates.*,
      (
        select count(*)
        from public.product_facet_values assigned
        join public.products product
          on product.id = assigned.product_id
         and product.status = 'active'
         and product.is_available = true
        where assigned.facet_value_id = facet_candidates.value_id
      ) as product_count
    from facet_candidates
  ),
  category_candidates as materialized (
    select
      category.id,
      category.name,
      category.slug,
      parent.slug as parent_slug,
      public.catalog_search_normalize(category.name) = params.phrase as exact
    from public.store_product_categories category
    join store_context store on store.id = category.store_id
    left join public.store_product_categories parent on parent.id = category.parent_id
    cross join params
    where category.is_active = true
      and length(params.phrase) >= 2
      and (
        strpos(' ' || public.catalog_search_normalize(category.name), ' ' || params.phrase) > 0
        or strpos(' ' || params.phrase || ' ', ' ' || public.catalog_search_normalize(category.name) || ' ') > 0
      )
    limit 10
  ),
  category_terms as (
    select
      category_candidates.*,
      (
        select count(*)
        from public.products product
        join store_context store on store.id = product.store_id
        join public.store_product_categories product_category on product_category.id = product.category_id
        where product.status = 'active'
          and (product_category.id = category_candidates.id or product_category.parent_id = category_candidates.id)
      ) as product_count
    from category_candidates
  ),
  terms as (
    select
      'facet' as kind,
      facet_terms.facet_name as group_label,
      facet_terms.value as label,
      facet_terms.facet_slug,
      facet_terms.value_slug,
      null::text as category_slug,
      null::text as parent_category_slug,
      facet_terms.product_count,
      facet_terms.exact
    from facet_terms
    where facet_terms.product_count > 0
    union all
    select
      'category',
      'Categoría',
      category_terms.name,
      null,
      null,
      category_terms.slug,
      category_terms.parent_slug,
      category_terms.product_count,
      category_terms.exact
    from category_terms
    where category_terms.product_count > 0
  ),
  top_terms as (
    select * from terms
    order by exact desc, product_count desc, label asc
    limit 3
  )
  select jsonb_build_object(
    'total', (select count(*) from matches),
    'products', coalesce(
      (select jsonb_agg(to_jsonb(products) - 'score' order by products.score desc, products.is_featured desc, products.product_name asc) from products),
      '[]'::jsonb
    ),
    'terms', coalesce(
      (select jsonb_agg(to_jsonb(top_terms) - 'exact' order by top_terms.exact desc, top_terms.product_count desc, top_terms.label asc) from top_terms),
      '[]'::jsonb
    )
  );
$$;

-- ── Catalog page ───────────────────────────────────────────────────────
-- Filters, orders and paginates on base tables; the heavy view is read
-- only for the page's rows. Same filters and order as 161.
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
set search_path = public, extensions, pg_temp
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
      and collection.is_active = true
  ),
  query_matches as materialized (
    select * from public.public_catalog_query_matches(p_store_slug, p_query)
    where nullif(btrim(coalesce(p_query, '')), '') is not null
  ),
  filtered as materialized (
    select
      product.id as product_id,
      product.name as product_name,
      product.created_at as product_created_at,
      product.is_featured,
      coalesce(variant_prices.min_price, coalesce(product.sale_price, product.regular_price)) as min_price,
      coalesce(variant_prices.max_price, coalesce(product.sale_price, product.regular_price)) as max_price,
      category.sort_order as category_sort_order,
      position.sort_order as editorial_sort_order,
      query_match.score as query_score
    from public.products product
    join store_context store on store.id = product.store_id
    left join public.store_product_categories category on category.id = product.category_id
    left join collection_context selected_collection on true
    left join query_matches query_match on query_match.product_id = product.id
    left join lateral (
      select
        min(coalesce(variant.price, coalesce(product.sale_price, product.regular_price))) as min_price,
        max(coalesce(variant.price, coalesce(product.sale_price, product.regular_price))) as max_price
      from public.product_variants variant
      where p_sort_key in ('price_asc', 'price_desc')
        and variant.product_id = product.id
        and variant.status = 'active'
    ) variant_prices on true
    left join public.store_catalog_product_positions position
      on position.store_id = store.id
     and position.product_id = product.id
     and (
       (selected_collection.id is not null and position.collection_id = selected_collection.id and position.category_id is null)
       or (
         selected_collection.id is null
         and nullif(coalesce(p_subcategory_slug, ''), '') is not null
         and position.category_id = product.category_id
         and position.collection_id is null
       )
       or (
         selected_collection.id is null
         and nullif(coalesce(p_subcategory_slug, ''), '') is null
         and nullif(coalesce(p_category_slug, ''), '') is not null
         and position.category_id = coalesce(p_category_parent_id, product.category_id)
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
    where product.status = 'active'
      and (
        nullif(coalesce(p_subcategory_slug, ''), '') is null
        or category.slug = p_subcategory_slug
      )
      and (
        nullif(coalesce(p_subcategory_slug, ''), '') is not null
        or nullif(coalesce(p_category_slug, ''), '') is null
        or category.slug = p_category_slug
        or (p_category_parent_id is not null and category.parent_id = p_category_parent_id)
      )
      and (
        nullif(coalesce(p_collection_slug, ''), '') is null
        or (
          selected_collection.id is not null
          and exists (
            select 1
            from public.product_collections assigned
            where assigned.product_id = product.id
              and assigned.collection_id = selected_collection.id
          )
        )
      )
      and (not p_only_featured or product.is_featured = true)
      and (not p_only_on_sale or (product.sale_price is not null and product.sale_price < product.regular_price))
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or query_match.product_id is not null
      )
  ),
  page_rows as materialized (
    select ranked.product_id, ranked.row_number
    from (
      select
        filtered.product_id,
        row_number() over (
          order by
            case when p_sort_key = 'relevance' then filtered.query_score end desc nulls last,
            case when p_sort_key = 'featured' then case when filtered.is_featured then 0 else 1 end end asc nulls last,
            case when p_sort_key = 'newest' then filtered.product_created_at end desc nulls last,
            case when p_sort_key = 'name_asc' then filtered.product_name end asc nulls last,
            case when p_sort_key = 'price_asc' then filtered.min_price end asc nulls last,
            case when p_sort_key = 'price_desc' then filtered.max_price end desc nulls last,
            case when p_sort_key in ('relevance', 'featured')
              and nullif(coalesce(p_subcategory_slug, ''), '') is not null
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
            filtered.product_id asc
        ) as row_number
      from filtered
    ) ranked
    order by ranked.row_number
    offset greatest(p_offset, 0)
    limit greatest(p_limit, 1)
  )
  -- `= any(array)` is pushed into the view as an index lookup on
  -- products.id, so its per-product JSON is built only for these rows.
  select page.*
  from public.public_product_pages page
  join page_rows on page_rows.product_id = page.product_id
  where page.product_id = any (array(select page_rows.product_id from page_rows))
  order by page_rows.row_number;
$$;

-- ── Catalog count / price bounds: base tables only ─────────────────────
create or replace function public.public_catalog_search_count(
  p_store_slug text,
  p_category_slug text default null,
  p_category_parent_id uuid default null,
  p_subcategory_slug text default null,
  p_collection_slug text default null,
  p_query text default null,
  p_only_featured boolean default false,
  p_only_on_sale boolean default false
)
returns bigint
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select count(*)
  from public.products product
  join public.stores store on store.id = product.store_id
  left join public.store_product_categories category on category.id = product.category_id
  where store.slug = p_store_slug
    and store.status = 'active'
    and product.status = 'active'
    and (
      nullif(coalesce(p_subcategory_slug, ''), '') is null
      or category.slug = p_subcategory_slug
    )
    and (
      nullif(coalesce(p_subcategory_slug, ''), '') is not null
      or nullif(coalesce(p_category_slug, ''), '') is null
      or category.slug = p_category_slug
      or (p_category_parent_id is not null and category.parent_id = p_category_parent_id)
    )
    and (
      nullif(coalesce(p_collection_slug, ''), '') is null
      or exists (
        select 1
        from public.product_collections assigned
        join public.store_product_collections collection
          on collection.id = assigned.collection_id
         and collection.is_active = true
        where assigned.product_id = product.id
          and collection.slug = p_collection_slug
      )
    )
    and (not p_only_featured or product.is_featured = true)
    and (not p_only_on_sale or (product.sale_price is not null and product.sale_price < product.regular_price))
    and (
      nullif(btrim(coalesce(p_query, '')), '') is null
      or product.id in (select m.product_id from public.public_catalog_query_matches(p_store_slug, p_query) m)
    );
$$;

create or replace function public.public_catalog_search_price_bounds(
  p_store_slug text,
  p_category_slug text default null,
  p_category_parent_id uuid default null,
  p_subcategory_slug text default null,
  p_collection_slug text default null,
  p_query text default null,
  p_only_featured boolean default false,
  p_only_on_sale boolean default false
)
returns table(min_price numeric, max_price numeric)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with filtered as (
    select
      coalesce(variant_prices.min_price, coalesce(product.sale_price, product.regular_price)) as min_price,
      coalesce(variant_prices.max_price, coalesce(product.sale_price, product.regular_price)) as max_price
    from public.products product
    join public.stores store on store.id = product.store_id
    left join public.store_product_categories category on category.id = product.category_id
    left join lateral (
      select
        min(coalesce(variant.price, coalesce(product.sale_price, product.regular_price))) as min_price,
        max(coalesce(variant.price, coalesce(product.sale_price, product.regular_price))) as max_price
      from public.product_variants variant
      where variant.product_id = product.id
        and variant.status = 'active'
    ) variant_prices on true
    where store.slug = p_store_slug
      and store.status = 'active'
      and product.status = 'active'
      and (
        nullif(coalesce(p_subcategory_slug, ''), '') is null
        or category.slug = p_subcategory_slug
      )
      and (
        nullif(coalesce(p_subcategory_slug, ''), '') is not null
        or nullif(coalesce(p_category_slug, ''), '') is null
        or category.slug = p_category_slug
        or (p_category_parent_id is not null and category.parent_id = p_category_parent_id)
      )
      and (
        nullif(coalesce(p_collection_slug, ''), '') is null
        or exists (
          select 1
          from public.product_collections assigned
          join public.store_product_collections collection
            on collection.id = assigned.collection_id
           and collection.is_active = true
          where assigned.product_id = product.id
            and collection.slug = p_collection_slug
        )
      )
      and (not p_only_featured or product.is_featured = true)
      and (not p_only_on_sale or (product.sale_price is not null and product.sale_price < product.regular_price))
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or product.id in (select m.product_id from public.public_catalog_query_matches(p_store_slug, p_query) m)
      )
  )
  select
    coalesce(min(filtered.min_price), 0) as min_price,
    coalesce(max(filtered.max_price), 0) as max_price
  from filtered;
$$;

grant execute on function public.public_catalog_query_matches(text, text) to anon, authenticated;
grant execute on function public.public_catalog_suggest(text, text, integer) to anon, authenticated;
grant execute on function public.public_catalog_search_page(text, text, uuid, text, text, text, boolean, boolean, text, integer, integer) to anon, authenticated;
grant execute on function public.public_catalog_search_count(text, text, uuid, text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.public_catalog_search_price_bounds(text, text, uuid, text, text, text, boolean, boolean) to anon, authenticated;
