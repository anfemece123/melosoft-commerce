import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSeoDocument } from './storefrontSeo';

const storeRow = {
  store_id: 'store-1',
  store_slug: 'cafe-central',
  store_name: 'Café Central',
  slogan: 'Café colombiano',
  description: 'El mejor café de la ciudad.',
  logo_url: 'https://cdn.example.com/logo.png',
  favicon_url: null,
  hero_image_url: 'https://cdn.example.com/hero.jpg',
  hero_background_image_url: null,
  country: 'CO',
  city: 'Bogotá',
  currency: 'COP',
  carta_enabled: false,
  primary_color: '#7c3aed',
  background_color: '#fafafa',
};

const productRow = {
  store_slug: 'cafe-central',
  store_name: 'Café Central',
  logo_url: 'https://cdn.example.com/logo.png',
  product_id: 'product-1',
  product_slug: 'cafe-especial',
  product_name: 'Café especial',
  description: 'Café de origen con notas de chocolate.',
  short_description: 'Café de origen colombiano.',
  regular_price: 30000,
  sale_price: 25000,
  stock: 8,
  track_inventory: true,
  is_available: true,
  main_image_url: 'https://cdn.example.com/product.jpg',
  category_name: 'Café',
  product_created_at: '2026-07-01T12:00:00.000Z',
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('storefront SEO resolver', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://commerce.melosoftapp.com');
    vi.stubEnv('VITE_STOREFRONT_ROOT_DOMAIN', 'melosoftapp.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('builds product metadata, canonical URL and structured data for legacy store links', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/rpc/resolve_store_domain')) return json([]);
      if (url.pathname.endsWith('/public_store_pages')) return json([storeRow]);
      if (url.pathname.endsWith('/public_product_pages')) return json([productRow]);
      throw new Error(`Unexpected request: ${url}`);
    }));

    const request = new Request(
      'https://commerce.melosoftapp.com/api/storefront-preview?storeSlug=cafe-central&routePath=/p/cafe-especial',
    );
    const document = await resolveSeoDocument(request);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('Café especial | Café Central');
    expect(document?.canonicalUrl).toBe('https://cafe-central.melosoftapp.com/p/cafe-especial');
    expect(document?.price).toBe(25000);
    expect(document?.available).toBe(true);
    expect(document?.ogImageUrl).toContain('/api/og-card?');
    expect(document?.structuredData[0]).toMatchObject({
      '@type': 'Product',
      name: 'Café especial',
      offers: { priceCurrency: 'COP', price: '25000.00' },
    });
  });

  it('builds branded metadata and an OG card for the main store link', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/rpc/resolve_store_domain')) return json([]);
      if (url.pathname.endsWith('/public_store_pages')) return json([storeRow]);
      if (url.pathname.endsWith('/public_product_pages')) return json([]);
      throw new Error(`Unexpected request: ${url}`);
    }));

    const request = new Request(
      'https://commerce.melosoftapp.com/api/storefront-preview?storeSlug=cafe-central&routePath=/',
    );
    const document = await resolveSeoDocument(request);
    const ogImageUrl = new URL(document?.ogImageUrl ?? 'https://invalid.example');

    expect(document).not.toBeNull();
    expect(document?.kind).toBe('store');
    expect(document?.heading).toBe('Café Central');
    expect(document?.description).toBe('El mejor café de la ciudad.');
    expect(document?.canonicalUrl).toBe('https://cafe-central.melosoftapp.com');
    expect(ogImageUrl.pathname).toBe('/api/og-card');
    expect(ogImageUrl.searchParams.get('storeSlug')).toBe('cafe-central');
    expect(ogImageUrl.searchParams.get('routePath')).toBe('/');
    expect(ogImageUrl.searchParams.get('v')).toBeTruthy();
  });

  it('keeps a verified custom hostname as the canonical origin', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/rpc/resolve_store_domain')) {
        return json([{ store_slug: 'cafe-central' }]);
      }
      if (url.pathname.endsWith('/public_store_pages')) return json([storeRow]);
      if (url.pathname.endsWith('/public_product_pages')) return json([productRow]);
      throw new Error(`Unexpected request: ${url}`);
    }));

    const request = new Request(
      'https://cafe.example.com/api/storefront-preview?routePath=/p/cafe-especial',
    );
    const document = await resolveSeoDocument(request);

    expect(document?.canonicalUrl).toBe('https://cafe.example.com/p/cafe-especial');
    expect(document?.canonicalBaseUrl).toBe('https://cafe.example.com');
  });
});
