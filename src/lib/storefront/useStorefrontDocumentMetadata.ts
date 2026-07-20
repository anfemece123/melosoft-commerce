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

export function useStorefrontDocumentMetadata(
  storeName: string | null | undefined,
  faviconUrl: string | null | undefined,
  logoUrl: string | null | undefined,
) {
  useEffect(() => {
    const normalizedStoreName = storeName?.trim();
    if (!normalizedStoreName) return;

    const favicon = ensureFaviconLink();
    const previousTitle = document.title;
    const previousFaviconHref = favicon.getAttribute('href');
    const previousFaviconType = favicon.getAttribute('type');

    document.title = normalizedStoreName;
    favicon.href = faviconUrl || logoUrl || DEFAULT_FAVICON_URL;
    favicon.removeAttribute('type');

    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      favicon.href = previousFaviconHref || DEFAULT_FAVICON_URL;
      if (previousFaviconType) favicon.type = previousFaviconType;
      else favicon.removeAttribute('type');
    };
  }, [faviconUrl, logoUrl, storeName]);
}
