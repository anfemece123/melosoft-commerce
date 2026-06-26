-- ============================================================
-- Migration 026 — Multi-location stores, geo reference data,
--                 and product availability per location.
-- Depends on: 008, 024, 025
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. EXPAND store_locations TO SUPPORT MULTIPLE LOCATIONS
-- ──────────────────────────────────────────────────────────────

-- Drop the single-location-per-store constraint
ALTER TABLE public.store_locations
  DROP CONSTRAINT IF EXISTS store_locations_store_id_key;

-- Add multi-location columns
ALTER TABLE public.store_locations
  ADD COLUMN IF NOT EXISTS name               text          NOT NULL DEFAULT 'Sede principal',
  ADD COLUMN IF NOT EXISTS slug               text,
  ADD COLUMN IF NOT EXISTS is_primary         boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active          boolean       NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allows_pickup      boolean       NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allows_local_delivery boolean    NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone              text,
  ADD COLUMN IF NOT EXISTS whatsapp_number    text,
  ADD COLUMN IF NOT EXISTS sort_order         integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_notes     text,
  ADD COLUMN IF NOT EXISTS pickup_notes       text;

-- Backfill: existing rows become the primary active location
UPDATE public.store_locations
  SET is_primary = true, is_active = true
  WHERE true;

-- ── Trigger: enforce exactly one primary location per store ──

CREATE OR REPLACE FUNCTION public.enforce_single_primary_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.store_locations
    SET is_primary = false
    WHERE store_id = NEW.store_id
      AND id <> NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_locations_single_primary ON public.store_locations;
CREATE TRIGGER store_locations_single_primary
  AFTER INSERT OR UPDATE ON public.store_locations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_primary_location();

-- ── Update RLS for store_locations ───────────────────────────

-- Drop old anon policy (was based on is_public)
DROP POLICY IF EXISTS "store_locations_select_anon_public" ON public.store_locations;

-- New anon policy: active locations are visible for public pages
CREATE POLICY "store_locations_select_anon_active" ON public.store_locations
  FOR SELECT TO anon USING (is_active = true);

-- Add missing delete policy for owner/admin
CREATE POLICY "store_locations_delete_owner_admin" ON public.store_locations
  FOR DELETE TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']));

-- ──────────────────────────────────────────────────────────────
-- 2. GEO REFERENCE TABLES (Colombia seed)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.geo_departments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text        NOT NULL DEFAULT 'CO',
  name         text        NOT NULL,
  code         text        NOT NULL,
  sort_order   integer     NOT NULL DEFAULT 0,
  UNIQUE (country_code, code)
);

COMMENT ON TABLE public.geo_departments IS 'Reference table for departments/states. Seeded with Colombia.';

