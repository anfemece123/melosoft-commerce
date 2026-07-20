-- ============================================================
-- Migration 093 — grant service_role access to 8 tables it was
-- silently missing privileges on.
--
-- Found while verifying 091/092 end-to-end: create-wompi-payment and
-- wompi-webhook use a service_role PostgREST client (not a
-- SECURITY DEFINER function) to read/write these tables directly.
-- service_role had zero SELECT/INSERT/UPDATE on all 8 (confirmed via
-- has_table_privilege), so every real Wompi checkout for a store with
-- variant or modifier products has been failing in production — not
-- something introduced by 091/092, and not scoped to test data.
--
-- Grants are scoped exactly to what each Edge Function actually does
-- (confirmed by grepping supabase/functions/create-wompi-payment and
-- supabase/functions/wompi-webhook for every reference to each table):
--   - product_option_groups, product_option_items, product_variants,
--     product_variant_options, product_variant_option_values,
--     product_variant_selected_values: SELECT only (create-wompi-payment
--     reads these to validate/price items; never writes them).
--   - order_item_customizations: INSERT only (wompi-webhook inserts the
--     already-validated modifier snapshot; never reads or updates it).
--   - inventory_movements: SELECT + UPDATE (wompi-webhook reads unlinked
--     checkout_reserved movements and updates order_id/order_item_id to
--     link them; it never inserts here directly — inserts happen inside
--     the SECURITY DEFINER functions from migration 091, which run as
--     their owner, not service_role).
-- No DELETE anywhere — neither function ever deletes from any of these
-- tables.
--
-- Does not touch anon/authenticated grants, RLS, or policies — this is
-- purely the service_role table-privilege gap.
-- ============================================================

GRANT SELECT ON public.product_option_groups TO service_role;
GRANT SELECT ON public.product_option_items TO service_role;
GRANT SELECT ON public.product_variants TO service_role;
GRANT SELECT ON public.product_variant_options TO service_role;
GRANT SELECT ON public.product_variant_option_values TO service_role;
GRANT SELECT ON public.product_variant_selected_values TO service_role;

GRANT INSERT ON public.order_item_customizations TO service_role;

GRANT SELECT, UPDATE ON public.inventory_movements TO service_role;
