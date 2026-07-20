-- ============================================================
-- Migration 089 — Lock down EXECUTE on cancel_store_order
--
-- PostgreSQL grants EXECUTE to PUBLIC by default on newly created
-- functions (unlike tables, which have no default PUBLIC grants).
-- Migration 088 only added `GRANT EXECUTE ... TO authenticated` for
-- cancel_store_order(uuid) without an explicit REVOKE FROM PUBLIC first,
-- so anon (and any other role) could technically invoke it too.
--
-- This was never an active vulnerability: cancel_store_order checks
-- has_store_role(...)/is_platform_admin() internally, both of which key
-- off auth.uid() — for an anonymous caller that's always NULL, so both
-- checks return false and the call is rejected with
-- INSUFFICIENT_PERMISSIONS regardless of the grant. But relying on an
-- internal check alone, when the grant itself could be tightened for
-- free, is unnecessary exposure — this migration removes it.
--
-- No logic change: the function body from 088 is untouched. This only
-- adjusts who is allowed to call it at the grant level.
-- ============================================================

REVOKE ALL ON FUNCTION public.cancel_store_order(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cancel_store_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_store_order(uuid) TO service_role;
