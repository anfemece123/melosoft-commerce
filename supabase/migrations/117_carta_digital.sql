-- ============================================================
-- Migration 117 — Carta digital
--
-- Visual, checkout-free menu per store (QR-first, e.g. for a
-- restaurant table) that reuses the existing product/category
-- catalog instead of duplicating it:
--   - store_carta_settings: 1:1 per-store toggle (enabled) and
--     discoverability flag (listed_in_storefront) — the QR/direct
--     link always works regardless of listed_in_storefront, that
--     flag only controls whether the online store links to it.
--   - products gains carta_price (falls back to regular_price when
--     null) and two independent per-channel visibility flags,
--     because a dish can exist only at the table, only online, or
--     both.
--   - public_carta_pages: new public view, read-only, scoped to
--     enabled=true stores and show_in_carta=true products.
--   - public_store_pages is extended (not replaced) with
--     carta_enabled/carta_listed so the storefront can decide to
--     show a "Ver la carta" entry point without an extra request.
-- ============================================================

-- ── store_carta_settings ─────────────────────────────────────

CREATE TABLE public.store_carta_settings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled              boolean     NOT NULL DEFAULT false,
  listed_in_storefront boolean     NOT NULL DEFAULT false,
  title                text,
  subtitle             text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_carta_settings_store_unique UNIQUE (store_id)
);

COMMENT ON TABLE public.store_carta_settings IS
  'Per-store visual menu ("Carta digital") settings: on/off and whether it is linked from the online store.';

CREATE TRIGGER store_carta_settings_updated_at
  BEFORE UPDATE ON public.store_carta_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.store_carta_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_carta_select_platform_admin" ON public.store_carta_settings
  FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE POLICY "store_carta_insert_platform_admin" ON public.store_carta_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());

CREATE POLICY "store_carta_update_platform_admin" ON public.store_carta_settings
  FOR UPDATE TO authenticated USING (public.is_platform_admin());

CREATE POLICY "store_carta_delete_platform_admin" ON public.store_carta_settings
  FOR DELETE TO authenticated USING (public.is_platform_admin());

-- Members can read; owner/admin can write. No public SELECT policy —
-- public consumption goes through public_carta_pages below, never
-- through this table directly.
CREATE POLICY "store_carta_select_member" ON public.store_carta_settings
  FOR SELECT TO authenticated
  USING (public.is_store_member(store_id));

CREATE POLICY "store_carta_insert_owner_admin" ON public.store_carta_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_store_role(store_id, array['owner', 'admin']));

CREATE POLICY "store_carta_update_owner_admin" ON public.store_carta_settings
  FOR UPDATE TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']));

-- ── products: per-channel price + visibility ─────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS carta_price numeric NULL,
  ADD COLUMN IF NOT EXISTS show_in_carta boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_ecommerce boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.carta_price IS
  'Optional price shown in the visual "Carta digital" menu. NULL falls back to regular_price.';

-- ── public_carta_pages ────────────────────────────────────────

CREATE VIEW public.public_carta_pages
  WITH (security_invoker = false)
AS
SELECT
  s.slug                                     AS store_slug,
  s.name                                     AS store_name,
  s.logo_url,
  s.currency,
  cs.title,
  cs.subtitle,
  t.mode                                     AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  pr.id                                      AS product_id,
  pr.name                                    AS product_name,
  pr.short_description,
  pr.main_image_url,
  COALESCE(pr.carta_price, pr.regular_price) AS effective_price,
  pr.sort_order                              AS product_sort_order,
  cat.id                                     AS category_id,
  cat.name                                   AS category_name,
  cat.slug                                   AS category_slug,
  cat.sort_order                             AS category_sort_order
FROM public.store_carta_settings cs
JOIN public.stores s
  ON s.id = cs.store_id
LEFT JOIN public.store_theme_settings t
  ON t.store_id = s.id
JOIN public.products pr
  ON pr.store_id = s.id
  AND pr.show_in_carta = true
  AND pr.status = 'active'
LEFT JOIN public.store_product_categories cat
  ON cat.id = pr.category_id
WHERE s.status = 'active'
  AND cs.enabled = true;

COMMENT ON VIEW public.public_carta_pages IS
  'Public, read-only rows for the "Carta digital" visual menu. Only stores with store_carta_settings.enabled=true and products with show_in_carta=true appear here.';

GRANT SELECT ON public.public_carta_pages TO anon, authenticated;

-- ── public_store_pages: expose carta_enabled/carta_listed ─────
-- Recreated in full (copied from migration 116_whatsapp_button_layout,
-- the latest version at the time this migration was written) so no
-- existing column is lost, plus the two new carta_* columns appended
-- at the end to preserve the column order expected by dependent views
-- and existing PostgREST consumers.

CREATE OR REPLACE VIEW public.public_store_pages
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
  t.mode                            AS theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  t.header_settings,
  COALESCE(t.whatsapp_button_enabled, true) AS whatsapp_button_enabled,
  t.whatsapp_button_color,
  p.shipping_policy,
  p.returns_policy,
  p.warranty_policy,
  p.privacy_policy,
  p.terms_and_conditions,
  CASE WHEN l.is_public THEN l.address_line   ELSE NULL END AS location_address,
  CASE WHEN l.is_public THEN l.neighborhood   ELSE NULL END AS location_neighborhood,
  CASE WHEN l.is_public THEN l.city           ELSE NULL END AS location_city,
  CASE WHEN l.is_public THEN l.department     ELSE NULL END AS location_department,
  CASE WHEN l.is_public THEN l.country        ELSE NULL END AS location_country,
  CASE WHEN l.is_public THEN l.latitude       ELSE NULL END AS location_latitude,
  CASE WHEN l.is_public THEN l.longitude      ELSE NULL END AS location_longitude,
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
  c.shipping_notes,
  c.local_delivery_base_fee,
  c.local_delivery_free_from,
  c.national_shipping_base_fee,
  c.national_shipping_free_from,
  public.store_requires_whatsapp_order_consent(s.id) AS whatsapp_order_updates_required,
  COALESCE(t.whatsapp_button_layout, 'floating') AS whatsapp_button_layout,
  COALESCE(cs.enabled, false)              AS carta_enabled,
  COALESCE(cs.listed_in_storefront, false) AS carta_listed
FROM public.stores s
LEFT JOIN public.store_theme_settings t ON t.store_id = s.id
LEFT JOIN public.store_policies p ON p.store_id = s.id
LEFT JOIN LATERAL (
  SELECT *
  FROM public.store_locations
  WHERE store_id = s.id AND is_primary = true AND is_active = true
  LIMIT 1
) l ON true
LEFT JOIN public.store_commerce_settings c ON c.store_id = s.id
LEFT JOIN public.store_carta_settings cs ON cs.store_id = s.id
WHERE s.status = 'active';

GRANT SELECT ON public.public_store_pages TO anon, authenticated;
