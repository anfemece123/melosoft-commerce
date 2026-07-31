import { getRequestOrigin } from './_lib/storefrontSeo.js';

export default {
  fetch(request: Request): Response {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const body = `User-agent: *
Allow: /
Allow: /api/og-card
Disallow: /admin
Disallow: /login
Disallow: /auth/
Disallow: /set-password
Disallow: /access-denied
Disallow: /cart
Disallow: /checkout
Disallow: /payment-result
Disallow: /s/*/cart
Disallow: /s/*/checkout
Disallow: /s/*/payment-result
Disallow: /api/

Sitemap: ${getRequestOrigin(request)}/sitemap.xml
`;
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  },
};
