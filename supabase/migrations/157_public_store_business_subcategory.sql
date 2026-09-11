-- 157 — Expone business_subcategory en public_store_pages.
-- Necesario para que el storefront público pueda activar features
-- exclusivas de un giro de negocio específico (p. ej. la pirámide
-- olfativa, solo para tiendas con subcategoría 'lociones_perfumes')
-- sin depender de una tabla admin-only.
--
-- business_subcategory se agrega al final del SELECT (no junto a
-- business_type): CREATE OR REPLACE VIEW solo permite añadir columnas al
-- final — insertarla en medio corre de posición a las columnas
-- siguientes y Postgres lo interpreta como un rename, no un add.

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
  (
    COALESCE(sl.can_use_carta, false)
    AND COALESCE(cs.enabled, false)
  ) AS carta_enabled,
  (
    COALESCE(sl.can_use_carta, false)
    AND COALESCE(cs.enabled, false)
    AND COALESCE(cs.listed_in_storefront, false)
  ) AS carta_listed,
  COALESCE(sl.can_use_partner_codes, false) AS partner_codes_enabled,
  (
    COALESCE(sl.can_use_customer_book, false)
    AND COALESCE(sl.can_use_customer_capture, false)
    AND COALESCE(customer_settings.capture_enabled, false)
    AND (
      COALESCE(customer_settings.email_marketing_enabled, true)
      OR COALESCE(customer_settings.whatsapp_marketing_enabled, false)
    )
    AND NULLIF(btrim(p.privacy_policy), '') IS NOT NULL
  ) AS customer_capture_enabled,
  customer_settings.capture_title AS customer_capture_title,
  customer_settings.capture_description AS customer_capture_description,
  customer_settings.incentive_text AS customer_capture_incentive_text,
  customer_settings.success_message AS customer_capture_success_message,
  customer_settings.collect_phone AS customer_capture_collect_phone,
  customer_settings.email_marketing_enabled AS customer_email_marketing_enabled,
  customer_settings.whatsapp_marketing_enabled AS customer_whatsapp_marketing_enabled,
  s.business_subcategory
FROM public.stores s
LEFT JOIN public.store_theme_settings t ON t.store_id = s.id
LEFT JOIN public.store_policies p ON p.store_id = s.id
LEFT JOIN LATERAL (
  SELECT * FROM public.store_locations
  WHERE store_id = s.id AND is_primary = true AND is_active = true
  LIMIT 1
) l ON true
LEFT JOIN public.store_commerce_settings c ON c.store_id = s.id
LEFT JOIN public.store_carta_settings cs ON cs.store_id = s.id
LEFT JOIN public.store_limits sl ON sl.store_id = s.id
LEFT JOIN public.store_customer_settings customer_settings ON customer_settings.store_id = s.id
WHERE s.status = 'active';

GRANT SELECT ON public.public_store_pages TO anon, authenticated;
