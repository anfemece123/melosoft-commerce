-- ============================================================
-- Migration 078 — paginated public catalog search functions
--
-- Purpose:
-- Move the catalog's base filtering/sorting/pagination work to SQL so the
-- public storefront no longer has to download the full product set before
-- rendering results. Facet/combination pruning remains client-side for
-- now, but category/collection/search/sale/featured/sort/page are handled
-- server-side through stable RPC functions.
-- ============================================================

CREATE OR REPLACE FUNCTION public.public_catalog_active_price(
  p_regular_price numeric,
  p_sale_price numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_sale_price, p_regular_price);
$$;

CREATE OR REPLACE FUNCTION public.public_catalog_min_price(
  p_regular_price numeric,
  p_sale_price numeric,
  p_variants jsonb
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT MIN(COALESCE(NULLIF(v ->> 'price', '')::numeric, public.public_catalog_active_price(p_regular_price, p_sale_price)))
      FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb)) AS v
    ),
    public.public_catalog_active_price(p_regular_price, p_sale_price)
  );
$$;

CREATE OR REPLACE FUNCTION public.public_catalog_max_price(
  p_regular_price numeric,
  p_sale_price numeric,
  p_variants jsonb
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT MAX(COALESCE(NULLIF(v ->> 'price', '')::numeric, public.public_catalog_active_price(p_regular_price, p_sale_price)))
      FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb)) AS v
    ),
    public.public_catalog_active_price(p_regular_price, p_sale_price)
  );
$$;

CREATE OR REPLACE FUNCTION public.public_catalog_search_page(
  p_store_slug text,
  p_category_slug text DEFAULT NULL,
  p_category_parent_id uuid DEFAULT NULL,
  p_subcategory_slug text DEFAULT NULL,
  p_collection_slug text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_only_featured boolean DEFAULT false,
  p_only_on_sale boolean DEFAULT false,
  p_sort_key text DEFAULT 'relevance',
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 24
)
RETURNS SETOF public.public_product_pages
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT p.*
    FROM public.public_product_pages p
    WHERE p.store_slug = p_store_slug
      AND (
        NULLIF(COALESCE(p_subcategory_slug, ''), '') IS NULL
        OR p.category_slug = p_subcategory_slug
      )
      AND (
        NULLIF(COALESCE(p_subcategory_slug, ''), '') IS NOT NULL
        OR NULLIF(COALESCE(p_category_slug, ''), '') IS NULL
        OR p.category_slug = p_category_slug
        OR (p_category_parent_id IS NOT NULL AND p.category_parent_id = p_category_parent_id)
      )
      AND (
        NULLIF(COALESCE(p_collection_slug, ''), '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(p.collections::jsonb, '[]'::jsonb)) AS collection_item
          WHERE collection_item ->> 'slug' = p_collection_slug
        )
      )
      AND (
        NOT p_only_featured
        OR p.is_featured = true
      )
      AND (
        NOT p_only_on_sale
        OR (p.sale_price IS NOT NULL AND p.sale_price < p.regular_price)
      )
      AND (
        NULLIF(BTRIM(COALESCE(p_query, '')), '') IS NULL
        OR p.product_name ILIKE '%' || BTRIM(p_query) || '%'
        OR p.description ILIKE '%' || BTRIM(p_query) || '%'
        OR COALESCE(p.category_name, '') ILIKE '%' || BTRIM(p_query) || '%'
      )
  )
  SELECT filtered.*
  FROM filtered
  ORDER BY
    CASE WHEN p_sort_key = 'featured' THEN CASE WHEN filtered.is_featured THEN 0 ELSE 1 END END ASC NULLS LAST,
    CASE WHEN p_sort_key = 'newest' THEN filtered.product_created_at END DESC NULLS LAST,
    CASE WHEN p_sort_key = 'name_asc' THEN filtered.product_name END ASC NULLS LAST,
    CASE WHEN p_sort_key = 'price_asc'
      THEN public.public_catalog_min_price(filtered.regular_price, filtered.sale_price, filtered.variants::jsonb)
    END ASC NULLS LAST,
    CASE WHEN p_sort_key = 'price_desc'
      THEN public.public_catalog_max_price(filtered.regular_price, filtered.sale_price, filtered.variants::jsonb)
    END DESC NULLS LAST,
    CASE WHEN p_sort_key = 'relevance' THEN CASE WHEN filtered.is_featured THEN 0 ELSE 1 END END ASC NULLS LAST,
    CASE WHEN p_sort_key = 'relevance' THEN filtered.product_created_at END DESC NULLS LAST,
    filtered.product_name ASC
  OFFSET GREATEST(p_offset, 0)
  LIMIT GREATEST(p_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.public_catalog_search_count(
  p_store_slug text,
  p_category_slug text DEFAULT NULL,
  p_category_parent_id uuid DEFAULT NULL,
  p_subcategory_slug text DEFAULT NULL,
  p_collection_slug text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_only_featured boolean DEFAULT false,
  p_only_on_sale boolean DEFAULT false
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
  FROM public.public_product_pages p
  WHERE p.store_slug = p_store_slug
    AND (
      NULLIF(COALESCE(p_subcategory_slug, ''), '') IS NULL
      OR p.category_slug = p_subcategory_slug
    )
    AND (
      NULLIF(COALESCE(p_subcategory_slug, ''), '') IS NOT NULL
      OR NULLIF(COALESCE(p_category_slug, ''), '') IS NULL
      OR p.category_slug = p_category_slug
      OR (p_category_parent_id IS NOT NULL AND p.category_parent_id = p_category_parent_id)
    )
    AND (
      NULLIF(COALESCE(p_collection_slug, ''), '') IS NULL
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(p.collections::jsonb, '[]'::jsonb)) AS collection_item
        WHERE collection_item ->> 'slug' = p_collection_slug
      )
    )
    AND (
      NOT p_only_featured
      OR p.is_featured = true
    )
    AND (
      NOT p_only_on_sale
      OR (p.sale_price IS NOT NULL AND p.sale_price < p.regular_price)
    )
    AND (
      NULLIF(BTRIM(COALESCE(p_query, '')), '') IS NULL
      OR p.product_name ILIKE '%' || BTRIM(p_query) || '%'
      OR p.description ILIKE '%' || BTRIM(p_query) || '%'
      OR COALESCE(p.category_name, '') ILIKE '%' || BTRIM(p_query) || '%'
    );
