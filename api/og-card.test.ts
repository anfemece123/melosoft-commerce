import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { SeoDocument } from './_lib/storefrontSeo';

vi.mock('./_lib/storefrontSeo.js', () => ({
  resolveSeoDocument: vi.fn(),
}));

import ogCardHandler from './og-card';
import { resolveSeoDocument } from './_lib/storefrontSeo.js';

const documentWithWebpLogo = {
  logoUrl: 'https://project.supabase.co/storage/v1/object/public/store-assets/logo.webp',
} as SeoDocument;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('og-card endpoint', () => {
  it('returns a non-empty 1200x1200 PNG when the company logo is WebP', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.mocked(resolveSeoDocument).mockResolvedValue(documentWithWebpLogo);
    const webpLogo = await sharp({
      create: {
        width: 500,
        height: 250,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 },
      },
    }).webp().toBuffer();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(webpLogo), {
      status: 200,
      headers: { 'Content-Type': 'image/webp', 'Content-Length': String(webpLogo.byteLength) },
    })));

    const response = await ogCardHandler.fetch(new Request(
      'https://demo.melosoftapp.com/api/og-card?storeSlug=demo&routePath=%2F&v=logo-v1',
    ));
    const body = new Uint8Array(await response.arrayBuffer());
    const metadata = await sharp(body).metadata();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(Number(response.headers.get('content-length'))).toBe(body.byteLength);
    expect(body.byteLength).toBeGreaterThan(1_000);
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(1200);
  });

  it('keeps HEAD responses out of cache so they cannot poison the GET image', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.mocked(resolveSeoDocument).mockResolvedValue(documentWithWebpLogo);
    const logo = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 20, g: 20, b: 20 },
      },
    }).png().toBuffer();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(logo), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    })));

    const response = await ogCardHandler.fetch(new Request(
      'https://demo.melosoftapp.com/api/og-card?storeSlug=demo&routePath=%2F&v=logo-v1',
      { method: 'HEAD' },
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(Number(response.headers.get('content-length'))).toBeGreaterThan(1_000);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });
});
