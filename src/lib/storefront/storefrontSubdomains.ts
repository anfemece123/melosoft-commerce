// Canonical reserved-word list for store slugs / storefront subdomains.
// Keep this Set identical to is_reserved_store_slug() in
// supabase/migrations/097_store_slug_availability.sql — the database is
// the enforced authority (CHECK constraint + RPC); this copy only drives
// instant client-side feedback (Yup validation, host classification).
export const RESERVED_STOREFRONT_SUBDOMAINS = new Set([
  'admin',
  'administrator',
  'api',
  'app',
  'assets',
  'auth',
  'beta',
  'blog',
  'callback',
  'callbacks',
  'cdn',
  'commerce',
  'dashboard',
  'demo',
  'dev',
  'development',
  'docs',
  'email',
  'files',
  'ftp',
  'help',
  'localhost',
  'login',
  'logout',
  'mail',
  'media',
  'panel',
  'preview',
  'register',
  'signup',
  'soporte',
  'staging',
  'static',
  'status',
  'store',
  'stores',
  'supabase',
  'support',
  'test',
  'testing',
  'webhook',
  'webhooks',
  'www',
]);

export const STOREFRONT_SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
export const STOREFRONT_SUBDOMAIN_MIN_LENGTH = 2;
export const STOREFRONT_SUBDOMAIN_MAX_LENGTH = 60;
const ALL_NUMERIC_PATTERN = /^[0-9]+$/;

// Mirrors normalize_store_slug() in supabase/migrations/097_*.sql exactly
// (same accent map, same collapse-to-hyphen strategy) so a slug typed in
// the superadmin form and the value the database ultimately enforces
// never disagree. Any character outside the accent map that isn't
// a-z0-9 is treated identically by both sides: collapsed into a hyphen.
const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ñ: 'n', ç: 'c',
};

export function normalizeStorefrontSubdomain(raw: string): string {
  const mapped = raw
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => ACCENT_MAP[ch] ?? ch)
    .join('');
  return mapped
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isAllNumericStorefrontSubdomain(value: string): boolean {
  return ALL_NUMERIC_PATTERN.test(value);
}

export function isValidStorefrontSubdomain(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return STOREFRONT_SUBDOMAIN_PATTERN.test(normalized) &&
    !RESERVED_STOREFRONT_SUBDOMAINS.has(normalized);
}

export function normalizeStorefrontRootDomain(value: string | null | undefined): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^\*\./, '')
    .replace(/\.$/, '');
  return normalized || null;
}
