-- ============================================================
-- Migration 143 — harden public storefront read access
--
-- The storefront reads through the public_* views.  A few older versions
-- of those views were created with security_invoker=true.  In that mode
-- PostgREST evaluates the underlying tables as anon and a request can fail
-- with 42501 (for example, "permission denied for table stores").
--
-- Keep the boundary at the view: public visitors get SELECT only on views
-- whose name explicitly starts with public_, while private base tables keep
-- their existing RLS and privileges.  This is deliberately not a direct
-- GRANT on stores/products or any other private table.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

DO $$
DECLARE
  public_view record;
BEGIN
  FOR public_view IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND substr(c.relname, 1, 7) = 'public_'
  LOOP
    -- Run the view as its owner so anon never needs direct access to the
    -- tables behind it.  All current public_* views intentionally project
    -- only storefront-safe fields.
    EXECUTE format(
      'ALTER VIEW public.%I SET (security_invoker = false)',
      public_view.relname
    );

    EXECUTE format(
      'GRANT SELECT ON public.%I TO anon, authenticated',
      public_view.relname
    );
  END LOOP;
END
$$;
