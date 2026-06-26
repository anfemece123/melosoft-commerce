-- ============================================================
-- Melosoft Commerce — Service Role API Grants
-- Migration: 011
-- ============================================================
-- Edge Functions use the service_role key for privileged backend work.
-- service_role bypasses RLS, but still needs base SQL privileges.
-- ============================================================

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;