CREATE TABLE IF NOT EXISTS public.geo_cities (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid        NOT NULL REFERENCES public.geo_departments(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  code          text,
  sort_order    integer     NOT NULL DEFAULT 0,
  UNIQUE (department_id, name)
);

COMMENT ON TABLE public.geo_cities IS 'Reference table for cities/municipalities per department.';

-- RLS: public read-only reference data
ALTER TABLE public.geo_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_cities      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_departments_select_all" ON public.geo_departments
  FOR SELECT USING (true);
CREATE POLICY "geo_cities_select_all" ON public.geo_cities
  FOR SELECT USING (true);

GRANT SELECT ON public.geo_departments TO anon, authenticated;
GRANT SELECT ON public.geo_cities      TO anon, authenticated;

-- ── Seed: Colombia departments (33) ──────────────────────────

INSERT INTO public.geo_departments (country_code, name, code, sort_order) VALUES
  ('CO', 'Bogotá D.C.',                      'DC', 1),
  ('CO', 'Antioquia',                         '05', 2),
  ('CO', 'Atlántico',                         '08', 3),
  ('CO', 'Bolívar',                           '13', 4),
  ('CO', 'Boyacá',                            '15', 5),
  ('CO', 'Caldas',                            '17', 6),
  ('CO', 'Caquetá',                           '18', 7),
  ('CO', 'Cauca',                             '19', 8),
  ('CO', 'Cesar',                             '20', 9),
  ('CO', 'Córdoba',                           '23', 10),
  ('CO', 'Cundinamarca',                      '25', 11),
  ('CO', 'Chocó',                             '27', 12),
  ('CO', 'Huila',                             '41', 13),
  ('CO', 'La Guajira',                        '44', 14),
  ('CO', 'Magdalena',                         '47', 15),
  ('CO', 'Meta',                              '50', 16),
  ('CO', 'Nariño',                            '52', 17),
  ('CO', 'Norte de Santander',               '54', 18),
  ('CO', 'Quindío',                           '63', 19),
  ('CO', 'Risaralda',                         '66', 20),
  ('CO', 'Santander',                         '68', 21),
  ('CO', 'Sucre',                             '70', 22),
  ('CO', 'Tolima',                            '73', 23),
  ('CO', 'Valle del Cauca',                  '76', 24),
  ('CO', 'Arauca',                            '81', 25),
  ('CO', 'Casanare',                          '85', 26),
  ('CO', 'Putumayo',                          '86', 27),
  ('CO', 'San Andrés y Providencia',         '88', 28),
  ('CO', 'Amazonas',                          '91', 29),
  ('CO', 'Guainía',                           '94', 30),
  ('CO', 'Guaviare',                          '95', 31),
  ('CO', 'Vaupés',                            '97', 32),
  ('CO', 'Vichada',                           '99', 33)
ON CONFLICT (country_code, code) DO NOTHING;

-- ── Seed: Colombia cities ─────────────────────────────────────

DO $$
DECLARE
  d_dc  uuid; d_ant uuid; d_atl uuid; d_bol uuid;
  d_boy uuid; d_cal uuid; d_caq uuid; d_cau uuid;
  d_ces uuid; d_cor uuid; d_cun uuid; d_cho uuid;
  d_hui uuid; d_lag uuid; d_mag uuid; d_met uuid;
  d_nar uuid; d_nds uuid; d_qui uuid; d_ris uuid;
  d_san uuid; d_suc uuid; d_tol uuid; d_val uuid;
  d_ara uuid; d_cas uuid; d_put uuid; d_sap uuid;
  d_ama uuid; d_gua uuid; d_gvi uuid; d_vau uuid;
  d_vic uuid;
BEGIN
  SELECT id INTO d_dc  FROM public.geo_departments WHERE country_code='CO' AND code='DC';
  SELECT id INTO d_ant FROM public.geo_departments WHERE country_code='CO' AND code='05';
  SELECT id INTO d_atl FROM public.geo_departments WHERE country_code='CO' AND code='08';
  SELECT id INTO d_bol FROM public.geo_departments WHERE country_code='CO' AND code='13';
  SELECT id INTO d_boy FROM public.geo_departments WHERE country_code='CO' AND code='15';
  SELECT id INTO d_cal FROM public.geo_departments WHERE country_code='CO' AND code='17';
  SELECT id INTO d_caq FROM public.geo_departments WHERE country_code='CO' AND code='18';
  SELECT id INTO d_cau FROM public.geo_departments WHERE country_code='CO' AND code='19';
  SELECT id INTO d_ces FROM public.geo_departments WHERE country_code='CO' AND code='20';
  SELECT id INTO d_cor FROM public.geo_departments WHERE country_code='CO' AND code='23';
  SELECT id INTO d_cun FROM public.geo_departments WHERE country_code='CO' AND code='25';
  SELECT id INTO d_cho FROM public.geo_departments WHERE country_code='CO' AND code='27';
  SELECT id INTO d_hui FROM public.geo_departments WHERE country_code='CO' AND code='41';
  SELECT id INTO d_lag FROM public.geo_departments WHERE country_code='CO' AND code='44';
  SELECT id INTO d_mag FROM public.geo_departments WHERE country_code='CO' AND code='47';
  SELECT id INTO d_met FROM public.geo_departments WHERE country_code='CO' AND code='50';
  SELECT id INTO d_nar FROM public.geo_departments WHERE country_code='CO' AND code='52';
  SELECT id INTO d_nds FROM public.geo_departments WHERE country_code='CO' AND code='54';
  SELECT id INTO d_qui FROM public.geo_departments WHERE country_code='CO' AND code='63';
  SELECT id INTO d_ris FROM public.geo_departments WHERE country_code='CO' AND code='66';
  SELECT id INTO d_san FROM public.geo_departments WHERE country_code='CO' AND code='68';
  SELECT id INTO d_suc FROM public.geo_departments WHERE country_code='CO' AND code='70';
  SELECT id INTO d_tol FROM public.geo_departments WHERE country_code='CO' AND code='73';
  SELECT id INTO d_val FROM public.geo_departments WHERE country_code='CO' AND code='76';
  SELECT id INTO d_ara FROM public.geo_departments WHERE country_code='CO' AND code='81';
  SELECT id INTO d_cas FROM public.geo_departments WHERE country_code='CO' AND code='85';
  SELECT id INTO d_put FROM public.geo_departments WHERE country_code='CO' AND code='86';
  SELECT id INTO d_sap FROM public.geo_departments WHERE country_code='CO' AND code='88';
  SELECT id INTO d_ama FROM public.geo_departments WHERE country_code='CO' AND code='91';
  SELECT id INTO d_gua FROM public.geo_departments WHERE country_code='CO' AND code='94';
  SELECT id INTO d_gvi FROM public.geo_departments WHERE country_code='CO' AND code='95';
  SELECT id INTO d_vau FROM public.geo_departments WHERE country_code='CO' AND code='97';
  SELECT id INTO d_vic FROM public.geo_departments WHERE country_code='CO' AND code='99';

  -- Bogotá D.C.
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_dc, 'Bogotá', 1)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Antioquia
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_ant, 'Medellín', 1), (d_ant, 'Bello', 2), (d_ant, 'Itagüí', 3),
    (d_ant, 'Envigado', 4), (d_ant, 'Apartadó', 5), (d_ant, 'Rionegro', 6),
    (d_ant, 'Caucasia', 7), (d_ant, 'Turbo', 8), (d_ant, 'La Estrella', 9),
    (d_ant, 'Sabaneta', 10), (d_ant, 'Copacabana', 11), (d_ant, 'Girardota', 12)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Atlántico
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_atl, 'Barranquilla', 1), (d_atl, 'Soledad', 2), (d_atl, 'Malambo', 3),
    (d_atl, 'Sabanalarga', 4), (d_atl, 'Baranoa', 5), (d_atl, 'Galapa', 6)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Bolívar
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_bol, 'Cartagena', 1), (d_bol, 'Magangué', 2),
    (d_bol, 'El Carmen de Bolívar', 3), (d_bol, 'Mompós', 4), (d_bol, 'Turbaco', 5)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Boyacá
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_boy, 'Tunja', 1), (d_boy, 'Duitama', 2), (d_boy, 'Sogamoso', 3),
    (d_boy, 'Chiquinquirá', 4), (d_boy, 'Paipa', 5), (d_boy, 'Moniquirá', 6)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Caldas
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_cal, 'Manizales', 1), (d_cal, 'Villamaría', 2), (d_cal, 'La Dorada', 3),
    (d_cal, 'Chinchiná', 4), (d_cal, 'Anserma', 5)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Caquetá
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_caq, 'Florencia', 1), (d_caq, 'San Vicente del Caguán', 2), (d_caq, 'Puerto Rico', 3)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Cauca
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_cau, 'Popayán', 1), (d_cau, 'Santander de Quilichao', 2),
    (d_cau, 'Puerto Tejada', 3), (d_cau, 'Patía', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Cesar
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_ces, 'Valledupar', 1), (d_ces, 'Aguachica', 2),
    (d_ces, 'Bosconia', 3), (d_ces, 'Curumaní', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Córdoba
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_cor, 'Montería', 1), (d_cor, 'Cereté', 2), (d_cor, 'Sahagún', 3),
    (d_cor, 'Lorica', 4), (d_cor, 'Montelíbano', 5)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Cundinamarca
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_cun, 'Soacha', 1), (d_cun, 'Facatativá', 2), (d_cun, 'Zipaquirá', 3),
    (d_cun, 'Fusagasugá', 4), (d_cun, 'Chía', 5), (d_cun, 'Mosquera', 6),
    (d_cun, 'Madrid', 7), (d_cun, 'Girardot', 8), (d_cun, 'Funza', 9)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Chocó
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_cho, 'Quibdó', 1), (d_cho, 'Istmina', 2), (d_cho, 'Riosucio', 3), (d_cho, 'Condoto', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Huila
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_hui, 'Neiva', 1), (d_hui, 'Pitalito', 2), (d_hui, 'Garzón', 3), (d_hui, 'La Plata', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- La Guajira
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_lag, 'Riohacha', 1), (d_lag, 'Maicao', 2), (d_lag, 'Uribia', 3)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Magdalena
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_mag, 'Santa Marta', 1), (d_mag, 'Ciénaga', 2),
    (d_mag, 'Fundación', 3), (d_mag, 'El Banco', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Meta
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_met, 'Villavicencio', 1), (d_met, 'Acacías', 2),
    (d_met, 'Granada', 3), (d_met, 'Puerto López', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Nariño
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_nar, 'Pasto', 1), (d_nar, 'Tumaco', 2), (d_nar, 'Ipiales', 3),
    (d_nar, 'Túquerres', 4), (d_nar, 'Samaniego', 5)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Norte de Santander
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_nds, 'Cúcuta', 1), (d_nds, 'Ocaña', 2), (d_nds, 'Pamplona', 3),
    (d_nds, 'Villa del Rosario', 4), (d_nds, 'Los Patios', 5)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Quindío
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_qui, 'Armenia', 1), (d_qui, 'Calarcá', 2),
    (d_qui, 'Montenegro', 3), (d_qui, 'La Tebaida', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Risaralda
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_ris, 'Pereira', 1), (d_ris, 'Dosquebradas', 2),
    (d_ris, 'Santa Rosa de Cabal', 3), (d_ris, 'La Virginia', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Santander
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_san, 'Bucaramanga', 1), (d_san, 'Floridablanca', 2), (d_san, 'Girón', 3),
    (d_san, 'Piedecuesta', 4), (d_san, 'Barrancabermeja', 5), (d_san, 'Socorro', 6)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Sucre
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_suc, 'Sincelejo', 1), (d_suc, 'Corozal', 2),
    (d_suc, 'Sampués', 3), (d_suc, 'San Marcos', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Tolima
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_tol, 'Ibagué', 1), (d_tol, 'Espinal', 2), (d_tol, 'Honda', 3), (d_tol, 'Chaparral', 4)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Valle del Cauca
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_val, 'Cali', 1), (d_val, 'Buenaventura', 2), (d_val, 'Palmira', 3),
    (d_val, 'Buga', 4), (d_val, 'Tuluá', 5), (d_val, 'Cartago', 6),
    (d_val, 'Yumbo', 7), (d_val, 'Jamundí', 8)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Arauca
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_ara, 'Arauca', 1), (d_ara, 'Saravena', 2), (d_ara, 'Tame', 3)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Casanare
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_cas, 'Yopal', 1), (d_cas, 'Aguazul', 2), (d_cas, 'Villanueva', 3)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Putumayo
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_put, 'Mocoa', 1), (d_put, 'Puerto Asís', 2), (d_put, 'Orito', 3)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- San Andrés y Providencia
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_sap, 'San Andrés', 1), (d_sap, 'Providencia', 2)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Amazonas
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_ama, 'Leticia', 1)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Guainía
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_gua, 'Puerto Inírida', 1)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Guaviare
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_gvi, 'San José del Guaviare', 1)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Vaupés
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_vau, 'Mitú', 1)
  ON CONFLICT (department_id, name) DO NOTHING;

  -- Vichada
  INSERT INTO public.geo_cities (department_id, name, sort_order) VALUES
    (d_vic, 'Puerto Carreño', 1)
  ON CONFLICT (department_id, name) DO NOTHING;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 3. PRODUCT LOCATION AVAILABILITY
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_location_availability (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id          uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_location_id   uuid        NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  is_available        boolean     NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, store_location_id)
);

