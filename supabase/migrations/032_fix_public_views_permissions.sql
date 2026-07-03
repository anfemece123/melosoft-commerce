-- ============================================================
-- Migration 032 — Fix public_store_pages permissions
--
-- ROOT CAUSE:
--   Migration 026 created public_store_pages with:
--     WITH (security_invoker = true)
--   This makes the view run with the CALLER's privileges.
--   When anon queries it, Postgres tries to SELECT from stores
--   as anon, which has no direct SELECT on that table → 42501.
--
-- FIX:
--   Recreate public_store_pages WITHOUT security_invoker = true.
--   With security_invoker = false (the default), the view runs
--   with the VIEW OWNER's privileges (postgres in Supabase), who
--   has SELECT on all tables. anon only needs GRANT on the view
--   itself — never on the underlying tables.
--
-- The view body is identical to migration 026.
-- No secrets, no private keys, no payment credentials are exposed.
-- ============================================================

-- ── public_store_pages ───────────────────────────────────────

DROP VIEW IF EXISTS public.public_store_pages;

CREATE VIEW public.public_store_pages
  WITH (security_invoker = false)
AS
SELECT
  s.id                              AS store_id,
  s.slug                            AS store_slug,
  s.name                            AS store_name,
  s.slogan,
  s.business_type,
  s.description,
  s.logo_url,
  s.favicon_url,
  s.hero_enabled,
  s.hero_title,
  s.hero_subtitle,
  s.hero_cta_label,
  s.hero_image_url,
  s.hero_background_image_url,
  s.whatsapp_number,
  s.support_email,
  s.country,
  s.city,
  s.currency,
  -- Theme (never exposes private keys or secrets)
  t.mode                            AS theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  -- Policies
  p.shipping_policy,
  p.returns_policy,
  p.warranty_policy,
  p.privacy_policy,
  p.terms_and_conditions,
  -- Primary location (only if marked public)
  CASE WHEN l.is_public THEN l.address_line   ELSE NULL END  AS location_address,
  CASE WHEN l.is_public THEN l.neighborhood   ELSE NULL END  AS location_neighborhood,
  CASE WHEN l.is_public THEN l.city           ELSE NULL END  AS location_city,
  CASE WHEN l.is_public THEN l.department     ELSE NULL END  AS location_department,
  CASE WHEN l.is_public THEN l.country        ELSE NULL END  AS location_country,
  CASE WHEN l.is_public THEN l.latitude       ELSE NULL END  AS location_latitude,
  CASE WHEN l.is_public THEN l.longitude      ELSE NULL END  AS location_longitude,
  -- Commerce settings (no payment secrets)
  c.catalog_type,
  c.business_category,
  c.commerce_mode,
  c.delivery_mode,
  c.allows_pickup,
  c.allows_local_delivery,
  c.allows_national_shipping,
  c.whatsapp_checkout_enabled,
  c.web_order_enabled,
  c.cash_on_delivery_enabled,
  c.online_checkout_enabled,
  c.default_order_method,
  c.local_delivery_notes,
  c.shipping_notes
FROM public.stores s
LEFT JOIN public.store_theme_settings    t ON t.store_id = s.id
LEFT JOIN public.store_policies          p ON p.store_id = s.id
LEFT JOIN LATERAL (
  SELECT *
  FROM public.store_locations
  WHERE store_id = s.id AND is_primary = true AND is_active = true
  LIMIT 1
) l ON true
LEFT JOIN public.store_commerce_settings c ON c.store_id = s.id
WHERE s.status = 'active';

-- DROP + CREATE removes previous GRANT — restore it.
GRANT SELECT ON public.public_store_pages TO anon, authenticated;

-- ── public_product_pages (defensive re-grant) ─────────────────
-- Migration 023 had security_invoker = true; migration 024 removed
-- it. Current state is security_invoker = false (owner-based). OK.
-- Re-GRANT as a safety net in case prior GRANT was lost.
GRANT SELECT ON public.public_product_pages TO anon, authenticated;

-- ── public_offer_pages (defensive re-grant) ───────────────────
GRANT SELECT ON public.public_offer_pages TO anon, authenticated;

-- ── public_store_campaign_offers (defensive re-grant) ─────────
GRANT SELECT ON public.public_store_campaign_offers TO anon, authenticated;

-- ── public_store_locations (defensive re-grant) ───────────────
-- Already security_invoker = false since migration 026.
GRANT SELECT ON public.public_store_locations TO anon, authenticated;
