import { describe, expect, it } from 'vitest';
import {
  RESERVED_STOREFRONT_SUBDOMAINS,
  STOREFRONT_SUBDOMAIN_MAX_LENGTH,
  STOREFRONT_SUBDOMAIN_MIN_LENGTH,
  STOREFRONT_SUBDOMAIN_PATTERN,
  isAllNumericStorefrontSubdomain,
  isValidStorefrontSubdomain,
  normalizeStorefrontRootDomain,
  normalizeStorefrontSubdomain,
} from './storefrontSubdomains';

describe('normalizeStorefrontSubdomain', () => {
  it('lowercases and hyphenates a normal name', () => {
    expect(normalizeStorefrontSubdomain('Centriparts Colombia')).toBe('centriparts-colombia');
  });

  it('strips accents and converts ñ/ç', () => {
    expect(normalizeStorefrontSubdomain('Café Ñoño S.A.')).toBe('cafe-nono-s-a');
  });

  it('collapses repeated separators and symbols into a single hyphen', () => {
    expect(normalizeStorefrontSubdomain('  Hola   ---  Mundo!!  ')).toBe('hola-mundo');
  });

  it('strips leading and trailing hyphens', () => {
    expect(normalizeStorefrontSubdomain('---tienda---')).toBe('tienda');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeStorefrontSubdomain('   ')).toBe('');
  });

  it('returns an empty string for symbols-only input', () => {
    expect(normalizeStorefrontSubdomain('¡¡¡###!!!')).toBe('');
  });

  it('is idempotent — normalizing an already-normal slug is a no-op', () => {
    expect(normalizeStorefrontSubdomain('centriparts-colombia')).toBe('centriparts-colombia');
  });

  it('every output satisfies the DNS-safe pattern once non-empty', () => {
    const cases = ['Tienda_Con_Guion_Bajo!!', '  múltiples   ESPACIOS  ', 'a---b--c'];
    for (const input of cases) {
      const normalized = normalizeStorefrontSubdomain(input);
      if (normalized) expect(STOREFRONT_SUBDOMAIN_PATTERN.test(normalized)).toBe(true);
    }
  });
});

describe('isAllNumericStorefrontSubdomain', () => {
  it('flags a purely numeric slug', () => {
    expect(isAllNumericStorefrontSubdomain('12345')).toBe(true);
  });

  it('does not flag a slug with any letter', () => {
    expect(isAllNumericStorefrontSubdomain('tienda-2')).toBe(false);
  });
});

describe('reserved words include the admin panel subdomain', () => {
  it('reserves "commerce" — the exact host the admin panel uses', () => {
    expect(RESERVED_STOREFRONT_SUBDOMAINS.has('commerce')).toBe(true);
  });

  it('rejects "commerce" as a valid store subdomain', () => {
    expect(isValidStorefrontSubdomain('commerce')).toBe(false);
  });

  it('still accepts a normal, non-reserved slug', () => {
    expect(isValidStorefrontSubdomain('padel-shop')).toBe(true);
  });
});

describe('length bounds', () => {
  it('matches the DB constraint bounds (2–60)', () => {
    expect(STOREFRONT_SUBDOMAIN_MIN_LENGTH).toBe(2);
    expect(STOREFRONT_SUBDOMAIN_MAX_LENGTH).toBe(60);
  });
});

describe('normalizeStorefrontRootDomain', () => {
  it('strips protocol, path, wildcard prefix and trailing dot', () => {
    expect(normalizeStorefrontRootDomain('https://*.melosoftapp.com/')).toBe('melosoftapp.com');
  });

  it('returns null for empty input', () => {
    expect(normalizeStorefrontRootDomain('')).toBeNull();
    expect(normalizeStorefrontRootDomain(undefined)).toBeNull();
  });
});
