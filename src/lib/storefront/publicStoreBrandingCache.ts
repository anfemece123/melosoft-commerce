import type { PublicStorePage } from '@/types/common.types';

const STORAGE_PREFIX = 'public-store-branding:';

function getStorageKey(storeSlug: string) {
  return `${STORAGE_PREFIX}${storeSlug}`;
}

export function readCachedPublicStoreBranding(storeSlug: string): PublicStorePage | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(getStorageKey(storeSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicStorePage;
    // Older cached storefront payloads predate the server-owned WhatsApp
    // requirement flag. Refetch them instead of briefly rendering checkout
    // as optional and correcting it a moment later.
    if (typeof parsed.whatsappOrderUpdatesRequired !== 'boolean') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedPublicStoreBranding(storeSlug: string, branding: PublicStorePage | null) {
  if (typeof window === 'undefined' || !branding) return;

  try {
    sessionStorage.setItem(getStorageKey(storeSlug), JSON.stringify(branding));
  } catch {
    // Ignore storage quota / serialization errors for public cache.
  }
}

export function clearCachedPublicStoreBranding(storeSlug: string) {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(getStorageKey(storeSlug));
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
}
