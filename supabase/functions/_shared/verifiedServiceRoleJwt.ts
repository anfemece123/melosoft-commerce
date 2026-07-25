/**
 * Reads the role from a JWT that has already passed Supabase Edge Gateway's
 * built-in JWT verification. This function deliberately does not verify the
 * signature itself; callers must keep verify_jwt=true for their Edge Function.
 */
export function readVerifiedJwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const base64 = parts[1].replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}
