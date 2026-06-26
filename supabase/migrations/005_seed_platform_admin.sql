-- ============================================================
-- Melosoft Commerce — Seed: Designate First Platform Admin
-- Migration: 005
-- Depends on: 004
-- ============================================================
-- This migration promotes the first platform admin.
-- It temporarily disables USER triggers on profiles because
-- the protection trigger prevents changing platform_role before
-- any platform_admin exists.
-- ============================================================

begin;

alter table public.profiles disable trigger user;

update public.profiles
set
  platform_role = 'platform_admin',
  status = 'active',
  updated_at = now()
where email = 'andresfelipemelo18@gmail.com';

alter table public.profiles enable trigger user;

commit;