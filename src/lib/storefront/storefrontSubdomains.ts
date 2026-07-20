export const RESERVED_STOREFRONT_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'blog',
  'cdn',
  'dashboard',
  'docs',
  'help',
  'mail',
  'static',
  'status',
  'store',
  'stores',
  'support',
  'www',
]);

export const STOREFRONT_SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

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

export function isValidStorefrontSubdomain(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return STOREFRONT_SUBDOMAIN_PATTERN.test(normalized) &&
    !RESERVED_STOREFRONT_SUBDOMAINS.has(normalized);
}
