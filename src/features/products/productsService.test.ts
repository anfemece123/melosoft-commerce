import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { productsService } from './productsService';

describe('productsService.reorderProductImages', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('persists the complete gallery order', async () => {
    rpcMock.mockResolvedValue({ data: undefined, error: null });

    await productsService.reorderProductImages('product-1', ['image-3', 'image-1', 'image-2']);

    expect(rpcMock).toHaveBeenCalledWith('reorder_product_images', {
      p_product_id: 'product-1',
      p_image_ids: ['image-3', 'image-1', 'image-2'],
    });
  });

  it('surfaces database errors', async () => {
    rpcMock.mockResolvedValue({ data: undefined, error: { message: 'Invalid image order' } });

    await expect(productsService.reorderProductImages('product-1', [])).rejects.toThrow(
      'Invalid image order'
    );
  });

  it('requests contextual cart upsells with deduplicated product ids', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await expect(productsService.getPublicCartUpsells('mi-restaurante', ['plato-1', 'plato-1'], 3))
      .resolves.toEqual([]);

    expect(rpcMock).toHaveBeenCalledWith('get_public_cart_upsells', {
      p_store_slug: 'mi-restaurante',
      p_product_ids: ['plato-1'],
      p_limit: 3,
    });
  });

  it('loads the home catalog with the same editorial order as the catalog page', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await expect(productsService.getPublicProductsByStoreSlug('mi-restaurante')).resolves.toEqual([]);

    expect(rpcMock).toHaveBeenCalledWith('public_catalog_search_page', {
      p_store_slug: 'mi-restaurante',
      p_category_slug: null,
      p_category_parent_id: null,
      p_subcategory_slug: null,
      p_collection_slug: null,
      p_query: null,
      p_only_featured: false,
      p_only_on_sale: false,
      p_sort_key: 'relevance',
      p_offset: 0,
      p_limit: 2_147_483_647,
    });
  });
});
