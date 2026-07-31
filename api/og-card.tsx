import { ImageResponse } from '@vercel/og';
import { resolveSeoDocument } from './_lib/storefrontSeo.js';

// @vercel/og 1.x uses its WebAssembly renderer on Vercel's Edge runtime.
export const config = { runtime: 'edge' };

function priceLabel(value: number | null, currency: string): string | null {
  if (value === null) return null;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('es-CO')}`;
  }
}

function fallbackCard(): ImageResponse {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#111827', color: '#ffffff', fontSize: 64, fontWeight: 800,
    }}>
      Melosoft Commerce
    </div>,
    { width: 1200, height: 630 },
  );
}

export default async function handler(request: Request): Promise<Response> {
  try {
    const document = await resolveSeoDocument(request);
    if (!document) return fallbackCard() as unknown as Response;

    const price = priceLabel(document.price, document.currency);
    const isProduct = document.kind === 'product' || document.kind === 'offer';

    return new ImageResponse(
      <div style={{
        width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden',
        background: document.backgroundColor, color: '#111827',
      }}>
        <div style={{
          width: isProduct ? '58%' : '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '62px 64px', position: 'relative', zIndex: 2,
          background: isProduct
            ? `linear-gradient(90deg, ${document.backgroundColor} 0%, ${document.backgroundColor} 84%, transparent 100%)`
            : `linear-gradient(135deg, ${document.backgroundColor} 0%, #ffffff 100%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 74, height: 74, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#ffffff', borderRadius: 18, overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
            }}>
              <img src={document.logoUrl} alt="" width="74" height="74" style={{ objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: '#334155' }}>
              {document.storeName}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {document.categoryName ? (
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: document.accentColor }}>
                {document.categoryName}
              </div>
            ) : null}
            <div style={{
              display: 'flex', fontSize: document.heading.length > 48 ? 50 : 62, fontWeight: 900,
              lineHeight: 1.04, letterSpacing: '-2px', maxHeight: 205, overflow: 'hidden',
            }}>
              {document.heading}
            </div>
            <div style={{
              display: 'flex', fontSize: 25, lineHeight: 1.35, color: '#475569', maxHeight: 72, overflow: 'hidden',
            }}>
              {document.description}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {price ? (
              <div style={{ display: 'flex', fontSize: 38, fontWeight: 900, color: document.accentColor }}>
                {price}
              </div>
            ) : (
              <div style={{ display: 'flex', fontSize: 25, fontWeight: 700, color: document.accentColor }}>
                Visítanos en línea
              </div>
            )}
          </div>
        </div>

        {isProduct ? (
          <div style={{
            position: 'absolute', right: 0, top: 0, width: '49%', height: '100%', display: 'flex',
            background: '#ffffff', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={document.imageUrl} alt="" width="588" height="630" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{
              position: 'absolute', left: 0, top: 0, width: 18, height: '100%', display: 'flex',
              background: document.accentColor,
            }} />
          </div>
        ) : (
          <div style={{
            position: 'absolute', right: 42, bottom: -70, width: 360, height: 360, display: 'flex',
            borderRadius: 999, background: document.accentColor, opacity: 0.12,
          }} />
        )}
      </div>,
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    ) as unknown as Response;
  } catch (error) {
    console.error('og-card failed', error instanceof Error ? error.message : error);
    return fallbackCard() as unknown as Response;
  }
}
