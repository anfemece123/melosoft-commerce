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
    return JSON.parse(raw) as PublicStorePage;
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