COMMENT ON TABLE public.product_location_availability IS
  'Explicit availability overrides per product per location. Absent row = available.';

CREATE TRIGGER product_location_availability_updated_at
  BEFORE UPDATE ON public.product_location_availability
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_pla_store_id
  ON public.product_location_availability(store_id);
CREATE INDEX IF NOT EXISTS idx_pla_product_id
  ON public.product_location_availability(product_id);
CREATE INDEX IF NOT EXISTS idx_pla_location_id
  ON public.product_location_availability(store_location_id);

ALTER TABLE public.product_location_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pla_select_platform_admin" ON public.product_location_availability
  FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE POLICY "pla_all_platform_admin" ON public.product_location_availability
  FOR ALL TO authenticated USING (public.is_platform_admin());

CREATE POLICY "pla_select_member" ON public.product_location_availability
  FOR SELECT TO authenticated
  USING (public.is_store_member(store_id));

CREATE POLICY "pla_write_owner_admin" ON public.product_location_availability
  FOR ALL TO authenticated
  USING (public.has_store_role(store_id, array['owner', 'admin']))
  WITH CHECK (public.has_store_role(store_id, array['owner', 'admin']));

CREATE POLICY "pla_select_anon" ON public.product_location_availability
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.product_location_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_location_availability TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 4. ADD store_location_id TO ORDERS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_location_id uuid
    REFERENCES public.store_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_store_location_id
  ON public.orders(store_location_id);

