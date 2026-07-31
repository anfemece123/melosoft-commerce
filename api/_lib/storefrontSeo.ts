const DEFAULT_DESCRIPTION = 'Compra en línea de forma fácil y segura.';
const DEFAULT_BRAND_IMAGE_PATH = '/branding/melosoft-mark.png';
const OG_CARD_LAYOUT_VERSION = 'stacked-v3';
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const RESERVED_SUBDOMAINS = new Set([
  'admin', 'api', 'app', 'assets', 'auth', 'beta', 'blog', 'cdn', 'commerce',
  'dashboard', 'demo', 'dev', 'docs', 'help', 'login', 'mail', 'media', 'panel',
  'preview', 'staging', 'static', 'status', 'store', 'stores', 'support', 'test',
  'vercel', 'www',
]);

export interface StoreSeoRow {
  store_id: string;
  store_slug: string;
  store_name: string;
  slogan: string | null;
  description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  hero_image_url: string | null;
  hero_background_image_url: string | null;
  country: string;
  city: string | null;
  currency: string;
  carta_enabled: boolean;
  primary_color: string | null;
  background_color: string | null;
}

export interface ProductSeoRow {
  store_slug: string;
  store_name: string;
  logo_url: string | null;
  product_id: string;
  product_slug: string;
  product_name: string;
  description: string;
  short_description: string | null;
  regular_price: number;
  sale_price: number | null;
  stock: number;
  track_inventory: boolean;
  is_available: boolean;
  main_image_url: string | null;
  category_name: string | null;
  product_created_at: string;
}

interface OfferSeoRow {
  store_slug: string;
  offer_slug: string;
  title: string;
  subtitle: string | null;
  offer_price: number;
  regular_price: number;
  hero_image_url: string | null;
  product_name: string | null;
  product_main_image_url: string | null;
}

interface ProductLinkRow {
  product_slug: string;
  product_name: string;
}

interface DomainResolutionRow {
  store_slug: string;
}

export type SeoPageKind = 'store' | 'catalog' | 'carta' | 'policies' | 'product' | 'offer';

export interface SeoDocument {
  kind: SeoPageKind;
  storeSlug: string;
  storeName: string;
  title: string;
  heading: string;
  description: string;
  canonicalUrl: string;
  canonicalBaseUrl: string;
  imageUrl: string;
  logoUrl: string;
  ogImageUrl: string;
  accentColor: string;
  backgroundColor: string;
  currency: string;
  price: number | null;
  available: boolean | null;
  categoryName: string | null;
  productLinks: ProductLinkRow[];
  structuredData: Record<string, unknown>[];
}

export interface SitemapEntry {
  page_type: SeoPageKind;
  store_slug: string;
  page_slug: string | null;
  canonical_hostname: string | null;
  last_modified: string;
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY') ?? env('VITE_SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL/SUPABASE_ANON_KEY (or their VITE_ equivalents).');
  }
  return { url: url.replace(/\/$/, ''), anonKey };
}