$$;

CREATE OR REPLACE FUNCTION public.public_catalog_search_price_bounds(
  p_store_slug text,
  p_category_slug text DEFAULT NULL,
  p_category_parent_id uuid DEFAULT NULL,
  p_subcategory_slug text DEFAULT NULL,
  p_collection_slug text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_only_featured boolean DEFAULT false,
  p_only_on_sale boolean DEFAULT false
)
RETURNS TABLE(min_price numeric, max_price numeric)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT p.*
    FROM public.public_product_pages p
    WHERE p.store_slug = p_store_slug
      AND (
        NULLIF(COALESCE(p_subcategory_slug, ''), '') IS NULL
        OR p.category_slug = p_subcategory_slug
      )
      AND (
        NULLIF(COALESCE(p_subcategory_slug, ''), '') IS NOT NULL
        OR NULLIF(COALESCE(p_category_slug, ''), '') IS NULL
        OR p.category_slug = p_category_slug
        OR (p_category_parent_id IS NOT NULL AND p.category_parent_id = p_category_parent_id)
      )
      AND (
        NULLIF(COALESCE(p_collection_slug, ''), '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(p.collections::jsonb, '[]'::jsonb)) AS collection_item
          WHERE collection_item ->> 'slug' = p_collection_slug
        )
      )
      AND (
        NOT p_only_featured
        OR p.is_featured = true
      )
      AND (
        NOT p_only_on_sale
        OR (p.sale_price IS NOT NULL AND p.sale_price < p.regular_price)
      )
      AND (
        NULLIF(BTRIM(COALESCE(p_query, '')), '') IS NULL
        OR p.product_name ILIKE '%' || BTRIM(p_query) || '%'
        OR p.description ILIKE '%' || BTRIM(p_query) || '%'
        OR COALESCE(p.category_name, '') ILIKE '%' || BTRIM(p_query) || '%'
      )
  )
  SELECT
    COALESCE(MIN(public.public_catalog_min_price(filtered.regular_price, filtered.sale_price, filtered.variants::jsonb)), 0) AS min_price,
    COALESCE(MAX(public.public_catalog_max_price(filtered.regular_price, filtered.sale_price, filtered.variants::jsonb)), 0) AS max_price
  FROM filtered;
$$;

GRANT EXECUTE ON FUNCTION public.public_catalog_active_price(numeric, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_catalog_min_price(numeric, numeric, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_catalog_max_price(numeric, numeric, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_catalog_search_page(text, text, uuid, text, text, text, boolean, boolean, text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_catalog_search_count(text, text, uuid, text, text, text, boolean, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_catalog_search_price_bounds(text, text, uuid, text, text, text, boolean, boolean) TO anon, authenticated;