-- ──────────────────────────────────────────────────────────────
-- 5. UPDATE public_store_pages — USE LATERAL FOR PRIMARY LOCATION
--    (avoids duplicate rows when a store has multiple locations)
-- ──────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.public_store_pages;

CREATE VIEW public.public_store_pages
  WITH (security_invoker = true)
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
  -- Theme
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
  -- Primary location (only if public)
  CASE WHEN l.is_public THEN l.address_line   ELSE NULL END  AS location_address,
  CASE WHEN l.is_public THEN l.neighborhood   ELSE NULL END  AS location_neighborhood,
  CASE WHEN l.is_public THEN l.city           ELSE NULL END  AS location_city,
  CASE WHEN l.is_public THEN l.department     ELSE NULL END  AS location_department,
  CASE WHEN l.is_public THEN l.country        ELSE NULL END  AS location_country,
  CASE WHEN l.is_public THEN l.latitude       ELSE NULL END  AS location_latitude,
  CASE WHEN l.is_public THEN l.longitude      ELSE NULL END  AS location_longitude,
  -- Commerce settings
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

GRANT SELECT ON public.public_store_pages TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- 6. CREATE public_store_locations VIEW
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.public_store_locations
  WITH (security_invoker = false)
AS
SELECT
  sl.id               AS location_id,
  sl.store_id,
  s.slug              AS store_slug,
  sl.name,
  sl.city,
  sl.department,
  sl.country,
  sl.address_line,
  sl.neighborhood,
  sl.phone,
  sl.whatsapp_number,
  sl.allows_pickup,
  sl.allows_local_delivery,
  sl.delivery_notes,
  sl.pickup_notes,
  sl.is_primary,
  sl.sort_order
