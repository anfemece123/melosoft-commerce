import { useEffect } from 'react';

const DEFAULT_TITLE = 'Melosoft Commerce';
const DEFAULT_FAVICON_URL = '/branding/melosoft-mark.png';

interface PageMetadataOptions {
  title: string | null | undefined;
  description?: string | null;
  canonicalUrl?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  type?: 'website' | 'product';
  price?: number | null;
  currency?: string | null;
}

interface MetaSnapshot {
  element: HTMLMetaElement;
  previousContent: string | null;
  existed: boolean;
}

function findFaviconLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel="icon"]');
}

function ensureFaviconLink(): HTMLLinkElement {
  const existing = findFaviconLink();
  if (existing) return existing;

  const link = document.createElement('link');
  link.rel = 'icon';
  document.head.appendChild(link);
  return link;
}

function ensureLinkTag(rel: string): { element: HTMLLinkElement; existed: boolean } {
  const existing = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (existing) return { element: existing, existed: true };
  const link = document.createElement('link');
  link.rel = rel;
  document.head.appendChild(link);
  return { element: link, existed: false };
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string): MetaSnapshot {
  const existing = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const element = existing ?? document.createElement('meta');
  if (!existing) {
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  const snapshot = {
    element,
    previousContent: element.getAttribute('content'),
    existed: Boolean(existing),
  };
  element.setAttribute('content', content);
  return snapshot;
}

function restoreMetaTag(snapshot: MetaSnapshot): void {
  if (!snapshot.existed) {
    snapshot.element.remove();
  } else if (snapshot.previousContent !== null) {
    snapshot.element.setAttribute('content', snapshot.previousContent);
  } else {
    snapshot.element.removeAttribute('content');
  }
}

/**
 * Overrides metadata for a concrete storefront page (for example a product).
 * Vercel supplies the same data server-side to crawlers; this hook keeps the
 * browser tab/history and client-side navigation consistent for real users.
 */
export function useStorefrontPageDocumentMetadata({
  title,
  description,
  canonicalUrl,
  imageUrl,
  siteName,
  type = 'website',
  price,
  currency,
}: PageMetadataOptions): void {
  useEffect(() => {
    const normalizedTitle = title?.trim();
    if (!normalizedTitle) return;

    const resolvedDescription = description?.trim() || `${normalizedTitle} — tienda en línea.`;
    const previousTitle = document.title;
    const snapshots: MetaSnapshot[] = [
      setMetaTag('name', 'description', resolvedDescription),
      setMetaTag('property', 'og:locale', 'es_CO'),
      setMetaTag('property', 'og:title', normalizedTitle),
      setMetaTag('property', 'og:description', resolvedDescription),
      setMetaTag('property', 'og:type', type),
      setMetaTag('name', 'twitter:card', 'summary_large_image'),
      setMetaTag('name', 'twitter:title', normalizedTitle),
      setMetaTag('name', 'twitter:description', resolvedDescription),
    ];
    if (siteName?.trim()) snapshots.push(setMetaTag('property', 'og:site_name', siteName.trim()));
    if (canonicalUrl) snapshots.push(setMetaTag('property', 'og:url', canonicalUrl));
    if (imageUrl) {
      snapshots.push(setMetaTag('property', 'og:image', imageUrl));
      snapshots.push(setMetaTag('property', 'og:image:secure_url', imageUrl));
      snapshots.push(setMetaTag('name', 'twitter:image', imageUrl));
    }
    if (type === 'product' && price !== null && price !== undefined && currency) {
      snapshots.push(setMetaTag('property', 'product:price:amount', price.toFixed(2)));
      snapshots.push(setMetaTag('property', 'product:price:currency', currency));
    }

    const canonicalSnapshot = ensureLinkTag('canonical');
    const previousCanonicalHref = canonicalSnapshot.element.getAttribute('href');
    if (canonicalUrl) canonicalSnapshot.element.setAttribute('href', canonicalUrl);

    document.title = normalizedTitle;
    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      for (const snapshot of snapshots.reverse()) restoreMetaTag(snapshot);
      if (!canonicalSnapshot.existed) canonicalSnapshot.element.remove();
      else if (previousCanonicalHref !== null) canonicalSnapshot.element.setAttribute('href', previousCanonicalHref);
      else canonicalSnapshot.element.removeAttribute('href');
    };
  }, [canonicalUrl, currency, description, imageUrl, price, siteName, title, type]);
}

// Sets the storefront-wide base metadata. Nested product/offer pages can
// temporarily override it through useStorefrontPageDocumentMetadata.
export function useStorefrontDocumentMetadata(
  storeName: string | null | undefined,
  faviconUrl: string | null | undefined,
  logoUrl: string | null | undefined,
  description?: string | null,
  canonicalUrl?: string | null,
) {
  const normalizedStoreName = storeName?.trim() || null;
  useStorefrontPageDocumentMetadata({
    title: normalizedStoreName,
    description,
    canonicalUrl,
    imageUrl: logoUrl || faviconUrl,
    siteName: normalizedStoreName,
    type: 'website',
  });

  useEffect(() => {
    if (!normalizedStoreName) return;
    const favicon = ensureFaviconLink();
    const previousFaviconHref = favicon.getAttribute('href');
    const previousFaviconType = favicon.getAttribute('type');
    favicon.href = faviconUrl || logoUrl || DEFAULT_FAVICON_URL;
    favicon.removeAttribute('type');

    return () => {
      favicon.href = previousFaviconHref || DEFAULT_FAVICON_URL;
      if (previousFaviconType) favicon.type = previousFaviconType;
      else favicon.removeAttribute('type');
    };
  }, [faviconUrl, logoUrl, normalizedStoreName]);
}
