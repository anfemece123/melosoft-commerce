-- ============================================================
-- Melosoft Commerce — Store Onboarding Fields
-- Migration: 007
-- Depends on: 001, 004, 006
-- ============================================================
-- Adds fields needed for complete store creation flow:
--  - stores: slogan, business_type
--  - profiles: phone, document_type, document_number
--  - store_theme_settings: theme_preset
-- Does NOT break existing data.
-- ============================================================


-- ── stores: add slogan and business_type ────────────────────

alter table public.stores
  add column if not exists slogan text,
  add column if not exists business_type text;

comment on column public.stores.slogan is 'Short tagline displayed on the public storefront.';
comment on column public.stores.business_type is 'Type of business (barberia, restaurante, moda, etc.)';


-- ── profiles: add contact / identity fields ─────────────────

alter table public.profiles
  add column if not exists phone text,
  add column if not exists document_type text,
  add column if not exists document_number text;

comment on column public.profiles.phone is 'Owner or user phone number.';
comment on column public.profiles.document_type is 'Identity document type (CC, NIT, passport, etc.).';
comment on column public.profiles.document_number is 'Identity document number.';


-- ── store_theme_settings: add theme_preset ──────────────────

alter table public.store_theme_settings
  add column if not exists theme_preset text not null default 'blue';

comment on column public.store_theme_settings.theme_preset is
  'Named color preset (blue|violet|emerald|rose|amber|slate). Drives primary/secondary/accent colors.';

alter table public.store_theme_settings
  add constraint store_theme_preset_valid
    check (theme_preset in ('blue', 'violet', 'emerald', 'rose', 'amber', 'slate'));


-- ── Update stores.status constraint to include 'suspended' ──
-- (in case migration 004 was not yet applied to this instance)

alter table public.stores drop constraint if exists stores_status_valid;
alter table public.stores add constraint stores_status_valid
  check (status in ('active', 'inactive', 'suspended', 'archived'));
