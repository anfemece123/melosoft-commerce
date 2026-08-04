import { resolveSeoDocument } from './_lib/storefrontSeo.js';
import {
  fetchSocialImage,
  renderNeutralFallbackPng,
  renderSquareLogoPng,
  trustedSocialImageHosts,
} from './_lib/socialImage.js';

const FALLBACK_LOGO_PATH = '/branding/melosoft-mark.png';

async function renderSocialCard(request: Request): Promise<Uint8Array> {
  const trustedHosts = trustedSocialImageHosts(request);
  const document = await resolveSeoDocument(request);
  const requestedImageUrl = document && (document.kind === 'product' || document.kind === 'offer')
    ? document.imageUrl
    : (document?.logoUrl ?? new URL(FALLBACK_LOGO_PATH, request.url).toString());

  try {
    const image = await fetchSocialImage(requestedImageUrl, trustedHosts);
    return await renderSquareLogoPng(image);
  } catch (error) {
    console.error('preferred social card image failed', error instanceof Error ? error.message : error);
  }

  if (document?.logoUrl && document.logoUrl !== requestedImageUrl) {
    try {
      const logo = await fetchSocialImage(document.logoUrl, trustedHosts);
      return await renderSquareLogoPng(logo);
    } catch (error) {
      console.error('store logo social card fallback failed', error instanceof Error ? error.message : error);
    }
  }

  try {
    const fallbackUrl = new URL(FALLBACK_LOGO_PATH, request.url).toString();
    const fallback = await fetchSocialImage(fallbackUrl, trustedHosts);
    return await renderSquareLogoPng(fallback);
  } catch (error) {
    console.error('fallback social card failed', error instanceof Error ? error.message : error);
    return renderNeutralFallbackPng();
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    try {
      const png = await renderSocialCard(request);
      const isHead = request.method === 'HEAD';
      const responseBody = new Uint8Array(png.byteLength);
      responseBody.set(png);
      return new Response(isHead ? null : responseBody.buffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(png.byteLength),
          'Cache-Control': isHead ? 'no-store' : 'public, max-age=31536000, immutable',
          ...(isHead ? {} : {
            'Vercel-CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
          }),
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      console.error('og-card failed', error instanceof Error ? error.message : error);
      return new Response('Social image temporarily unavailable', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': '60',
        },
      });
    }
  },
};
