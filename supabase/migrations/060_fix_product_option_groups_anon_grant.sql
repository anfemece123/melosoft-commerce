-- ============================================================
-- Migration 060 — product_option_groups/items were never granted
-- to anon
--
-- Found while validating the restaurant variants+modifiers flow.
-- Migration 021 created a "Public can view active product option
-- groups/items" RLS policy for both tables, but only ever GRANTed
-- SELECT to `authenticated` — never to `anon`. Since PostgREST
-- checks the GRANT before RLS, every anonymous storefront visitor
-- got a flat "permission denied" from these tables. Worse,
-- ProductLandingPage's getPublicProductOptionGroups() call isn't
-- wrapped in its own try/catch — the error bubbles up to the
-- page's outer catch, replacing the whole product page with the
-- generic error screen for ANY menu item that has option groups
-- configured. This has been silently broken since 021; unrelated
-- to variants, but directly needed to validate the restaurant
-- flow now that variants+modifiers can coexist on one product.
-- ============================================================

GRANT SELECT ON public.product_option_groups TO anon;
GRANT SELECT ON public.product_option_items TO anon;
