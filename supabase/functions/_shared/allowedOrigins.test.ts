import { describe, expect, it } from 'vitest';
import { computeAllowedOrigins, DEFAULT_APP_ORIGIN } from './allowedOrigins.ts';

// Only computeAllowedOrigins is tested here — it's the pure half of this
// module (no Deno reference), so it runs under Vitest/Node exactly like
// it runs under the Deno edge runtime. getAllowedOrigins/getCorsHeaders/
// resolveAppOrigin all call Deno.env.get and can only run under `deno
// test`/the deployed function itself.
describe('computeAllowedOrigins', () => {
  it('always includes localhost:5173, localhost:5174, and the platform origin', () => {
    const origins = computeAllowedOrigins(undefined);
    expect(origins.has('http://localhost:5173')).toBe(true);
    expect(origins.has('http://localhost:5174')).toBe(true);
    expect(origins.has(DEFAULT_APP_ORIGIN)).toBe(true);
    expect(origins.size).toBe(3);
  });

  it('treats null/empty PLATFORM_HOSTNAMES the same as undefined', () => {
    expect(computeAllowedOrigins(null).size).toBe(3);
    expect(computeAllowedOrigins('').size).toBe(3);
  });

  it('adds each extra hostname from PLATFORM_HOSTNAMES as https://', () => {
    const origins = computeAllowedOrigins('admin-staging.melosoftapp.com');
    expect(origins.has('https://admin-staging.melosoftapp.com')).toBe(true);
    expect(origins.size).toBe(4);
  });

  it('normalizes case, whitespace, protocol prefix, and trailing slash', () => {
    const origins = computeAllowedOrigins('  HTTPS://Admin-Staging.MelosoftApp.com/ ');
    expect(origins.has('https://admin-staging.melosoftapp.com')).toBe(true);
  });

  it('supports multiple comma-separated hostnames', () => {
    const origins = computeAllowedOrigins('admin-staging.melosoftapp.com,internal.melosoftapp.com');
    expect(origins.has('https://admin-staging.melosoftapp.com')).toBe(true);
    expect(origins.has('https://internal.melosoftapp.com')).toBe(true);
    expect(origins.size).toBe(5);
  });

  it('never allows a storefront host to slip in via a wildcard entry', () => {
    const origins = computeAllowedOrigins('*.melosoftapp.com');
    expect(origins.has('https://*.melosoftapp.com')).toBe(false);
    for (const origin of origins) {
      expect(origin.includes('*')).toBe(false);
    }
    expect(origins.size).toBe(3);
  });

  it('never allows a bare wildcard entry', () => {
    const origins = computeAllowedOrigins('*');
    expect(origins.size).toBe(3);
  });

  it('ignores blank entries produced by stray commas', () => {
    const origins = computeAllowedOrigins(',admin-staging.melosoftapp.com,,');
    expect(origins.size).toBe(4);
  });
});
