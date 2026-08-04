import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { catalogOrderingService } from './catalogOrderingService';

describe('catalogOrderingService', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('loads the general catalog in the position returned by the database', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { product_id: 'product-2', sort_order: 1 },
        { product_id: 'product-1', sort_order: 0 },
      ],
      error: null,
    });

    await expect(catalogOrderingService.getProductOrder('store-1', { type: 'catalog' }))
      .resolves.toEqual(['product-1', 'product-2']);

    expect(rpcMock).toHaveBeenCalledWith('get_store_catalog_product_order', {
      p_store_id: 'store-1',
      p_category_id: null,
      p_collection_id: null,
    });
  });

  it('persists an independent collection order', async () => {
    rpcMock.mockResolvedValue({ data: undefined, error: null });

    await catalogOrderingService.reorderProducts(
      'store-1',
      { type: 'collection', id: 'collection-1' },
      ['product-3', 'product-1'],
    );

    expect(rpcMock).toHaveBeenCalledWith('reorder_store_catalog_products', {
      p_store_id: 'store-1',
      p_product_ids: ['product-3', 'product-1'],
      p_category_id: null,
      p_collection_id: 'collection-1',
    });
  });

  it('persists category siblings separately by hierarchy level', async () => {
    rpcMock.mockResolvedValue({ data: undefined, error: null });

    await catalogOrderingService.reorderCategories(
      'store-1',
      'parent-1',
      ['category-2', 'category-1'],
    );

    expect(rpcMock).toHaveBeenCalledWith('reorder_store_product_categories', {
      p_store_id: 'store-1',
      p_category_ids: ['category-2', 'category-1'],
      p_parent_id: 'parent-1',
    });
  });

  it('explains a stale complete-order conflict in user-friendly language', async () => {
    rpcMock.mockResolvedValue({
      data: undefined,
      error: { message: 'CATALOG_ORDER_MUST_INCLUDE_EXACT_CONTEXT' },
    });

    await expect(catalogOrderingService.reorderProducts(
      'store-1',
      { type: 'category', id: 'category-1' },
      ['product-1'],
    )).rejects.toThrow('El catálogo cambió mientras lo ordenabas');
  });
});
