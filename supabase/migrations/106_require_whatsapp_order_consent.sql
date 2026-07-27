-- Stores with a fully operational automatic WhatsApp channel require an
-- explicit checkout opt-in before a web order (or Wompi session) can be
-- created. The readiness flag exposed publicly is only a boolean; connection
-- identifiers and credentials remain private.

CREATE OR REPLACE FUNCTION public.store_requires_whatsapp_order_consent(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_whatsapp_settings settings
    JOIN public.store_whatsapp_connections connection
      ON connection.store_id = settings.store_id
    WHERE settings.store_id = p_store_id
      AND settings.enabled = true
      AND settings.customer_order_confirmation_enabled = true
      AND connection.connection_status = 'connected'
      AND connection.registration_status = 'registered'
      AND connection.template_status = 'approved'
      AND connection.phone_number_id IS NOT NULL
      AND connection.token_secret_reference IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.store_requires_whatsapp_order_consent(uuid)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_web_order_whatsapp_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.source = 'web'
     AND public.store_requires_whatsapp_order_consent(NEW.store_id)
     AND NOT COALESCE(NEW.whatsapp_consent, false) THEN
    RAISE EXCEPTION 'WHATSAPP_CONSENT_REQUIRED' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_require_whatsapp_consent ON public.orders;
CREATE TRIGGER orders_require_whatsapp_consent
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_web_order_whatsapp_consent();

CREATE OR REPLACE FUNCTION public.enforce_checkout_session_whatsapp_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.store_requires_whatsapp_order_consent(NEW.store_id)
     AND NOT COALESCE(NEW.whatsapp_consent, false) THEN
    RAISE EXCEPTION 'WHATSAPP_CONSENT_REQUIRED' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkout_sessions_require_whatsapp_consent ON public.checkout_sessions;
CREATE TRIGGER checkout_sessions_require_whatsapp_consent
  BEFORE INSERT ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_checkout_session_whatsapp_consent();

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
  public.store_requires_whatsapp_order_consent(s.id) AS whatsapp_order_updates_required
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
WHERE s.status = 'active';

GRANT SELECT ON public.public_store_pages TO anon, authenticated;
