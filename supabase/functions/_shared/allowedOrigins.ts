// Single source of truth for which browser origins may call the
// platform's admin-facing Edge Functions (store creation, owner
// invites, etc.). Before this file existed, create-store-with-owner and
// resend-owner-invite each kept their own copy of this same allow-list
// — resend-owner-invite's copy never picked up PLATFORM_HOSTNAMES, so it
// silently drifted out of sync with the other. Every admin-facing
// function must import from here instead of declaring its own list.
//
// melosoftapp.com (apex/www) is a DIFFERENT, pre-existing app — this
// admin panel lives only at commerce.melosoftapp.com. PLATFORM_HOSTNAMES
// (Supabase secret, comma-separated exact hostnames) is the source of
// truth in production for any additional admin host; the literals below
// only cover local dev and the one hostname every environment needs.
//
// This allow-list is for ADMIN-FACING functions only — never add a
// storefront host or a wildcard pattern here. A storefront must never
// be able to call these functions with browser credentials.
export const DEFAULT_APP_ORIGIN = 'https://commerce.melosoftapp.com';

const STATIC_ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  DEFAULT_APP_ORIGIN,
]);

// Pure — no Deno reference — so it can be unit-tested under Node/Vitest
// without a Deno runtime (see allowedOrigins.test.ts). The env value is
// passed in rather than read here.
//
// Deliberately exact-hostname matching only: PLATFORM_HOSTNAMES is a
// comma-separated list of literal admin hostnames (e.g.
// "commerce.melosoftapp.com,admin-staging.melosoftapp.com"), never a
// wildcard/pattern. Any entry containing `*` is dropped rather than
// added, so a misconfigured secret can never turn this into a
// storefront-wide allow-list.
export function computeAllowedOrigins(platformHostnamesEnv: string | null | undefined): Set<string> {
  const origins = new Set(STATIC_ALLOWED_ORIGINS);
  for (const raw of (platformHostnamesEnv ?? '').split(',')) {
    const normalized = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (normalized && !normalized.includes('*')) {
      origins.add(`https://${normalized}`);
    }
  }
  return origins;
}

export function getAllowedOrigins(): Set<string> {
  return computeAllowedOrigins(Deno.env.get('PLATFORM_HOSTNAMES'));
}

export function getCorsHeaders(req: Request, methods = 'POST, OPTIONS'): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = getAllowedOrigins().has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Used to build safe redirect URLs (e.g. invite emails): echoes the
// caller's Origin only if it's on the allow-list, otherwise falls back
// to DEFAULT_APP_ORIGIN — never the raw, unvalidated Origin header.
export function resolveAppOrigin(req: Request): string {
  const origin = req.headers.get('Origin') ?? '';
  return getAllowedOrigins().has(origin) ? origin : DEFAULT_APP_ORIGIN;
}
