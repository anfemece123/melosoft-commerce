import { useEffect, useState } from 'react';
import { normalizeSearchText } from '@/lib/storefront/searchText';
import { productSearchService } from './productSearchService';
import type { ProductSearchSuggestions } from './productSearch.types';

export const MIN_SEARCH_LENGTH = 2;
// Aborting a fetch doesn't stop the SQL already running, so fewer requests
// while typing keeps the database free for the query that matters.
const DEBOUNCE_MS = 200;
const SUGGESTION_LIMIT = 6;
const CACHE_SIZE = 60;

// Shared by every search box on the page (desktop + mobile header) and
// kept across navigations: going back to a previous query is instant and
// never re-hits the database.
const cache = new Map<string, ProductSearchSuggestions>();

function remember(key: string, data: ProductSearchSuggestions) {
  cache.delete(key);
  cache.set(key, data);
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

interface FetchedResult {
  key: string;
  data: ProductSearchSuggestions | null;
  failed: boolean;
}

export interface ProductSearchSuggestionsState {
  /** True once the query is long enough to search. */
  active: boolean;
  loading: boolean;
  failed: boolean;
  /** Suggestions for the current query, or null while they load. */
  data: ProductSearchSuggestions | null;
  /** Last suggestions shown for an earlier query — kept on screen (dimmed)
   * while the new ones load, so the panel never flashes empty. */
  staleData: ProductSearchSuggestions | null;
}

/** Debounced, cancellable, cached live suggestions. Each keystroke aborts
 * the in-flight request; equivalent queries ("Perfumería" / "perfumeria")
 * share one cache entry. */
export function useProductSearchSuggestions(storeSlug: string, query: string, enabled: boolean): ProductSearchSuggestionsState {
  const normalized = normalizeSearchText(query);
  const key = `${storeSlug}::${normalized}`;
  const active = enabled && normalized.length >= MIN_SEARCH_LENGTH;
  const [result, setResult] = useState<FetchedResult | null>(null);

  useEffect(() => {
    if (!active || cache.has(key)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      productSearchService
        .getSuggestions(storeSlug, normalized, SUGGESTION_LIMIT, controller.signal)
        .then((data) => {
          remember(key, data);
          if (!controller.signal.aborted) setResult({ key, data, failed: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ key, data: null, failed: true });
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, key, normalized, storeSlug]);

  const cached = active ? cache.get(key) ?? null : null;
  const own = result?.key === key ? result : null;
  const data = cached ?? own?.data ?? null;
  const failed = !data && Boolean(own?.failed);
  const loading = active && !data && !failed;

  return {
    active,
    loading,
    failed,
    data,
    staleData: loading && result && result.key !== key ? result.data : null,
  };
}
