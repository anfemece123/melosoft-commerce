-- ============================================================
-- Migration 013 — Catalog & products improvements
-- Adds product_type, is_available, is_featured, sku, track_inventory,
-- preparation_time_minutes, sort_order, compare_at_price to products.
-- Adds is_primary to product_images.
-- Updates RLS to role-helper pattern.
-- Recreates public_product_pages and public_store_pages views.
-- ============================================================

-- ── 1. Add new columns to products ───────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'physical_product'
    CHECK (product_type IN ('menu_item', 'physical_product', 'service')),
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(12,2);

-- Update status constraint to include 'draft'
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_valid;
ALTER TABLE products
  ADD CONSTRAINT products_status_valid
  CHECK (status IN ('draft', 'active', 'inactive', 'archived'));

-- ── 2. Add is_primary to product_images ──────────────────────

ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- ── 3. Drop old owner_id-based RLS policies on products ──────

DROP POLICY IF EXISTS "Owners can manage their products" ON products;
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Store members can manage products" ON products;

-- ── 4. New role-helper RLS on products ───────────────────────

-- Public: only active+available products visible
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (status = 'active' AND is_available = true);

-- Store members (staff, admin, owner) can read all their store's products
CREATE POLICY "Store members can read products"
  ON products FOR SELECT
  USING (is_store_member(store_id));

-- Staff, admin, owner can insert products
CREATE POLICY "Catalog managers can insert products"
  ON products FOR INSERT
  WITH CHECK (
    has_store_role(store_id, ARRAY['owner', 'admin', 'staff'])
  );

-- Staff, admin, owner can update products
CREATE POLICY "Catalog managers can update products"
  ON products FOR UPDATE
  USING (
    has_store_role(store_id, ARRAY['owner', 'admin', 'staff'])
  );

-- Only owner and admin can delete (archive) products
CREATE POLICY "Managers can delete products"
  ON products FOR DELETE
  USING (
    has_store_role(store_id, ARRAY['owner', 'admin'])
  );

-- Platform admin can do everything
CREATE POLICY "Platform admin full access on products"
  ON products FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── 5. Drop old RLS policies on product_images ───────────────

DROP POLICY IF EXISTS "Owners can manage product images" ON product_images;
DROP POLICY IF EXISTS "Anyone can view product images" ON product_images;

-- ── 6. New role-helper RLS on product_images ─────────────────

CREATE POLICY "Public can view product images"
  ON product_images FOR SELECT
  USING (true);

CREATE POLICY "Catalog managers can insert product images"
  ON product_images FOR INSERT
  WITH CHECK (
    has_store_role(store_id, ARRAY['owner', 'admin', 'staff'])
  );

CREATE POLICY "Catalog managers can update product images"
  ON product_images FOR UPDATE
  USING (
    has_store_role(store_id, ARRAY['owner', 'admin', 'staff'])
  );

CREATE POLICY "Managers can delete product images"
  ON product_images FOR DELETE
  USING (
    has_store_role(store_id, ARRAY['owner', 'admin', 'staff'])
  );

CREATE POLICY "Platform admin full access on product_images"
  ON product_images FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── 7. GRANTs for authenticated users ────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO authenticated;

-- ── 8. Recreate public_product_pages view ────────────────────

DROP VIEW IF EXISTS public_product_pages;

CREATE VIEW public_product_pages AS
SELECT
  s.slug          AS store_slug,
  s.name          AS store_name,
  s.whatsapp_number AS store_whatsapp_number,
  s.logo_url,
  t.mode          AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  p.id            AS product_id,
  p.slug          AS product_slug,
  p.name          AS product_name,
  p.description,
  p.short_description,
  p.product_type,
  p.regular_price,
  p.compare_at_price,
  p.sale_price,
  p.stock,
  p.is_featured,
  p.is_available,
  p.preparation_time_minutes,
  p.main_image_url,
  p.category
FROM products p
JOIN stores s ON s.id = p.store_id
LEFT JOIN store_theme_settings t ON t.store_id = s.id
WHERE p.status = 'active'
  AND p.is_available = true
  AND s.status = 'active';

GRANT SELECT ON public_product_pages TO anon, authenticated;

-- ── 9. Recreate public_store_pages view (add catalog_type) ───

DROP VIEW IF EXISTS public_store_pages;

CREATE VIEW public_store_pages AS
SELECT
  s.id            AS store_id,
  s.slug          AS store_slug,
  s.name          AS store_name,
  s.slogan,
  s.business_type,
  s.description,
  s.logo_url,
  s.favicon_url,
  s.whatsapp_number,
  s.support_email,
  s.country,
  s.city,
  s.currency,
  t.mode          AS theme_mode,
  t.theme_preset,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  pol.shipping_policy,
  pol.returns_policy,
  pol.warranty_policy,
  pol.privacy_policy,
  pol.terms_and_conditions,
  loc.address_line  AS location_address,
  loc.neighborhood  AS location_neighborhood,
  loc.city          AS location_city,
  loc.department    AS location_department,
  loc.country       AS location_country,
  loc.latitude      AS location_latitude,
  loc.longitude     AS location_longitude,
  cs.catalog_type
FROM stores s
LEFT JOIN store_theme_settings t ON t.store_id = s.id
LEFT JOIN store_policies pol ON pol.store_id = s.id
LEFT JOIN store_locations loc ON loc.store_id = s.id AND loc.is_public = true
LEFT JOIN store_commerce_settings cs ON cs.store_id = s.id
WHERE s.status = 'active';

GRANT SELECT ON public_store_pages TO anon, authenticated;
