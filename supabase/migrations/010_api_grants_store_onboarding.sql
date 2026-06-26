-- ============================================================
-- Melosoft Commerce — API Grants: Store Onboarding Tables
-- Migration: 010
-- Depends on: 006, 007, 008, 009
-- ============================================================
-- Extends the grants from 006 to cover new tables and views.
-- ============================================================

-- New tables from 008
grant select, insert, update, delete on public.store_locations        to authenticated;
grant select, insert, update, delete on public.store_business_hours   to authenticated;

-- Anon access for public hour data
grant select on public.store_locations      to anon;
grant select on public.store_business_hours to anon;

-- Refresh public view grants
grant select on public.public_store_pages   to anon, authenticated;
grant select on public.public_product_pages to anon, authenticated;
grant select on public.public_offer_pages   to anon, authenticated;
