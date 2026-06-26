-- ============================================================
-- Melosoft Commerce — Seed Payment Providers
-- Migration: 003
-- ============================================================

insert into public.payment_providers (code, name, status) values
  ('wompi', 'Wompi', 'active')
on conflict (code) do nothing;
