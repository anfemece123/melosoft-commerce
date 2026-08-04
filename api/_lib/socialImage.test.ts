import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import {
  fetchSocialImage,
  renderSquareLogoPng,
  SOCIAL_IMAGE_SIZE,
  trustedSocialImageHosts,
} from './socialImage';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('social image generation', () => {
  it('converts the WebP format uploaded by the app into a complete square PNG', async () => {
    const source = await sharp({
      create: {
        width: 600,
        height: 300,
        channels: 4,
        background: { r: 32, g: 90, b: 170, alpha: 0.8 },
      },
    }).webp().toBuffer();

    const result = await renderSquareLogoPng(source);
    const metadata = await sharp(result).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(SOCIAL_IMAGE_SIZE);
    expect(metadata.height).toBe(SOCIAL_IMAGE_SIZE);
    expect(result.byteLength).toBeGreaterThan(1_000);
  });

  it('only fetches images from the storefront or configured Supabase host', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    const request = new Request('https://demo.melosoftapp.com/api/og-card');
    const hosts = trustedSocialImageHosts(request);
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'image/webp' },
    }));

    await expect(fetchSocialImage(
      'https://project.supabase.co/storage/v1/object/public/assets/logo.webp',
      hosts,
      fetchMock,
    )).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await expect(fetchSocialImage(
      'https://untrusted.example.com/logo.webp',
      hosts,
      fetchMock,
    )).rejects.toThrow('Untrusted social image host');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
