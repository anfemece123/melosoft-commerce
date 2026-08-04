-- Resolve the canonical Supabase Auth identity for a login email without
-- exposing auth.users to the browser. Store creation runs with service_role
-- and uses this function instead of treating profiles.email as the authority;
-- profile emails can be stale after an Auth email change or absent on legacy
-- accounts.

CREATE OR REPLACE FUNCTION public.resolve_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT users.id
  FROM auth.users AS users
  WHERE users.email = lower(btrim(p_email))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_auth_user_id_by_email(text) IS
  'Service-role-only lookup of the canonical Auth user id by normalized login email.';

REVOKE ALL ON FUNCTION public.resolve_auth_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_auth_user_id_by_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_auth_user_id_by_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_auth_user_id_by_email(text) TO service_role;
