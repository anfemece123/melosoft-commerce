-- 160 — Modo "Catálogo con consulta por WhatsApp" por empresa.
--
-- Para negocios sin precios fijos (p. ej. perfumerías que cotizan por
-- chat): la tienda pública muestra el catálogo sin precios, sin carrito y
-- sin checkout; cada producto lleva un botón que abre WhatsApp con un
-- mensaje prearmado para consultar precio y disponibilidad.
--
-- Es una decisión comercial del Super Admin, por eso vive en store_limits
-- (RLS: solo platform_admin puede escribir esa tabla). La empresa no puede
-- activarlo ni desactivarlo desde su panel.
--
-- Garantía en servidor: mientras el modo esté activo, la configuración de
-- venta queda forzada a "solo WhatsApp". create_store_order_base ya rechaza
-- pedidos con WEB_ORDERS_DISABLED y el pago en línea exige
-- online_checkout_enabled, así que ningún pedido ni pago web puede entrar
-- aunque alguien llame las RPC directamente.
--
-- Al desactivar el modo NO se restaura nada automáticamente: la empresa
-- queda vendiendo por WhatsApp (estado seguro) y el dueño vuelve a elegir
-- su forma de venta en Configuración.

ALTER TABLE public.store_limits
  ADD COLUMN IF NOT EXISTS whatsapp_inquiry_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.store_limits.whatsapp_inquiry_mode IS
  'Platform-admin switch: public catalog without prices, cart or checkout; every product links to a WhatsApp price inquiry.';

-- ── 1. Forzar configuración de venta mientras el modo esté activo ──

CREATE OR REPLACE FUNCTION public.enforce_whatsapp_inquiry_commerce_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.store_limits
    WHERE store_id = NEW.store_id AND whatsapp_inquiry_mode = true
  ) THEN
    NEW.commerce_mode := 'catalog_only';
    NEW.whatsapp_checkout_enabled := true;
    NEW.web_order_enabled := false;
    NEW.cash_on_delivery_enabled := false;
    NEW.online_checkout_enabled := false;
    NEW.default_order_method := 'whatsapp';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_commerce_settings_whatsapp_inquiry
  ON public.store_commerce_settings;
CREATE TRIGGER store_commerce_settings_whatsapp_inquiry
  BEFORE INSERT OR UPDATE ON public.store_commerce_settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_whatsapp_inquiry_commerce_settings();

-- ── 2. Al activar el modo, aplicar de inmediato a la empresa ──
-- El upsert garantiza que exista la fila de configuración: sin ella,
-- create_store_order_base leería web_order_enabled = NULL y no rechazaría.
-- El trigger BEFORE de arriba es quien fija los valores definitivos.

CREATE OR REPLACE FUNCTION public.apply_whatsapp_inquiry_mode_from_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.whatsapp_inquiry_mode = true
     AND (TG_OP = 'INSERT' OR OLD.whatsapp_inquiry_mode IS DISTINCT FROM true) THEN
    INSERT INTO public.store_commerce_settings (store_id)
    VALUES (NEW.store_id)
    ON CONFLICT (store_id) DO UPDATE
      SET updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_limits_whatsapp_inquiry_mode
  ON public.store_limits;
CREATE TRIGGER store_limits_whatsapp_inquiry_mode
  AFTER INSERT OR UPDATE OF whatsapp_inquiry_mode ON public.store_limits
  FOR EACH ROW EXECUTE FUNCTION public.apply_whatsapp_inquiry_mode_from_limits();

REVOKE ALL ON FUNCTION public.enforce_whatsapp_inquiry_commerce_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_whatsapp_inquiry_mode_from_limits() FROM PUBLIC;

-- ── 3. Exponer el modo al storefront ──
-- Misma definición que 157 con whatsapp_inquiry_mode agregado AL FINAL
-- (CREATE OR REPLACE VIEW solo admite columnas nuevas al final).

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
  s.business_subcategory,
  COALESCE(sl.whatsapp_inquiry_mode, false) AS whatsapp_inquiry_mode
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
