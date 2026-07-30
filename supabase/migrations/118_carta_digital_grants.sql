-- ============================================================
-- Migration 118 — Fix missing grant on store_carta_settings
--
-- Migration 117 added RLS policies for store_carta_settings but never
-- granted the base table privilege to `authenticated`. In Postgres, RLS
-- policies only take effect on top of an existing GRANT — without it,
-- PostgREST gets "permission denied for table store_carta_settings"
-- (42501) before RLS is even evaluated. Every other store settings
-- table in this project (e.g. store_product_categories in migration
-- 020) already has this grant; this one was missed.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_carta_settings TO authenticated;
