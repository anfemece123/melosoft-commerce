import { ImageResponse } from '@vercel/og';
import { resolveSeoDocument } from './_lib/storefrontSeo.js';

// @vercel/og 1.x uses its WebAssembly renderer on Vercel's Edge runtime.
export const config = { runtime: 'edge' };

const ITEM_IMAGE_SIZE = 390;
const BRAND_IMAGE_SIZE = 320;

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
    const isCommerceItem = document.kind === 'product' || document.kind === 'offer';
    const isBrandPage = document.kind === 'store' || document.kind === 'carta';
    const card = isCommerceItem ? (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', background: document.backgroundColor, color: '#111827',
      }}>
        <div style={{
          width: '100%', height: 390, display: 'flex', alignItems: 'center',
          justifyContent: 'center', overflow: 'hidden', background: '#ffffff',
        }}>
          <img
            src={document.imageUrl}
            alt=""
            width={ITEM_IMAGE_SIZE}
            height={ITEM_IMAGE_SIZE}
            style={{
              width: ITEM_IMAGE_SIZE,
              height: ITEM_IMAGE_SIZE,
              objectFit: 'contain',
            }}
          />
        </div>

        <div style={{
          width: '100%', height: 240, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 42, padding: '30px 52px 32px',
          borderTop: `10px solid ${document.accentColor}`,
          background: document.backgroundColor,
        }}>
          <div style={{
            minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', gap: 10,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              fontSize: 19, fontWeight: 700, color: document.accentColor,
            }}>
              <img
                src={document.logoUrl}
                alt=""
                width="34"
                height="34"
                style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 8 }}
              />
              {document.storeName}
              {document.categoryName ? ` · ${document.categoryName}` : ''}
            </div>
            <div style={{
              display: 'flex', fontSize: document.heading.length > 58 ? 34 : 41,
              fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1px',
              maxHeight: 88, overflow: 'hidden',
            }}>
              {document.heading}
            </div>
            <div style={{
              display: 'flex', fontSize: 21, lineHeight: 1.25,
              color: '#475569', maxHeight: 54, overflow: 'hidden',
            }}>
              {document.description}
            </div>
          </div>

          {price ? (
            <div style={{
              display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'center',
              padding: '16px 24px', borderRadius: 18, background: document.accentColor,
              color: '#ffffff', fontSize: 32, fontWeight: 900,
            }}>
              {price}
            </div>
          ) : null}
        </div>
      </div>
    ) : isBrandPage ? (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', background: document.backgroundColor, color: '#111827',
      }}>
        <div style={{
          width: '100%', height: 390, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '42px 90px', background: '#ffffff',
        }}>
          <img
            src={document.logoUrl}
            alt=""
            width={BRAND_IMAGE_SIZE}
            height={BRAND_IMAGE_SIZE}
            style={{
              width: BRAND_IMAGE_SIZE,
              height: BRAND_IMAGE_SIZE,
              objectFit: 'contain',
            }}
          />
        </div>

        <div style={{
          width: '100%', height: 240, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 40, padding: '35px 58px',
          borderTop: `10px solid ${document.accentColor}`,
          background: document.backgroundColor,
        }}>
          <div style={{
            minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', gap: 14,
          }}>
            <div style={{
              display: 'flex', fontSize: document.heading.length > 54 ? 39 : 47,
              fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1px',
              maxHeight: 100, overflow: 'hidden',
            }}>
              {document.heading}
            </div>
            <div style={{
              display: 'flex', fontSize: 24, lineHeight: 1.3,
              color: '#475569', maxHeight: 64, overflow: 'hidden',
            }}>
              {document.description}
            </div>
          </div>
          <div style={{
            display: 'flex', flexShrink: 0, padding: '14px 22px', borderRadius: 16,
            background: document.accentColor, color: '#ffffff',
            fontSize: 23, fontWeight: 800,
          }}>
            {document.kind === 'carta' ? 'Ver carta' : 'Visitar tienda'}
          </div>
        </div>
      </div>
    ) : (
      <div style={{
        width: '100%', height: '100%', display: 'flex', position: 'relative',
        overflow: 'hidden', background: document.backgroundColor, color: '#111827',
      }}>
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '62px 64px', position: 'relative',
          zIndex: 2, background: `linear-gradient(135deg, ${document.backgroundColor} 0%, #ffffff 100%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 74, height: 74, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: '#ffffff', borderRadius: 18,
              overflow: 'hidden', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
            }}>
              <img src={document.logoUrl} alt="" width="74" height="74" style={{ objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: '#334155' }}>
              {document.storeName}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{
              display: 'flex', fontSize: document.heading.length > 48 ? 50 : 62,
              fontWeight: 900, lineHeight: 1.04, letterSpacing: '-2px',
              maxHeight: 205, overflow: 'hidden',
            }}>
              {document.heading}
            </div>
            <div style={{
              display: 'flex', fontSize: 25, lineHeight: 1.35,
              color: '#475569', maxHeight: 72, overflow: 'hidden',
            }}>
              {document.description}
            </div>
          </div>

          <div style={{
            display: 'flex', fontSize: 25, fontWeight: 700, color: document.accentColor,
          }}>
            Visítanos en línea
          </div>
        </div>
        <div style={{
          position: 'absolute', right: 42, bottom: -70, width: 360, height: 360,
          display: 'flex', borderRadius: 999, background: document.accentColor, opacity: 0.12,
        }} />
      </div>
    );

    return new ImageResponse(
      card,
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