async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase REST ${response.status}: ${detail}`);
  }
  return response.json() as Promise<T>;
}

async function selectRows<T>(
  resource: string,
  select: string,
  filters: Record<string, string> = {},
  options: { order?: string; limit?: number; offset?: number } = {},
): Promise<T[]> {
  const params = new URLSearchParams({ select });
  for (const [key, value] of Object.entries(filters)) params.set(key, `eq.${value}`);
  if (options.order) params.set('order', options.order);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  return supabaseRequest<T[]>(`${resource}?${params.toString()}`);
}

async function selectAllRows<T>(
  resource: string,
  select: string,
  filters: Record<string, string> = {},
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 49_000; offset += pageSize) {
    const page = await selectRows<T>(resource, select, filters, { limit: pageSize, offset });
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  return supabaseRequest<T>(`rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function rpcAllRows<T>(name: string, body: Record<string, unknown>): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 49_000; offset += pageSize) {
    const page = await supabaseRequest<T[]>(`rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Range: `${offset}-${offset + pageSize - 1}`,
      },
      body: JSON.stringify(body),
    });
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export function normalizeHostname(raw: string): string {
  return raw.trim().toLowerCase().split(':')[0].replace(/\.$/, '');
}

function normalizeSlug(raw: string | null): string | null {
  const slug = raw?.trim().toLowerCase() ?? '';
  return SLUG_PATTERN.test(slug) ? slug : null;
}

function normalizeRoutePath(raw: string | null): string {
  const path = raw?.trim() || '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host') || url.host;
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || url.protocol.replace(':', '') || 'https';
  return `${protocol}://${host}`.replace(/\/$/, '');
}

function storefrontRootDomain(): string | null {
  const value = env('STOREFRONT_ROOT_DOMAIN') ?? env('VITE_STOREFRONT_ROOT_DOMAIN');
  return value ? normalizeHostname(value.replace(/^https?:\/\//, '').split('/')[0]) : null;
}

function publicSiteUrl(request: Request): string {
  const configured = env('PUBLIC_SITE_URL') ?? env('VITE_PUBLIC_SITE_URL');
  return (configured || getRequestOrigin(request)).replace(/\/$/, '');
}

function storeSlugFromSubdomain(hostname: string): string | null {
  const rootDomain = storefrontRootDomain();
  if (!rootDomain || !hostname.endsWith(`.${rootDomain}`)) return null;
  const candidate = hostname.slice(0, -(rootDomain.length + 1));
  if (candidate.includes('.') || RESERVED_SUBDOMAINS.has(candidate)) return null;
  return normalizeSlug(candidate);
}

async function resolveCustomDomainSlug(hostname: string): Promise<string | null> {
  try {
    const rows = await rpc<DomainResolutionRow[]>('resolve_store_domain', { p_hostname: hostname });
    return normalizeSlug(rows[0]?.store_slug ?? null);
  } catch {
    return null;
  }
}

export async function resolveStoreSlugForHost(hostname: string): Promise<string | null> {
  return storeSlugFromSubdomain(hostname) ?? resolveCustomDomainSlug(hostname);
}

function routeDetails(routePath: string): { kind: SeoPageKind; pageSlug: string | null } {
  const productMatch = routePath.match(/^\/p\/([^/?#]+)/);
  if (productMatch) return { kind: 'product', pageSlug: normalizeSlug(productMatch[1]) };
  const offerMatch = routePath.match(/^\/o\/([^/?#]+)/);
  if (offerMatch) return { kind: 'offer', pageSlug: normalizeSlug(offerMatch[1]) };
  if (routePath === '/catalog' || routePath.startsWith('/catalog?')) return { kind: 'catalog', pageSlug: null };
  if (routePath === '/carta' || routePath.startsWith('/carta?')) return { kind: 'carta', pageSlug: null };
  if (routePath === '/policies' || routePath.startsWith('/policies?')) return { kind: 'policies', pageSlug: null };
  return { kind: 'store', pageSlug: null };
}

function cleanText(value: string | null | undefined, fallback = DEFAULT_DESCRIPTION): string {
  const text = (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return fallback;
  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
}

function absoluteUrl(value: string | null | undefined, origin: string): string {
  if (!value) return `${origin}${DEFAULT_BRAND_IMAGE_PATH}`;
  try {
    return new URL(value, origin).toString();
  } catch {
    return `${origin}${DEFAULT_BRAND_IMAGE_PATH}`;
  }
}

function safeColor(value: string | null | undefined, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? '') ? value as string : fallback;
}

function canonicalBaseUrl(
  request: Request,
  storeSlug: string,
  routeWasLegacy: boolean,
  hostStoreSlug: string | null,
): string {
  const requestOrigin = getRequestOrigin(request);
  if (!routeWasLegacy && hostStoreSlug === storeSlug) return requestOrigin;

  const rootDomain = storefrontRootDomain();
  if (rootDomain) return `https://${storeSlug}.${rootDomain}`;
  return `${publicSiteUrl(request)}/s/${storeSlug}`;
}

function childUrl(baseUrl: string, suffix: string): string {
  return `${baseUrl.replace(/\/$/, '')}${suffix}`;
}

function stableVersion(...parts: Array<string | number | null | undefined>): string {
  let hash = 2166136261;
  for (const character of parts.join('|')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildOgImageUrl(
  request: Request,
  storeSlug: string,
  routePath: string,
  versionParts: Array<string | number | null | undefined>,
): string {
  const params = new URLSearchParams({
    storeSlug,
    routePath,
    v: stableVersion(OG_CARD_LAYOUT_VERSION, ...versionParts),
  });
  return `${getRequestOrigin(request)}/api/og-card?${params.toString()}`;
}

function productPrice(row: ProductSeoRow): number {
  const regularPrice = Number(row.regular_price);
  const salePrice = row.sale_price === null ? null : Number(row.sale_price);
  return salePrice !== null && salePrice >= 0 && salePrice < regularPrice ? salePrice : regularPrice;
}

async function getStore(storeSlug: string): Promise<StoreSeoRow | null> {
  const rows = await selectRows<StoreSeoRow>(
    'public_store_pages',
    'store_id,store_slug,store_name,slogan,description,logo_url,favicon_url,hero_image_url,hero_background_image_url,country,city,currency,carta_enabled,primary_color,background_color',
    { store_slug: storeSlug },
    { limit: 1 },
  );
  return rows[0] ?? null;
}

async function getProduct(storeSlug: string, productSlug: string): Promise<ProductSeoRow | null> {
  const rows = await selectRows<ProductSeoRow>(
    'public_product_pages',
    'store_slug,store_name,logo_url,product_id,product_slug,product_name,description,short_description,regular_price,sale_price,stock,track_inventory,is_available,main_image_url,category_name,product_created_at',
    { store_slug: storeSlug, product_slug: productSlug },
    { limit: 1 },
  );
  return rows[0] ?? null;
}

async function getOffer(storeSlug: string, offerSlug: string): Promise<OfferSeoRow | null> {
  const rows = await selectRows<OfferSeoRow>(
    'public_store_campaign_offers',
    'store_slug,offer_slug,title,subtitle,offer_price,regular_price,hero_image_url,product_name,product_main_image_url',
    { store_slug: storeSlug, offer_slug: offerSlug },
    { limit: 1 },
  );
  return rows[0] ?? null;
}

async function getProductLinks(storeSlug: string): Promise<ProductLinkRow[]> {
  return selectRows<ProductLinkRow>(
    'public_product_pages',
    'product_slug,product_name',
    { store_slug: storeSlug },
    { order: 'product_name.asc', limit: 60 },
  );
}

function storeStructuredData(store: StoreSeoRow, canonicalUrl: string, imageUrl: string): Record<string, unknown>[] {
  const organization: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: store.store_name,
    url: canonicalUrl,
    description: cleanText(store.description || store.slogan),
    logo: imageUrl,
  };
  if (store.city || store.country) {
    organization.address = {
      '@type': 'PostalAddress',
      addressLocality: store.city || undefined,
      addressCountry: store.country,
    };
  }
  return [
    organization,
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: store.store_name,
      url: canonicalUrl,
    },
  ];
}

export async function resolveSeoDocument(request: Request): Promise<SeoDocument | null> {
  const requestUrl = new URL(request.url);
  const hostname = normalizeHostname(requestUrl.hostname);
  const requestedRoutePath = normalizeRoutePath(requestUrl.searchParams.get('routePath'));
  const legacyMatch = requestedRoutePath.match(/^\/s\/([^/]+)(\/.*)?$/);
  const routePath = legacyMatch ? (legacyMatch[2] || '/') : requestedRoutePath;
  const explicitStoreSlug = normalizeSlug(requestUrl.searchParams.get('storeSlug'));
  const legacyStoreSlug = normalizeSlug(legacyMatch?.[1] ?? null);
  const hostStoreSlug = storeSlugFromSubdomain(hostname) ?? await resolveCustomDomainSlug(hostname);
  const storeSlug = explicitStoreSlug
    ?? legacyStoreSlug
    ?? hostStoreSlug;
  if (!storeSlug) return null;

  const store = await getStore(storeSlug);
  if (!store) return null;

  const { kind, pageSlug } = routeDetails(routePath);
  const baseUrl = canonicalBaseUrl(
    request,
    storeSlug,
    Boolean(legacyMatch || explicitStoreSlug && requestedRoutePath.startsWith('/s/')),
    hostStoreSlug,
  );
  const normalizedSuffix = routePath === '/' ? '' : routePath.split('?')[0].replace(/\/$/, '');
  const canonicalUrl = childUrl(baseUrl, normalizedSuffix);
  const fallbackImage = absoluteUrl(
    store.hero_image_url || store.hero_background_image_url || store.logo_url,
    getRequestOrigin(request),
  );
  const logoUrl = absoluteUrl(store.logo_url, getRequestOrigin(request));
  const accentColor = safeColor(store.primary_color, '#4f46e5');
  const backgroundColor = safeColor(store.background_color, '#f7f8fc');

  if (kind === 'product') {
    if (!pageSlug) return null;
    const product = await getProduct(storeSlug, pageSlug);
    if (!product) return null;
    const price = productPrice(product);
    const available = product.is_available && (!product.track_inventory || product.stock > 0);
    const description = cleanText(product.short_description || product.description, `Conoce ${product.product_name} en ${store.store_name}.`);
    const imageUrl = absoluteUrl(product.main_image_url || product.logo_url || store.logo_url, getRequestOrigin(request));
    const title = `${product.product_name} | ${store.store_name}`;
    return {
      kind,
      storeSlug,
      storeName: store.store_name,
      title,
      heading: product.product_name,
      description,
      canonicalUrl,
      canonicalBaseUrl: baseUrl,
      imageUrl,
      logoUrl,
      ogImageUrl: buildOgImageUrl(request, storeSlug, `/p/${pageSlug}`, [title, description, imageUrl, price]),
      accentColor,
      backgroundColor,
      currency: store.currency,
      price,
      available,
      categoryName: product.category_name,
      productLinks: [],
      structuredData: [{
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.product_name,
        description,
        image: [imageUrl],
        category: product.category_name || undefined,
        brand: { '@type': 'Brand', name: store.store_name },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: store.currency,
          price: price.toFixed(2),
          availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
      }],
    };
  }

  if (kind === 'offer') {
    if (!pageSlug) return null;
    const offer = await getOffer(storeSlug, pageSlug);
    if (!offer) return null;
    const description = cleanText(offer.subtitle, `Oferta especial de ${store.store_name}.`);
    const imageUrl = absoluteUrl(
      offer.hero_image_url || offer.product_main_image_url || store.logo_url,
      getRequestOrigin(request),
    );
    const price = Number(offer.offer_price);
    const title = `${offer.title} | ${store.store_name}`;
    return {
      kind,
      storeSlug,
      storeName: store.store_name,
      title,
      heading: offer.title,
      description,
      canonicalUrl,
      canonicalBaseUrl: baseUrl,
      imageUrl,
      logoUrl,
      ogImageUrl: buildOgImageUrl(request, storeSlug, `/o/${pageSlug}`, [title, description, imageUrl, price]),
      accentColor,
      backgroundColor,
      currency: store.currency,
      price,
      available: true,
      categoryName: null,
      productLinks: [],
      structuredData: [{
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: offer.product_name || offer.title,
        description,
        image: [imageUrl],
        brand: { '@type': 'Brand', name: store.store_name },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: store.currency,
          price: price.toFixed(2),
          availability: 'https://schema.org/InStock',
        },
      }],
    };
  }

  const descriptions: Record<Exclude<SeoPageKind, 'product' | 'offer'>, string> = {
    store: cleanText(store.description || store.slogan, `${store.store_name} — tienda en línea.`),
    catalog: `Explora el catálogo de productos de ${store.store_name}.`,
    carta: `Consulta la carta digital de ${store.store_name}.`,
    policies: `Conoce las políticas de compra de ${store.store_name}.`,
  };
  const headings: Record<Exclude<SeoPageKind, 'product' | 'offer'>, string> = {
    store: store.store_name,
    catalog: `Catálogo de ${store.store_name}`,
    carta: `Carta digital de ${store.store_name}`,
    policies: `Políticas de ${store.store_name}`,
  };
  const pageTitle = kind === 'store' ? store.store_name : `${headings[kind]} | ${store.store_name}`;
  const productLinks = kind === 'store' || kind === 'catalog' ? await getProductLinks(storeSlug) : [];
  return {
    kind,
    storeSlug,
    storeName: store.store_name,
    title: pageTitle,
    heading: headings[kind],
    description: descriptions[kind],
    canonicalUrl,
    canonicalBaseUrl: baseUrl,
    imageUrl: fallbackImage,
    logoUrl,
    ogImageUrl: buildOgImageUrl(request, storeSlug, routePath, [pageTitle, descriptions[kind], fallbackImage]),
    accentColor,
    backgroundColor,
    currency: store.currency,
    price: null,
    available: null,
    categoryName: null,
    productLinks,
    structuredData: storeStructuredData(store, childUrl(baseUrl, ''), fallbackImage),
  };
}

function fallbackLastModified(): string {
  return new Date().toISOString();
}

async function fallbackSitemapEntries(storeSlug: string | null): Promise<SitemapEntry[]> {
  const storeFilters: Record<string, string> = storeSlug ? { store_slug: storeSlug } : {};
  const [stores, products, offers, cartaRows] = await Promise.all([
    selectAllRows<{ store_slug: string }>('public_store_pages', 'store_slug', storeFilters),
    selectAllRows<{ store_slug: string; product_slug: string; product_created_at: string }>(
      'public_product_pages',
      'store_slug,product_slug,product_created_at',
      storeFilters,
    ),
    selectAllRows<{ store_slug: string; offer_slug: string }>(
      'public_store_campaign_offers',
      'store_slug,offer_slug',
      storeFilters,
    ),
    selectAllRows<{ store_slug: string }>('public_carta_pages', 'store_slug', storeFilters),
  ]);
  const now = fallbackLastModified();
  const cartaSlugs = new Set(cartaRows.map((row) => row.store_slug));
  return [
    ...stores.map((row): SitemapEntry => ({
      page_type: 'store', store_slug: row.store_slug, page_slug: null, canonical_hostname: null, last_modified: now,
    })),
    ...products.map((row): SitemapEntry => ({
      page_type: 'product', store_slug: row.store_slug, page_slug: row.product_slug, canonical_hostname: null,
      last_modified: row.product_created_at || now,
    })),
    ...offers.map((row): SitemapEntry => ({
      page_type: 'offer', store_slug: row.store_slug, page_slug: row.offer_slug, canonical_hostname: null, last_modified: now,
    })),
    ...Array.from(cartaSlugs).map((slug): SitemapEntry => ({
      page_type: 'carta', store_slug: slug, page_slug: null, canonical_hostname: null, last_modified: now,
    })),
  ];
}

export async function getSitemapEntries(storeSlug: string | null): Promise<SitemapEntry[]> {
  try {
    return await rpcAllRows<SitemapEntry>('get_public_sitemap_entries', { p_store_slug: storeSlug });
  } catch {
    // Keeps sitemap.xml operational during the short deployment window before
    // migration 131 is applied. The RPC supplies accurate lastmod/custom-domain
    // data once available; public views remain a safe read-only fallback.
    return fallbackSitemapEntries(storeSlug);
  }
}

export function getCanonicalBaseForSitemap(
  request: Request,
  entry: SitemapEntry,
  requestedStoreSlug: string | null,
): string {
  if (requestedStoreSlug) return getRequestOrigin(request);
  if (entry.canonical_hostname) return `https://${normalizeHostname(entry.canonical_hostname)}`;
  const rootDomain = storefrontRootDomain();
  if (rootDomain) return `https://${entry.store_slug}.${rootDomain}`;
  return `${publicSiteUrl(request)}/s/${entry.store_slug}`;
}
