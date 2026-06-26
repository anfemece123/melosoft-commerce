const STORAGE_PREFIX = 'public-scroll:';

function getStorageKey(routeKey: string) {
  return `${STORAGE_PREFIX}${routeKey}`;
}

export function readPublicScrollPosition(routeKey: string): number {
  if (typeof window === 'undefined') return 0;

  try {
    const raw = sessionStorage.getItem(getStorageKey(routeKey));
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function writePublicScrollPosition(routeKey: string, scrollY: number) {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(getStorageKey(routeKey), String(Math.max(0, Math.round(scrollY))));
  } catch {
    // Ignore storage issues for scroll restoration.
  }
}
