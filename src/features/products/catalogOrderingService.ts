import { supabase } from '@/lib/supabase';

export type CatalogOrderingContext =
  | { type: 'catalog'; id?: null }
  | { type: 'category'; id: string }
  | { type: 'collection'; id: string };

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

type UntypedRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
};

const rpcClient = supabase as unknown as UntypedRpcClient;

function contextArgs(context: CatalogOrderingContext): {
  p_category_id: string | null;
  p_collection_id: string | null;
} {
  return {
    p_category_id: context.type === 'category' ? context.id : null,
    p_collection_id: context.type === 'collection' ? context.id : null,
  };
}

function orderingError(message: string): Error {
  if (message.includes('MUST_INCLUDE_EXACT')) {
    return new Error('El catálogo cambió mientras lo ordenabas. Recarga la página e inténtalo nuevamente.');
  }
  if (message.includes('FORBIDDEN')) {
    return new Error('No tienes permiso para cambiar el orden del catálogo.');
  }
  return new Error(message);
}

export const catalogOrderingService = {
  async getProductOrder(storeId: string, context: CatalogOrderingContext): Promise<string[]> {
    const { data, error } = await rpcClient.rpc('get_store_catalog_product_order', {
      p_store_id: storeId,
      ...contextArgs(context),
    });
    if (error) throw orderingError(error.message);
    return ((data ?? []) as Array<{ product_id: string; sort_order: number }>)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => row.product_id);
  },

  async reorderProducts(
    storeId: string,
    context: CatalogOrderingContext,
    orderedProductIds: string[],
  ): Promise<void> {
    const { error } = await rpcClient.rpc('reorder_store_catalog_products', {
      p_store_id: storeId,
      p_product_ids: orderedProductIds,
      ...contextArgs(context),
    });
    if (error) throw orderingError(error.message);
  },

  async reorderCategories(storeId: string, parentId: string | null, orderedCategoryIds: string[]): Promise<void> {
    const { error } = await rpcClient.rpc('reorder_store_product_categories', {
      p_store_id: storeId,
      p_category_ids: orderedCategoryIds,
      p_parent_id: parentId,
    });
    if (error) throw orderingError(error.message);
  },
};
