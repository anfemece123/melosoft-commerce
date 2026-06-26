-- ============================================================
-- Melosoft Commerce — Development Seed Data (Multistore)
-- File: 001_seed_dev_data.sql
--
-- IMPORTANT: Before running this seed:
-- 1. Create a user account through /login (Supabase Auth)
-- 2. Find that user's UUID in: Dashboard > Authentication > Users
-- 3. Replace ALL occurrences of OWNER_ID_HERE with that UUID
--
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- STORES
-- ============================================================

insert into public.stores (
  id,
  owner_id,
  name,
  slug,
  description,
  whatsapp_number,
  support_email,
  country,
  city,
  currency,
  status
) values (
  'cccccccc-0000-0000-0000-000000000001',
  'OWNER_ID_HERE',
  'Tienda Nova',
  'tienda-nova',
  'Tu tienda de tecnología con los mejores precios.',
  '+57 300 000 0000',
  'hola@tiendanova.co',
  'CO',
  'Bogotá',
  'COP',
  'active'
);

-- ============================================================
-- STORE THEME SETTINGS
-- ============================================================

insert into public.store_theme_settings (
  store_id,
  mode,
  primary_color,
  secondary_color,
  accent_color,
  template_key
) values (
  'cccccccc-0000-0000-0000-000000000001',
  'light',
  '#6366f1',
  '#f0f0ff',
  '#f59e0b',
  'default'
);

-- ============================================================
-- PRODUCTS
-- ============================================================

insert into public.products (
  id,
  store_id,
  owner_id,
  name,
  slug,
  description,
  short_description,
  regular_price,
  sale_price,
  stock,
  status,
  main_image_url,
  category
) values
(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001',
  'OWNER_ID_HERE',
  'Audífonos Bluetooth Premium',
  'audifonos-bluetooth-premium',
  'Audífonos inalámbricos con cancelación activa de ruido, 30 horas de batería y sonido Hi-Fi.',
  'Cancelación de ruido activa, 30h batería.',
  299900,
  199900,
  50,
  'active',
  'https://placehold.co/800x800/EEF2FF/6366F1?text=Audifonos',
  'Electrónica'
),
(
  'aaaaaaaa-0000-0000-0000-000000000002',
  'cccccccc-0000-0000-0000-000000000001',
  'OWNER_ID_HERE',
  'Smartwatch Deportivo',
  'smartwatch-deportivo',
  'Reloj inteligente con GPS integrado, monitoreo de frecuencia cardíaca y batería de 7 días.',
  'GPS, frecuencia cardíaca, 7 días batería.',
  450000,
  320000,
  30,
  'active',
  'https://placehold.co/800x800/F0FDF4/22C55E?text=Smartwatch',
  'Electrónica'
);

-- ============================================================
-- OFFERS
-- ============================================================

insert into public.offers (
  id,
  store_id,
  owner_id,
  product_id,
  title,
  slug,
  subtitle,
  description,
  regular_price,
  offer_price,
  starts_at,
  ends_at,
  status,
  timer_type,
  whatsapp_number,
  whatsapp_message,
  cta_label,
  hero_image_url
) values
(
  'bbbbbbbb-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001',
  'OWNER_ID_HERE',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '¡Audífonos Premium con 33% de Descuento!',
  'audifonos-premium-descuento',
  'Oferta por tiempo limitado',
  'Aprovecha esta oportunidad única de conseguir los audífonos Bluetooth Premium a un precio increíble.',
  299900,
  199900,
  now(),
  now() + interval '7 days',
  'active',
  'fixed_date',
  '+57 300 000 0000',
  'Hola! Vi la oferta de los Audífonos y me interesa.',
  'Comprar ahora',
  'https://placehold.co/1200x630/EEF2FF/6366F1?text=Audifonos+Oferta'
);
