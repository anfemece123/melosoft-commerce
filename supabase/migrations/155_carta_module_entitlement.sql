-- 155 — Carta digital como módulo por empresa.
-- Restaurantes conservan la funcionalidad automáticamente. Para cualquier
-- otro tipo de negocio, la activación queda bajo control del Super Admin.

ALTER TABLE public.store_limits
  ADD COLUMN IF NOT EXISTS can_use_carta boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.store_limits.can_use_carta IS
  'Platform-admin entitlement for the visual Carta digital module. Restaurants are enabled automatically; other businesses require explicit activation.';

-- Backfill seguro: reconoce tanto la clasificación nueva como la heredada.
-- No se fuerza false en otros negocios para no revocar una activación manual
-- en entornos donde esta migración se ejecute más de una vez.
UPDATE public.store_limits sl
SET can_use_carta = true
FROM public.stores s
LEFT JOIN public.store_commerce_settings c ON c.store_id = s.id
WHERE sl.store_id = s.id
  AND (
    c.business_category = 'restaurant'
    OR c.catalog_type = 'menu'
    OR s.business_vertical = 'food_restaurant'
    OR s.business_type = 'restaurante'
    -- Compatibilidad: conserva una Carta que ya estaba publicada antes de
    -- convertirla en módulo, aunque la clasificación histórica sea otra.
    OR EXISTS (
      SELECT 1
      FROM public.store_carta_settings existing_carta
      WHERE existing_carta.store_id = s.id
        AND (existing_carta.enabled = true OR existing_carta.listed_in_storefront = true)
    )
  );

