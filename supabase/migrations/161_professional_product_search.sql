-- Professional storefront product search.
--
-- Before: one ILIKE '%query%' over name/description/category — accent
-- sensitive ("perfumeria" missed "Perfumería"), word order sensitive
-- ("light blue dolce" found nothing), no typo tolerance, no ranking.
--
-- Now one matcher, public_catalog_query_matches(), is shared by the
-- live suggestions dropdown (public_catalog_suggest) and the catalog
-- results page (search page/count/price bounds), so "Ver todos los
-- resultados" always lists exactly what the dropdown promised:
--   * accent/case/punctuation insensitive (catalog_search_normalize)
--   * every word must match, in any order, in name, brand/attributes,
--     category or description; simple plurals match the singular
--   * common Spanish filler words are ignored ("perfume de mujer")
--   * ranked: exact name > name prefix > phrase in name > all words in
--     name > words in brand/attributes/category > description only
--   * typo fallback (pg_trgm word_similarity) only when nothing matches
--     exactly, so "latafa" still finds Lattafa without polluting normal
--     results.

create extension if not exists pg_trgm with schema extensions;

create or replace function public.catalog_search_normalize(p_text text)
returns text
language sql
immutable
parallel safe
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(coalesce(p_text, '')),
          'áàäâãåéèëêíìïîóòöôõúùüûñçý',
          'aaaaaaeeeeiiiiooooouuuuncy'
        ),
        '[''’`´.]', '', 'g'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

-- True when a normalized token occurs in a normalized text. A plural
-- token also matches its singular ("perfumes" → "perfume",
-- "flores" → "flor").
create or replace function public.catalog_search_token_in(p_haystack text, p_token text)
returns boolean
language sql
immutable
parallel safe
as $$
  select strpos(p_haystack, p_token) > 0
    or (length(p_token) > 3 and right(p_token, 1) = 's' and strpos(p_haystack, left(p_token, -1)) > 0)
    or (length(p_token) > 4 and right(p_token, 2) = 'es' and strpos(p_haystack, left(p_token, -2)) > 0);
$$;

-- Normalized query words, minus filler words (unless the query is only
-- filler), at most 8.
create or replace function public.catalog_search_tokens(p_query text)
returns text[]
language sql
immutable
parallel safe
as $$
  with words as (
    select word, ordinality
    from unnest(string_to_array(public.catalog_search_normalize(p_query), ' ')) with ordinality as w(word, ordinality)
    where word <> ''
  ),
  meaningful as (
    select word, ordinality
    from words
    where word not in (
      'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'en', 'con', 'para', 'por',
      'un', 'una', 'unos', 'unas', 'al', 'a', 'the', 'of', 'and'
    )
  )
  select coalesce(
    (select array_agg(word order by ordinality) from (select * from meaningful order by ordinality limit 8) m),
    (select array_agg(word order by ordinality) from (select * from words order by ordinality limit 8) w),
    '{}'::text[]
  );
