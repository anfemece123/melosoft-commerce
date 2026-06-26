const STORAGE_PREFIX = 'public-page-cache:';

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function readPublicPageCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(storageKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writePublicPageCache<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    // Ignore quota issues for ephemeral public cache.
  }
}
