import { resolveSeoDocument, type SeoDocument } from './_lib/storefrontSeo.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function formatPrice(value: number, currency: string): string {
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

function productLinks(document: SeoDocument): string {
  if (document.productLinks.length === 0) return '';
  const links = document.productLinks.map((product) => (
    `<li><a href="${escapeHtml(`${document.canonicalBaseUrl}/p/${product.product_slug}`)}">${escapeHtml(product.product_name)}</a></li>`
  )).join('');
  return `<nav aria-label="Productos"><h2>Productos</h2><ul>${links}</ul></nav>`;
}

function renderHtml(document: SeoDocument): string {
  const structuredData = document.structuredData
    .map((entry) => `<script type="application/ld+json">${safeJson(entry)}</script>`)
    .join('\n');
  const price = document.price === null
    ? ''
    : `<p class="price">${escapeHtml(formatPrice(document.price, document.currency))}</p>`;
  const availability = document.available === null
    ? ''
    : `<p>${document.available ? 'Disponible' : 'Agotado temporalmente'}</p>`;
  const productMeta = document.price === null ? '' : `
    <meta property="product:price:amount" content="${document.price.toFixed(2)}" />
    <meta property="product:price:currency" content="${escapeHtml(document.currency)}" />`;
  const storeUrl = escapeHtml(document.canonicalBaseUrl);
  const catalogUrl = escapeHtml(`${document.canonicalBaseUrl}/catalog`);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(document.title)}</title>
    <meta name="description" content="${escapeHtml(document.description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <link rel="canonical" href="${escapeHtml(document.canonicalUrl)}" />
    <meta property="og:locale" content="es_CO" />
    <meta property="og:site_name" content="${escapeHtml(document.storeName)}" />
    <meta property="og:type" content="${document.kind === 'product' || document.kind === 'offer' ? 'product' : 'website'}" />
    <meta property="og:title" content="${escapeHtml(document.title)}" />
    <meta property="og:description" content="${escapeHtml(document.description)}" />
    <meta property="og:url" content="${escapeHtml(document.canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(document.ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(document.ogImageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(document.heading)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(document.title)}" />
    <meta name="twitter:description" content="${escapeHtml(document.description)}" />
    <meta name="twitter:image" content="${escapeHtml(document.ogImageUrl)}" />${productMeta}
    ${structuredData}
    <style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:0;color:#172033;background:#f7f8fc}
      main{max-width:900px;margin:0 auto;padding:48px 24px}
      img{display:block;max-width:100%;max-height:520px;object-fit:contain;border-radius:20px;background:#fff}
      h1{font-size:clamp(2rem,5vw,4rem);line-height:1.05;margin:28px 0 12px}
      h2{margin-top:40px}.price{font-size:1.5rem;font-weight:700}
      p{font-size:1.05rem;line-height:1.7}a{color:#4f46e5}li{margin:.65rem 0}
    </style>
  </head>
  <body>
    <main>
      <img src="${escapeHtml(document.imageUrl)}" alt="${escapeHtml(document.heading)}" />
      <h1>${escapeHtml(document.heading)}</h1>
      <p>${escapeHtml(document.description)}</p>
      ${price}${availability}
      <p><a href="${storeUrl}">Ir a ${escapeHtml(document.storeName)}</a> · <a href="${catalogUrl}">Ver catálogo</a></p>
      ${productLinks(document)}
    </main>
  </body>
</html>`;
}

function notFoundHtml(): string {
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="robots" content="noindex, nofollow"><title>Página no encontrada</title></head><body><h1>Página no encontrada</h1></body></html>`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    try {
      const document = await resolveSeoDocument(request);
      if (!document) {
        return new Response(request.method === 'HEAD' ? null : notFoundHtml(), {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
        });
      }

      return new Response(request.method === 'HEAD' ? null : renderHtml(document), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      console.error('storefront-preview failed', error instanceof Error ? error.message : error);
      return new Response(request.method === 'HEAD' ? null : notFoundHtml(), {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          'Retry-After': '60',
        },
      });
    }
  },
};