-- Mantiene habilitada Carta para restaurantes nuevos o reclasificados sin
-- tocar una activación explícita que el Super Admin haya hecho en otro tipo
-- de negocio.
CREATE OR REPLACE FUNCTION public.sync_restaurant_carta_entitlement(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.store_limits sl
  SET can_use_carta = true
  WHERE sl.store_id = p_store_id
    AND sl.can_use_carta = false
    AND EXISTS (
      SELECT 1
      FROM public.stores s
      LEFT JOIN public.store_commerce_settings c ON c.store_id = s.id
      WHERE s.id = p_store_id
        AND (
          c.business_category = 'restaurant'
          OR c.catalog_type = 'menu'
          OR s.business_vertical = 'food_restaurant'
          OR s.business_type = 'restaurante'
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_carta_from_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sync_restaurant_carta_entitlement(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_carta_from_commerce_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sync_restaurant_carta_entitlement(NEW.store_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_carta_from_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sync_restaurant_carta_entitlement(NEW.store_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_carta_entitlement_after_store
  ON public.stores;
CREATE TRIGGER store_carta_entitlement_after_store
  AFTER INSERT OR UPDATE OF business_type, business_vertical
  ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.sync_restaurant_carta_from_store();

DROP TRIGGER IF EXISTS store_carta_entitlement_after_commerce_settings
  ON public.store_commerce_settings;
CREATE TRIGGER store_carta_entitlement_after_commerce_settings
  AFTER INSERT OR UPDATE OF business_category, catalog_type
  ON public.store_commerce_settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_restaurant_carta_from_commerce_settings();

DROP TRIGGER IF EXISTS store_carta_entitlement_after_limits
  ON public.store_limits;
CREATE TRIGGER store_carta_entitlement_after_limits
  AFTER INSERT ON public.store_limits
  FOR EACH ROW EXECUTE FUNCTION public.sync_restaurant_carta_from_limits();

REVOKE ALL ON FUNCTION public.sync_restaurant_carta_entitlement(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_restaurant_carta_from_store() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_restaurant_carta_from_commerce_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_restaurant_carta_from_limits() FROM PUBLIC;

-- Un miembro puede consultar la configuración, pero solo una empresa con el
-- módulo habilitado puede crearla o modificarla. Super Admin conserva acceso
-- para administrar y corregir cualquier empresa.
DROP POLICY IF EXISTS "store_carta_insert_owner_admin" ON public.store_carta_settings;
CREATE POLICY "store_carta_insert_owner_admin" ON public.store_carta_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR (
      public.has_store_role(store_id, array['owner', 'admin'])
      AND EXISTS (
        SELECT 1
        FROM public.store_limits sl
        WHERE sl.store_id = store_carta_settings.store_id
          AND sl.can_use_carta = true
      )
    )
  );

DROP POLICY IF EXISTS "store_carta_update_owner_admin" ON public.store_carta_settings;
CREATE POLICY "store_carta_update_owner_admin" ON public.store_carta_settings
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
  WITH CHECK (
    public.is_platform_admin()
    OR (
      public.has_store_role(store_id, array['owner', 'admin'])
      AND EXISTS (
        SELECT 1
        FROM public.store_limits sl
        WHERE sl.store_id = store_carta_settings.store_id
          AND sl.can_use_carta = true
      )
    )
  );

-- Encapsula la vista anterior para conservar exactamente sus columnas y su
-- compatibilidad, pero sin exponerla directamente a clientes. La vista nueva
-- añade el entitlement como filtro de servidor.
-- The new name is intentionally unqualified: PostgreSQL accepts the schema
-- on the existing relation, but the identifier after RENAME TO must be only
-- the new relation name.
ALTER VIEW public.public_carta_pages RENAME TO public_carta_pages_unentitled;
REVOKE ALL ON public.public_carta_pages_unentitled FROM PUBLIC, anon, authenticated;

CREATE VIEW public.public_carta_pages
  WITH (security_invoker = false)
AS
SELECT legacy.*
FROM public.public_carta_pages_unentitled legacy
JOIN public.stores s ON s.slug = legacy.store_slug
JOIN public.store_limits sl
  ON sl.store_id = s.id
  AND sl.can_use_carta = true;

GRANT SELECT ON public.public_carta_pages TO anon, authenticated;

COMMENT ON VIEW public.public_carta_pages IS
  'Public Carta rows filtered by both store_carta_settings.enabled and the per-store Carta module entitlement.';

-- Latest public storefront view (migration 145) with Carta hidden unless the
-- module is enabled and the store has actually published its Carta.
CREATE OR REPLACE VIEW public.public_store_pages
  WITH (security_invoker = false)
AS
SELECT
  s.id AS store_id,
  s.slug AS store_slug,
  s.name AS store_name,
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
  t.mode AS theme_mode,
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
  CASE WHEN l.is_public THEN l.address_line ELSE NULL END AS location_address,
  CASE WHEN l.is_public THEN l.neighborhood ELSE NULL END AS location_neighborhood,
  CASE WHEN l.is_public THEN l.city ELSE NULL END AS location_city,
  CASE WHEN l.is_public THEN l.department ELSE NULL END AS location_department,
  CASE WHEN l.is_public THEN l.country ELSE NULL END AS location_country,
  CASE WHEN l.is_public THEN l.latitude ELSE NULL END AS location_latitude,
  CASE WHEN l.is_public THEN l.longitude ELSE NULL END AS location_longitude,
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
  COALESCE(sl.can_use_partner_codes, false) AS partner_codes_enabled
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
LEFT JOIN public.store_limits sl ON sl.store_id = s.id
WHERE s.status = 'active';

GRANT SELECT ON public.public_store_pages TO anon, authenticated;

-- Sitemap: una carta deshabilitada no debe ser indexable ni quedar expuesta
-- aunque todavía conserve sus ajustes y productos guardados.
CREATE OR REPLACE FUNCTION public.get_public_sitemap_entries(p_store_slug text DEFAULT NULL)
RETURNS TABLE (
  page_type text,
  store_slug text,
  page_slug text,
  canonical_hostname text,
  last_modified timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_stores AS (
    SELECT
      s.id,
      s.slug,
      s.updated_at,
      domain.hostname AS canonical_hostname
    FROM public.stores s
    LEFT JOIN LATERAL (
      SELECT d.hostname
      FROM public.store_domains d
      WHERE d.store_id = s.id
        AND d.status = 'active'
        AND d.is_primary = true
      ORDER BY d.activated_at DESC NULLS LAST, d.updated_at DESC
      LIMIT 1
    ) domain ON true
    WHERE s.status = 'active'
      AND (p_store_slug IS NULL OR s.slug = lower(trim(p_store_slug)))
  )
  SELECT 'store', s.slug, NULL::text, s.canonical_hostname, s.updated_at
  FROM active_stores s

  UNION ALL

  SELECT 'catalog', s.slug, NULL::text, s.canonical_hostname,
         GREATEST(s.updated_at, MAX(p.updated_at))
  FROM active_stores s
  JOIN public.products p
    ON p.store_id = s.id
   AND p.status = 'active'
   AND p.show_in_ecommerce = true
  GROUP BY s.id, s.slug, s.canonical_hostname, s.updated_at

  UNION ALL

  SELECT 'product', s.slug, p.slug, s.canonical_hostname, p.updated_at
  FROM active_stores s
  JOIN public.products p
    ON p.store_id = s.id
   AND p.status = 'active'
   AND p.show_in_ecommerce = true

  UNION ALL

  SELECT 'offer', s.slug, o.slug, s.canonical_hostname, o.updated_at
  FROM active_stores s
  JOIN public.offers o
    ON o.store_id = s.id
   AND o.status = 'active'
   AND o.is_visible_in_store = true
   AND (o.ends_at IS NULL OR o.ends_at > now())

  UNION ALL

  SELECT 'carta', s.slug, NULL::text, s.canonical_hostname,
         GREATEST(s.updated_at, cs.updated_at, MAX(p.updated_at))
  FROM active_stores s
  JOIN public.store_carta_settings cs
    ON cs.store_id = s.id
   AND cs.enabled = true
  JOIN public.store_limits sl
    ON sl.store_id = s.id
   AND sl.can_use_carta = true
  JOIN public.products p
    ON p.store_id = s.id
   AND p.status = 'active'
   AND p.show_in_carta = true
  GROUP BY s.id, s.slug, s.canonical_hostname, s.updated_at, cs.updated_at

  ORDER BY 2, 1, 3 NULLS FIRST;
$$;

REVOKE ALL ON FUNCTION public.get_public_sitemap_entries(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_sitemap_entries(text) TO anon, authenticated;
