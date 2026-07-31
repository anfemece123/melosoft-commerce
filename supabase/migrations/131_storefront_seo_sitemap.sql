-- ============================================================
-- Migration 131 — public SEO sitemap feed
--
-- One read-only, SECURITY DEFINER RPC exposes only URLs that are already
-- public in the storefront. It is consumed by Vercel's dynamic sitemap.
-- No owner/customer data, private product, draft offer, or inactive store
-- is returned. New active stores therefore enter sitemap.xml automatically
-- in the same transaction in which they are created.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_sitemap_entries(p_store_slug text DEFAULT NULL)
RETURNS TABLE (
  page_type text,
  store_slug text,
  page_slug text,
  canonical_hostname text,
  last_modified timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_stores AS (
    SELECT
      s.id,
      s.slug,
      s.updated_at,
      domain.hostname AS canonical_hostname
    FROM public.stores s
    LEFT JOIN LATERAL (
      SELECT d.hostname
      FROM public.store_domains d
      WHERE d.store_id = s.id
        AND d.status = 'active'
        AND d.is_primary = true
      ORDER BY d.activated_at DESC NULLS LAST, d.updated_at DESC
      LIMIT 1
    ) domain ON true
    WHERE s.status = 'active'
      AND (p_store_slug IS NULL OR s.slug = lower(trim(p_store_slug)))
  )
  SELECT 'store', s.slug, NULL::text, s.canonical_hostname, s.updated_at
  FROM active_stores s

  UNION ALL

  SELECT 'catalog', s.slug, NULL::text, s.canonical_hostname,
         GREATEST(s.updated_at, MAX(p.updated_at))
  FROM active_stores s
  JOIN public.products p
    ON p.store_id = s.id
   AND p.status = 'active'
   AND p.show_in_ecommerce = true
  GROUP BY s.id, s.slug, s.canonical_hostname, s.updated_at

  UNION ALL

  SELECT 'product', s.slug, p.slug, s.canonical_hostname, p.updated_at
  FROM active_stores s
  JOIN public.products p
    ON p.store_id = s.id
   AND p.status = 'active'
   AND p.show_in_ecommerce = true

  UNION ALL

  SELECT 'offer', s.slug, o.slug, s.canonical_hostname, o.updated_at
  FROM active_stores s
  JOIN public.offers o
    ON o.store_id = s.id
   AND o.status = 'active'
   AND o.is_visible_in_store = true
   AND (o.ends_at IS NULL OR o.ends_at > now())

  UNION ALL

  SELECT 'carta', s.slug, NULL::text, s.canonical_hostname,
         GREATEST(s.updated_at, cs.updated_at, MAX(p.updated_at))
  FROM active_stores s
  JOIN public.store_carta_settings cs
    ON cs.store_id = s.id
   AND cs.enabled = true
  JOIN public.products p
    ON p.store_id = s.id
   AND p.status = 'active'
   AND p.show_in_carta = true
  GROUP BY s.id, s.slug, s.canonical_hostname, s.updated_at, cs.updated_at

  ORDER BY 2, 1, 3 NULLS FIRST;
$$;

REVOKE ALL ON FUNCTION public.get_public_sitemap_entries(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_sitemap_entries(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_sitemap_entries(text) IS
  'Read-only SEO feed of active public storefront, catalog, product, offer and carta URLs with canonical host and last modification time.';
