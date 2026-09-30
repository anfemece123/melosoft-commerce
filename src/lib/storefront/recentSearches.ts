const MAX_RECENT_SEARCHES = 5;

function storageKey(storeSlug: string): string {
  return `melosoft_recent_searches_${storeSlug}`;
}

/** Per-shopper convenience only: storage may be unavailable (private
 * mode, blocked cookies) and then the list is simply empty. */
export function readRecentSearches(storeSlug: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(storeSlug));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '').slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(storeSlug: string, query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return readRecentSearches(storeSlug);
  const next = [
    trimmed,
    ...readRecentSearches(storeSlug).filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_RECENT_SEARCHES);
  try {
    window.localStorage.setItem(storageKey(storeSlug), JSON.stringify(next));
  } catch {
    // Storage unavailable — the search itself still works.
  }
  return next;
}

export function clearRecentSearches(storeSlug: string): void {
  try {
    window.localStorage.removeItem(storageKey(storeSlug));
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