FROM public.store_locations sl
JOIN public.stores s ON s.id = sl.store_id
WHERE sl.is_active = true
  AND s.status = 'active';

GRANT SELECT ON public.public_store_locations TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- 7. UPDATE create_store_order RPC — ADD p_store_location_id
-- Drop old signature (text×11, jsonb) before recreating with new uuid param
DROP FUNCTION IF EXISTS public.create_store_order(text,text,text,text,text,text,text,text,text,text,text,jsonb);
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_store_order(
  p_store_slug            text,
  p_customer_name         text,
  p_customer_phone        text,
  p_customer_email        text    DEFAULT NULL,
  p_fulfillment_method    text    DEFAULT 'delivery',
  p_shipping_address      text    DEFAULT NULL,
  p_city                  text    DEFAULT NULL,
  p_department            text    DEFAULT NULL,
  p_delivery_neighborhood text    DEFAULT NULL,
  p_delivery_reference    text    DEFAULT NULL,
  p_notes                 text    DEFAULT NULL,
  p_items                 jsonb   DEFAULT '[]'::jsonb,
  p_store_location_id     uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id            uuid;
  v_store_status        text;
  v_web_order_enabled   boolean;
  v_cod_enabled         boolean;
  v_order_id            uuid;
  v_order_number        text;
  v_subtotal            numeric := 0;
  v_item                jsonb;
  v_item_product_id     uuid;
  v_product_name        text;
  v_product_slug        text;
  v_active_price        numeric;
  v_qty                 integer;
  v_line_total          numeric;
  v_customization_note  text;
  i                     integer;
BEGIN
  SELECT s.id, s.status, scs.web_order_enabled, scs.cash_on_delivery_enabled
  INTO v_store_id, v_store_status, v_web_order_enabled, v_cod_enabled
  FROM stores s
  JOIN store_commerce_settings scs ON scs.store_id = s.id
  WHERE s.slug = p_store_slug;

  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND'; END IF;
  IF v_store_status != 'active' THEN RAISE EXCEPTION 'STORE_INACTIVE'; END IF;
  IF NOT v_web_order_enabled THEN RAISE EXCEPTION 'WEB_ORDERS_DISABLED'; END IF;
  IF NOT v_cod_enabled THEN RAISE EXCEPTION 'COD_DISABLED'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'NO_ITEMS'; END IF;

  -- Validate location belongs to this store (if provided)
  IF p_store_location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM store_locations
      WHERE id = p_store_location_id AND store_id = v_store_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'INVALID_LOCATION';
    END IF;
  END IF;

  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-'
    || upper(substring(gen_random_uuid()::text, 1, 6));

  INSERT INTO orders (
    store_id, order_number, store_location_id,
    customer_name, customer_phone, customer_email,
    fulfillment_method, shipping_address, city, department,
    delivery_neighborhood, delivery_reference, notes,
    source, payment_method,
    subtotal, shipping_amount, discount_amount, total_amount,
    currency, status, payment_status
  ) VALUES (
    v_store_id, v_order_number, p_store_location_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_fulfillment_method, p_shipping_address, p_city, p_department,
    p_delivery_neighborhood, p_delivery_reference, p_notes,
    'web', 'cash_on_delivery',
    0, 0, 0, 0,
    'COP', 'pending', 'pending'
  )
  RETURNING id INTO v_order_id;

  FOR i IN 0 .. (jsonb_array_length(p_items) - 1)
  LOOP
    v_item            := p_items -> i;
    v_item_product_id := (v_item ->> 'product_id')::uuid;
    v_qty             := (v_item ->> 'quantity')::integer;
    v_customization_note := v_item ->> 'customization_notes';

    SELECT p.id, p.name, p.slug, COALESCE(p.sale_price, p.regular_price)
    INTO v_item_product_id, v_product_name, v_product_slug, v_active_price
    FROM products p
    WHERE p.id = v_item_product_id
      AND p.store_id = v_store_id
      AND p.status = 'active'
      AND p.is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_PRODUCT:%', v_item ->> 'product_id';
    END IF;

    v_line_total := v_active_price * v_qty;
    v_subtotal   := v_subtotal + v_line_total;

    INSERT INTO order_items (
      order_id, product_id,
      product_name_snapshot, product_slug_snapshot,
      name, quantity, unit_price, total_price,
      customer_note
    ) VALUES (
      v_order_id, v_item_product_id,
      v_product_name, v_product_slug,
      v_product_name, v_qty, v_active_price, v_line_total,
      v_customization_note
    );
  END LOOP;

  UPDATE orders
  SET subtotal = v_subtotal, total_amount = v_subtotal
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'total_amount', v_subtotal,
    'status',       'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_store_order(
  text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid
) TO anon, authenticated;
