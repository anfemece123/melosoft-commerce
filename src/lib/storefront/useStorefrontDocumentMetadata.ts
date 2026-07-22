import { useEffect } from 'react';

const DEFAULT_TITLE = 'Melosoft Commerce';
const DEFAULT_FAVICON_URL = '/branding/melosoft-mark.png';

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

function ensureLinkTag(rel: string): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (existing) return existing;
  const link = document.createElement('link');
  link.rel = rel;
  document.head.appendChild(link);
  return link;
}

function ensureMetaTag(attr: 'name' | 'property', key: string): HTMLMetaElement {
  const existing = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (existing) return existing;
  const meta = document.createElement('meta');
  meta.setAttribute(attr, key);
  document.head.appendChild(meta);
  return meta;
}

// Sets tab title/favicon plus the canonical link and Open Graph tags for a
// storefront page. `canonicalUrl` must already be the single preferred
// public URL for this exact page (custom domain > subdomain > `/s/:slug`
// fallback — see domainsService.getStorePublicUrl) so /s/:slug and the
// subdomain never compete as duplicate content during the transition.
export function useStorefrontDocumentMetadata(
  storeName: string | null | undefined,
  faviconUrl: string | null | undefined,
  logoUrl: string | null | undefined,
  description?: string | null,
  canonicalUrl?: string | null,
) {
  useEffect(() => {
    const normalizedStoreName = storeName?.trim();
    if (!normalizedStoreName) return;

    const favicon = ensureFaviconLink();
    const canonical = ensureLinkTag('canonical');
    const metaDescription = ensureMetaTag('name', 'description');
    const ogTitle = ensureMetaTag('property', 'og:title');
    const ogDescription = ensureMetaTag('property', 'og:description');
    const ogType = ensureMetaTag('property', 'og:type');
    const ogUrl = ensureMetaTag('property', 'og:url');
    const ogImage = ensureMetaTag('property', 'og:image');

    const previousTitle = document.title;
    const previousFaviconHref = favicon.getAttribute('href');
    const previousFaviconType = favicon.getAttribute('type');
    const previousCanonicalHref = canonical.getAttribute('href');
    const previousDescription = metaDescription.getAttribute('content');
    const previousOgTitle = ogTitle.getAttribute('content');
    const previousOgDescription = ogDescription.getAttribute('content');
    const previousOgType = ogType.getAttribute('content');
    const previousOgUrl = ogUrl.getAttribute('content');
    const previousOgImage = ogImage.getAttribute('content');

    const resolvedDescription = description?.trim() || `${normalizedStoreName} — tienda en línea.`;
    const resolvedImage = logoUrl || faviconUrl || '';

    document.title = normalizedStoreName;
    favicon.href = faviconUrl || logoUrl || DEFAULT_FAVICON_URL;
    favicon.removeAttribute('type');
    metaDescription.setAttribute('content', resolvedDescription);
    ogTitle.setAttribute('content', normalizedStoreName);
    ogDescription.setAttribute('content', resolvedDescription);
    ogType.setAttribute('content', 'website');
    if (canonicalUrl) {
      canonical.setAttribute('href', canonicalUrl);
      ogUrl.setAttribute('content', canonicalUrl);
    }
    if (resolvedImage) ogImage.setAttribute('content', resolvedImage);
    else ogImage.removeAttribute('content');

    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      favicon.href = previousFaviconHref || DEFAULT_FAVICON_URL;
      if (previousFaviconType) favicon.type = previousFaviconType;
      else favicon.removeAttribute('type');

      if (previousCanonicalHref) canonical.setAttribute('href', previousCanonicalHref);
      else canonical.remove();
      if (previousDescription) metaDescription.setAttribute('content', previousDescription);
      else metaDescription.remove();
      if (previousOgTitle) ogTitle.setAttribute('content', previousOgTitle);
      else ogTitle.remove();
      if (previousOgDescription) ogDescription.setAttribute('content', previousOgDescription);
      else ogDescription.remove();
      if (previousOgType) ogType.setAttribute('content', previousOgType);
      else ogType.remove();
      if (previousOgUrl) ogUrl.setAttribute('content', previousOgUrl);
      else ogUrl.remove();
      if (previousOgImage) ogImage.setAttribute('content', previousOgImage);
      else ogImage.remove();
    };
  }, [canonicalUrl, description, faviconUrl, logoUrl, storeName]);
}