$$;

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
  docs as (
    select
      page.product_id,
      public.catalog_search_normalize(page.product_name) as name,
      public.catalog_search_normalize(concat_ws(
        ' ',
        page.category_name,
        (
          select string_agg(facet_value ->> 'value', ' ')
          from jsonb_array_elements(coalesce(page.facet_values::jsonb, '[]'::jsonb)) facet_value
        )
      )) as meta,
      public.catalog_search_normalize(concat_ws(' ', page.short_description, page.description)) as body
    from public.public_product_pages page
    where page.store_slug = p_store_slug
  ),
  scored as (
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
    where cardinality(params.tokens) > 0
  ),
  exact_matches as (
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

-- Live suggestions for the header search: the best products (with image
-- and prices), how many products match in total, and brand/attribute and
-- category shortcuts whose name matches the query.
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
  matches as materialized (
    select * from public.public_catalog_query_matches(p_store_slug, p_query)
  ),
  products as (
    select
      page.product_id,
      page.product_slug,
      page.product_name,
      page.main_image_url,
      page.category_name,
      page.regular_price,
      page.sale_price,
      page.has_variants,
      page.is_available,
      page.stock,
      page.track_inventory,
      page.is_featured,
      public.public_catalog_min_price(page.regular_price, page.sale_price, page.variants::jsonb) as min_price,
      public.public_catalog_max_price(page.regular_price, page.sale_price, page.variants::jsonb) as max_price,
      (
        select facet_value ->> 'value'
        from jsonb_array_elements(coalesce(page.facet_values::jsonb, '[]'::jsonb)) facet_value
        where facet_value ->> 'facet_slug' = 'marca'
        limit 1
      ) as brand,
      matches.score
    from matches
    join public.public_product_pages page
      on page.product_id = matches.product_id
     and page.store_slug = p_store_slug
    order by matches.score desc, page.is_featured desc, page.product_name asc
    limit least(greatest(coalesce(p_limit, 6), 1), 12)
  ),
  -- Candidates are filtered by name first (materialized) so the product
  -- counts below run only for the handful of matching values, never for
  -- every value of the store.
  facet_candidates as materialized (
    select
      facet.name as facet_name,
      facet.slug as facet_slug,
      facet_value.id as value_id,
      facet_value.value,
      facet_value.slug as value_slug,
      public.catalog_search_normalize(facet_value.value) = params.phrase as exact
    from public.public_store_facets facet
    join public.public_store_facet_values facet_value
      on facet_value.facet_id = facet.id
     and facet_value.store_slug = p_store_slug
    cross join params
    where facet.store_slug = p_store_slug
      and facet.show_in_catalog_filters
      and length(params.phrase) >= 2
      and (
        strpos(' ' || public.catalog_search_normalize(facet_value.value), ' ' || params.phrase) > 0
        or strpos(' ' || params.phrase || ' ', ' ' || public.catalog_search_normalize(facet_value.value) || ' ') > 0
      )
    limit 10
  ),
  facet_terms as materialized (
    select
      facet_candidates.*,
      (
        select count(*)
        from public.public_product_pages page
        where page.store_slug = p_store_slug
          and exists (
            select 1
            from jsonb_array_elements(coalesce(page.facet_values::jsonb, '[]'::jsonb)) assigned
            where assigned ->> 'value_id' = facet_candidates.value_id::text
          )
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
    from public.public_store_categories category
    left join public.public_store_categories parent on parent.id = category.parent_id
    cross join params
    where category.store_slug = p_store_slug
      and length(params.phrase) >= 2
      and (
        strpos(' ' || public.catalog_search_normalize(category.name), ' ' || params.phrase) > 0
        or strpos(' ' || params.phrase || ' ', ' ' || public.catalog_search_normalize(category.name) || ' ') > 0
      )
    limit 10
  ),
  category_terms as materialized (
    select
      category_candidates.*,
      (
        select count(*)
        from public.public_product_pages page
        where page.store_slug = p_store_slug
          and (page.category_id = category_candidates.id or page.category_parent_id = category_candidates.id)
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

-- ── Catalog results page: same matcher + relevance order ──────────────
-- Identical to 158 except the query clause (now the shared matcher) and,
-- for the default sort with a query, results ranked by relevance first.
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
  ),
  query_matches as (
    select * from public.public_catalog_query_matches(p_store_slug, p_query)
    where nullif(btrim(coalesce(p_query, '')), '') is not null
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
      position.sort_order as editorial_sort_order,
      query_match.score as query_score
    from public.public_product_pages page
    join store_context store on true
    left join public.store_product_categories category on category.id = page.category_id
    left join collection_context selected_collection on true
    left join query_matches query_match on query_match.product_id = page.product_id
    left join public.store_catalog_product_positions position
      on position.store_id = store.id
     and position.product_id = page.product_id
     and (
       (selected_collection.id is not null and position.collection_id = selected_collection.id and position.category_id is null)
       or (
         selected_collection.id is null
         and nullif(coalesce(p_subcategory_slug, ''), '') is not null
         and position.category_id = page.category_id
         and position.collection_id is null
       )
       or (
         selected_collection.id is null
         and nullif(coalesce(p_subcategory_slug, ''), '') is null
         and nullif(coalesce(p_category_slug, ''), '') is not null
         and position.category_id = coalesce(p_category_parent_id, page.category_id)
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
        or query_match.product_id is not null
      )
  )
  select (filtered.product_page).*
  from filtered
  order by
    case when p_sort_key = 'relevance' then filtered.query_score end desc nulls last,
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
    ((filtered.product_page).product_id) asc
  offset greatest(p_offset, 0)
  limit greatest(p_limit, 1);
$$;

-- Identical to 078 except the query clause.
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
as $$
  select count(*)
  from public.public_product_pages p
  where p.store_slug = p_store_slug
    and (
      nullif(coalesce(p_subcategory_slug, ''), '') is null
      or p.category_slug = p_subcategory_slug
    )
    and (
      nullif(coalesce(p_subcategory_slug, ''), '') is not null
      or nullif(coalesce(p_category_slug, ''), '') is null
      or p.category_slug = p_category_slug
      or (p_category_parent_id is not null and p.category_parent_id = p_category_parent_id)
    )
    and (
      nullif(coalesce(p_collection_slug, ''), '') is null
      or exists (
        select 1
        from jsonb_array_elements(coalesce(p.collections::jsonb, '[]'::jsonb)) as collection_item
        where collection_item ->> 'slug' = p_collection_slug
      )
    )
    and (
      not p_only_featured
      or p.is_featured = true
    )
    and (
      not p_only_on_sale
      or (p.sale_price is not null and p.sale_price < p.regular_price)
    )
    and (
      nullif(btrim(coalesce(p_query, '')), '') is null
      or p.product_id in (select m.product_id from public.public_catalog_query_matches(p_store_slug, p_query) m)
    );
$$;

-- Identical to 078 except the query clause.
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
as $$
  with filtered as (
    select p.*
    from public.public_product_pages p
    where p.store_slug = p_store_slug
      and (
        nullif(coalesce(p_subcategory_slug, ''), '') is null
        or p.category_slug = p_subcategory_slug
      )
      and (
        nullif(coalesce(p_subcategory_slug, ''), '') is not null
        or nullif(coalesce(p_category_slug, ''), '') is null
        or p.category_slug = p_category_slug
        or (p_category_parent_id is not null and p.category_parent_id = p_category_parent_id)
      )
      and (
        nullif(coalesce(p_collection_slug, ''), '') is null
        or exists (
          select 1
          from jsonb_array_elements(coalesce(p.collections::jsonb, '[]'::jsonb)) as collection_item
          where collection_item ->> 'slug' = p_collection_slug
        )
      )
      and (
        not p_only_featured
        or p.is_featured = true
      )
      and (
        not p_only_on_sale
        or (p.sale_price is not null and p.sale_price < p.regular_price)
      )
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or p.product_id in (select m.product_id from public.public_catalog_query_matches(p_store_slug, p_query) m)
      )
  )
  select
    coalesce(min(public.public_catalog_min_price(filtered.regular_price, filtered.sale_price, filtered.variants::jsonb)), 0) as min_price,
    coalesce(max(public.public_catalog_max_price(filtered.regular_price, filtered.sale_price, filtered.variants::jsonb)), 0) as max_price
  from filtered;
$$;

grant execute on function public.catalog_search_normalize(text) to anon, authenticated;
grant execute on function public.catalog_search_token_in(text, text) to anon, authenticated;
grant execute on function public.catalog_search_tokens(text) to anon, authenticated;
grant execute on function public.public_catalog_query_matches(text, text) to anon, authenticated;
grant execute on function public.public_catalog_suggest(text, text, integer) to anon, authenticated;
grant execute on function public.public_catalog_search_page(text, text, uuid, text, text, text, boolean, boolean, text, integer, integer) to anon, authenticated;
grant execute on function public.public_catalog_search_count(text, text, uuid, text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.public_catalog_search_price_bounds(text, text, uuid, text, text, text, boolean, boolean) to anon, authenticated;
