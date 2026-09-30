import { supabase } from '@/lib/supabase';
import { mapProductSearchSuggestions } from './productSearch.mapper';
import type { ProductSearchSuggestions } from './productSearch.types';

type RpcResult = { data: unknown; error: { message: string } | null };

// public_catalog_suggest is not in the generated Database types yet.
type UntypedAbortableRpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => {
    abortSignal: (signal: AbortSignal) => PromiseLike<RpcResult>;
  };
};

const rpcClient = supabase as unknown as UntypedAbortableRpcClient;

export const productSearchService = {
  /** Live suggestions for the storefront search box. `signal` cancels the
   * request when the shopper keeps typing. */
  async getSuggestions(
    storeSlug: string,
    query: string,
    limit: number,
    signal: AbortSignal,
  ): Promise<ProductSearchSuggestions> {
    const { data, error } = await rpcClient
      .rpc('public_catalog_suggest', { p_store_slug: storeSlug, p_query: query, p_limit: limit })
      .abortSignal(signal);
    if (error) throw new Error(error.message);
    return mapProductSearchSuggestions(data);
  },
};
