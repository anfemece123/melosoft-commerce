-- ============================================================
-- Migration 022 — Refine store commerce settings
-- Adds cash on delivery support for website orders.
-- ============================================================

ALTER TABLE public.store_commerce_settings
  ADD COLUMN IF NOT EXISTS cash_on_delivery_enabled boolean NOT NULL DEFAULT false;
