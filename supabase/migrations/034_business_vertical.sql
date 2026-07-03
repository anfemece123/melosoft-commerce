-- ============================================================
-- Melosoft Commerce — Business Vertical Architecture
-- Migration: 034
-- Depends on: 001, 012
-- ============================================================

-- ── Vertical classification in stores ───────────────────────

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS business_vertical text
    CONSTRAINT stores_business_vertical_valid CHECK (
      business_vertical IN ('food_restaurant', 'retail_products', 'catalog_quote', 'real_estate')
    ),
  ADD COLUMN IF NOT EXISTS business_subcategory text;

-- ── Operational flags in store_commerce_settings ────────────

ALTER TABLE public.store_commerce_settings
  ADD COLUMN IF NOT EXISTS order_flow_type text NOT NULL DEFAULT 'ecommerce'
    CONSTRAINT scs_order_flow_type_valid CHECK (
      order_flow_type IN ('restaurant', 'ecommerce', 'quote', 'lead')
    ),
  ADD COLUMN IF NOT EXISTS has_inventory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_leads boolean NOT NULL DEFAULT false;

-- ── Backfill business_vertical from existing business_type ──

UPDATE public.stores
  SET business_vertical = 'food_restaurant'
  WHERE business_type = 'restaurante' AND business_vertical IS NULL;

UPDATE public.stores
  SET business_vertical = 'retail_products'
  WHERE business_type IN ('moda', 'tecnologia', 'mascotas', 'hogar', 'belleza', 'salud', 'barberia', 'otro')
    AND business_vertical IS NULL;

-- Remaining stores (null business_type or unknown) → retail_products as safe default
UPDATE public.stores
  SET business_vertical = 'retail_products'
  WHERE business_vertical IS NULL;

-- ── Backfill order_flow_type from existing business_category ─

UPDATE public.store_commerce_settings
  SET order_flow_type = 'restaurant'
  WHERE (business_category = 'restaurant' OR catalog_type = 'menu')
    AND order_flow_type = 'ecommerce';

UPDATE public.store_commerce_settings
  SET order_flow_type = 'quote',
      has_leads = true
  WHERE business_category = 'services'
    AND catalog_type = 'services'
    AND order_flow_type = 'ecommerce';

-- Backfill has_inventory for existing retail stores
UPDATE public.store_commerce_settings
  SET has_inventory = true
  WHERE order_flow_type = 'ecommerce'
    AND business_category IN ('retail', 'fashion', 'technology', 'pets', 'home');
