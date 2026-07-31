import {
  getCanonicalBaseForSitemap,
  getSitemapEntries,
  normalizeHostname,
  resolveStoreSlugForHost,
  type SitemapEntry,
} from './_lib/storefrontSeo.js';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function entryPath(entry: SitemapEntry): string {
  switch (entry.page_type) {
    case 'product': return `/p/${entry.page_slug}`;
    case 'offer': return `/o/${entry.page_slug}`;
    case 'catalog': return '/catalog';
    case 'carta': return '/carta';
    case 'policies': return '/policies';
    default: return '';
  }
}

function validLastModified(value: string): string | null {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    try {
      const hostname = normalizeHostname(new URL(request.url).hostname);
      const requestedStoreSlug = await resolveStoreSlugForHost(hostname);
      const allEntries = await getSitemapEntries(requestedStoreSlug);
      // A central sitemap may cross-submit only verified sites. Custom domains
      // belong in their own /sitemap.xml (referenced by their own robots.txt),
      // not in the melosoftapp.com property where ownership is not guaranteed.
      const entries = requestedStoreSlug
        ? allEntries
        : allEntries.filter((entry) => !entry.canonical_hostname);
      const seen = new Set<string>();
      const urls: string[] = [];

      for (const entry of entries.slice(0, 49_000)) {
        const location = `${getCanonicalBaseForSitemap(request, entry, requestedStoreSlug)}${entryPath(entry)}`;
        if (seen.has(location)) continue;
        seen.add(location);
        const lastModified = validLastModified(entry.last_modified);
        urls.push(
          `  <url>\n    <loc>${escapeXml(location)}</loc>${lastModified ? `\n    <lastmod>${lastModified}</lastmod>` : ''}\n  </url>`,
        );
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
      return new Response(request.method === 'HEAD' ? null : xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      console.error('sitemap failed', error instanceof Error ? error.message : error);
      return new Response('Sitemap temporarily unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' },
      });
    }
  },
};
