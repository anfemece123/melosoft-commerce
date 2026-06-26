-- ============================================================
-- Melosoft Commerce — API Grants
-- Migration: 006
-- ============================================================
-- These GRANTs allow the Supabase Data API to access tables.
-- Row Level Security still controls which rows each user can access.
-- ============================================================

grant usage on schema public to anon, authenticated;

-- Public views for ecommerce pages
grant select on public.public_store_pages to anon, authenticated;
grant select on public.public_product_pages to anon, authenticated;
grant select on public.public_offer_pages to anon, authenticated;

-- Authenticated app access.
-- RLS policies still decide which rows are visible or editable.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.stores to authenticated;
grant select, insert, update, delete on public.store_members to authenticated;
grant select, insert, update, delete on public.store_limits to authenticated;
grant select, insert, update, delete on public.store_theme_settings to authenticated;
grant select, insert, update, delete on public.store_policies to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_images to authenticated;
grant select, insert, update, delete on public.offers to authenticated;
grant select, insert, update, delete on public.offer_images to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select, insert, update, delete on public.store_payment_settings to authenticated;
grant select, insert, update, delete on public.payment_transactions to authenticated;

-- Payment providers:
-- Users can read active providers; only platform_admin should modify through RLS.
grant select on public.payment_providers to authenticated;
grant insert, update, delete on public.payment_providers to authenticated;