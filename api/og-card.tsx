import { ImageResponse } from '@vercel/og';
import { resolveSeoDocument } from './_lib/storefrontSeo.js';

// @vercel/og 1.x uses its WebAssembly renderer on Vercel's Edge runtime.
export const config = { runtime: 'edge' };

const SOCIAL_IMAGE_SIZE = 1200;

function squareImageResponse(imageUrl: string): ImageResponse {
  return new ImageResponse(
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      background: '#ffffff',
    }}>
      <img
        src={imageUrl}
        alt=""
        width={SOCIAL_IMAGE_SIZE}
        height={SOCIAL_IMAGE_SIZE}
        style={{
          width: SOCIAL_IMAGE_SIZE,
          height: SOCIAL_IMAGE_SIZE,
          objectFit: 'contain',
        }}
      />
    </div>,
    {
      width: SOCIAL_IMAGE_SIZE,
      height: SOCIAL_IMAGE_SIZE,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}

function fallbackCard(request: Request): ImageResponse {
  return squareImageResponse(new URL('/branding/melosoft-mark.png', request.url).toString());
}

export default async function handler(request: Request): Promise<Response> {
  try {
    const document = await resolveSeoDocument(request);
    if (!document) return fallbackCard(request) as unknown as Response;

    const imageUrl = document.kind === 'product' || document.kind === 'offer'
      ? document.imageUrl
      : document.logoUrl;

    return squareImageResponse(imageUrl) as unknown as Response;
  } catch (error) {
    console.error('og-card failed', error instanceof Error ? error.message : error);
    return fallbackCard(request) as unknown as Response;
  }
}
