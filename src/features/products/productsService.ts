import { supabase } from '@/lib/supabase';
import { assertImageReadyForUpload } from '@/lib/images/imageFile.utils';
import type {
  Product,
  ProductInsert,
  ProductUpdate,
  ProductImage,
  ProductVideo,
  ProductCountStats,
  ProductImageCandidatePage,
  ProductLinkOption,
} from './products.types';
import type { ProductFacetValue, ProductCollectionAssignment, PublicCatalogNavigationProduct, PublicProductImage, PublicProductPage } from '@/types/common.types';
import type { PublicProductImageRow, PublicProductPageRow } from '@/types/database.types';
import { reviewsService } from '@/features/reviews/reviewsService';
import {
  mapProductRowToProduct,
  mapProductInsertToRow,
  mapProductUpdateToRow,
  mapPublicProductPageRowToPublicProductPage,
  mapPublicCatalogNavigationProductRow,
  mapProductImageRowToProductImage,
  mapProductVideoRowToProductVideo,
} from './products.mapper';
import {
  PRODUCT_VIDEO_MAX_BYTES,
  PRODUCT_VIDEO_MAX_DURATION_SECONDS,
  PRODUCT_VIDEO_MAX_HEIGHT,
  PRODUCT_VIDEO_MAX_WIDTH,
  isProductVideoMimeType,
} from '@/lib/videos/videoFile.utils';

async function removeStorageFolderFiles(bucket: string, folder: string): Promise<void> {
  const { data: files, error: listError } = await supabase.storage.from(bucket).list(folder);
  if (listError) throw new Error(listError.message);

  const filePaths = (files ?? [])
    .filter((file) => file.name && file.name !== '.emptyFolderPlaceholder')
    .map((file) => `${folder}/${file.name}`);

  if (filePaths.length === 0) return;

  const { error: removeError } = await supabase.storage.from(bucket).remove(filePaths);
  if (removeError) throw new Error(removeError.message);
}

function snapshotContainsProduct(snapshot: unknown, productId: string): boolean {
  if (!Array.isArray(snapshot)) return false;

  return snapshot.some((item) => {
    if (!item || typeof item !== 'object') return false;
    return 'product_id' in item && item.product_id === productId;
  });
}

async function getOwnerId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

function mapPublicImageRow(row: PublicProductImageRow): PublicProductImage {
  return {
    imageUrl: row.image_url,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary ?? false,
  };
}

async function attachProductTaxonomy(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;

  const productIds = products.map((product) => product.id);

  const [productCollectionsResult, productFacetValuesResult] = await Promise.all([
    supabase
      .from('product_collections')
      .select('product_id, collection_id')
      .in('product_id', productIds),
    supabase
      .from('product_facet_values')
      .select('product_id, facet_value_id')
      .in('product_id', productIds),
  ]);

  if (productCollectionsResult.error) throw new Error(productCollectionsResult.error.message);
  if (productFacetValuesResult.error) throw new Error(productFacetValuesResult.error.message);

  const collectionIds = Array.from(new Set((productCollectionsResult.data ?? []).map((row) => row.collection_id)));
  const facetValueIds = Array.from(new Set((productFacetValuesResult.data ?? []).map((row) => row.facet_value_id)));

  const [resolvedCollectionsResult, resolvedFacetValuesResult] = await Promise.all([
    collectionIds.length > 0
      ? supabase
          .from('store_product_collections')
          .select('id, name, slug')
          .in('id', collectionIds)
      : Promise.resolve({ data: [], error: null }),
    facetValueIds.length > 0
      ? supabase
          .from('store_product_facet_values')
          .select('id, facet_id, value, slug')
          .in('id', facetValueIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (resolvedCollectionsResult.error) throw new Error(resolvedCollectionsResult.error.message);
  if (resolvedFacetValuesResult.error) throw new Error(resolvedFacetValuesResult.error.message);

  const facetIds = Array.from(new Set((resolvedFacetValuesResult.data ?? []).map((row) => row.facet_id)));
  const resolvedFacetsResult = facetIds.length > 0
    ? await supabase.from('store_product_facets').select('id, name, slug, input_type').in('id', facetIds)
    : { data: [], error: null };
  if (resolvedFacetsResult.error) throw new Error(resolvedFacetsResult.error.message);

  const collectionsById = new Map(
    (resolvedCollectionsResult.data ?? []).map((row) => [row.id, row])
  );
  const facetValuesById = new Map(
    (resolvedFacetValuesResult.data ?? []).map((row) => [row.id, row])
  );
  const facetsById = new Map(
    (resolvedFacetsResult.data ?? []).map((row) => [row.id, row])
  );

  const collectionsByProductId = new Map<string, ProductCollectionAssignment[]>();
  for (const row of (productCollectionsResult.data ?? [])) {
    const collection = collectionsById.get(row.collection_id);
    if (!collection) continue;
    const current = collectionsByProductId.get(row.product_id) ?? [];
    current.push({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
    });
    collectionsByProductId.set(row.product_id, current);
  }

  const facetsByProductId = new Map<string, ProductFacetValue[]>();
  for (const row of (productFacetValuesResult.data ?? [])) {
    const facetValue = facetValuesById.get(row.facet_value_id);
    const facet = facetValue ? facetsById.get(facetValue.facet_id) : null;
    if (!facetValue || !facet) continue;
    const current = facetsByProductId.get(row.product_id) ?? [];
    current.push({
      facetId: facet.id,
      facetName: facet.name,
      facetSlug: facet.slug,
      inputType: facet.input_type === 'multi_select' ? 'multi_select' : 'single_select',
      valueId: facetValue.id,
      value: facetValue.value,
      valueSlug: facetValue.slug,
    });
    facetsByProductId.set(row.product_id, current);
  }

  return products.map((product) => ({
    ...product,
    collections: collectionsByProductId.get(product.id) ?? [],
    facetValues: facetsByProductId.get(product.id) ?? [],
  }));
}

async function attachPublicImages(products: PublicProductPage[]): Promise<PublicProductPage[]> {
  if (products.length === 0) return products;

  const productIds = products.map((product) => product.productId);
  const { data, error } = await supabase
    .from('public_product_images')
    .select('product_id, image_url, alt_text, sort_order, is_primary')
    .in('product_id', productIds)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  const imageMap = new Map<string, PublicProductImage[]>();

  for (const row of (data ?? []) as PublicProductImageRow[]) {
    const current = imageMap.get(row.product_id) ?? [];
    current.push(mapPublicImageRow(row));
    imageMap.set(row.product_id, current);
  }

  return products.map((product) => {
    const images = imageMap.get(product.productId);
    if (images && images.length > 0) {
      return {
        ...product,
        images,
        mainImageUrl: images[0]?.imageUrl ?? product.mainImageUrl,
      };
    }
    return product;
  });
}

async function attachPublicStorefrontData(products: PublicProductPage[]): Promise<PublicProductPage[]> {
  const withImages = await attachPublicImages(products);
  const storeSlug = withImages[0]?.storeSlug;
  if (!storeSlug || withImages.length === 0) return withImages;
  try {
    const [config, summaries] = await Promise.all([
      reviewsService.getPublicConfig(storeSlug),
      reviewsService.getPublicSummaries(withImages.map((product) => product.productId)),
    ]);
    return withImages.map((product) => {
      const summary = summaries.get(product.productId);
      return {
        ...product,
        reviewsEnabled: config.mode === 'public',
        showRatingOnCards: config.mode === 'public' && config.showRatingOnCards,
        showProductReviews: config.mode === 'public' && config.showProductReviews,
        showReviewPhotos: config.mode === 'public' && config.showReviewPhotos,
        reviewAverage: summary?.averageRating ?? 0,
        reviewCount: summary?.reviewCount ?? 0,
        reviewDistribution: summary?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    });
  } catch {
    // Reviews are an enhancement and must never make the catalog unavailable.
    return withImages;
  }
}

interface PublicCatalogSearchParams {
  storeSlug: string;
  categorySlug?: string;
  categoryParentId?: string | null;
  subcategorySlug?: string;
  collectionSlug?: string;
  query?: string;
  onlyFeatured?: boolean;
  onlyOnSale?: boolean;
  sortKey?: 'relevance' | 'price_asc' | 'price_desc' | 'name_asc' | 'newest' | 'featured';
  offset: number;
  limit: number;
}

interface PublicCatalogBaseFilterParams {
  storeSlug: string;
  categorySlug?: string;
  categoryParentId?: string | null;
  subcategorySlug?: string;
  collectionSlug?: string;
  query?: string;
  onlyFeatured?: boolean;
  onlyOnSale?: boolean;
}

type UntypedRpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const rpcClient = supabase as unknown as UntypedRpcClient;

export const productsService = {
  async getProductLinkOptionsByStore(storeId: string): Promise<ProductLinkOption[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getProductsByStore(storeId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return attachProductTaxonomy((data ?? []).map(mapProductRowToProduct));
  },

  /** Lightweight product load for Carta's editor. Carta only needs the
   * base row (visibility, category, price and image); unrelated taxonomy
   * requests must never prevent its categories/products from rendering. */
  async getCartaProductsByStore(storeId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapProductRowToProduct);
  },

  async getCategoryImageCandidates(
    storeId: string,
    categoryIds: string[],
    options: { page: number; pageSize: number; search?: string },
  ): Promise<ProductImageCandidatePage> {
    const uniqueCategoryIds = Array.from(new Set(categoryIds.filter(Boolean)));
    if (uniqueCategoryIds.length === 0) return { items: [], total: 0 };

    const page = Math.max(0, Math.floor(options.page));
    const pageSize = Math.min(24, Math.max(1, Math.floor(options.pageSize)));
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('products')
      .select('id, name, main_image_url, category_id, status', { count: 'exact' })
      .eq('store_id', storeId)
      .in('category_id', uniqueCategoryIds)
      .neq('status', 'archived')
      .not('main_image_url', 'is', null)
      .order('name', { ascending: true })
      .range(from, to);

    const search = options.search?.trim();
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return {
      items: (data ?? [])
        .filter((row): row is typeof row & { main_image_url: string } => Boolean(row.main_image_url))
        .map((row) => ({
          productId: row.id,
          name: row.name,
          imageUrl: row.main_image_url,
          categoryId: row.category_id,
          status: row.status === 'draft' ? 'draft' : row.status === 'archived' ? 'archived' : 'active',
        })),
      total: count ?? 0,
    };
  },

  async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    const [product] = await attachProductTaxonomy([mapProductRowToProduct(data)]);
    return product ?? null;
  },

  async getPublicProductBySlug(storeSlug: string, productSlug: string): Promise<PublicProductPage | null> {
    const { data, error } = await supabase
      .from('public_product_pages')
      .select('*')
      .eq('store_slug', storeSlug)
      .eq('product_slug', productSlug)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    const mappedProduct = mapPublicProductPageRowToPublicProductPage(data);
    const [[product], productVideo] = await Promise.all([
      attachPublicStorefrontData([mappedProduct]),
      productsService.getPublicProductVideo(mappedProduct.productId),
    ]);
    if (!product) return null;
    product.productVideo = productVideo;
    return product;
  },

  async getPublicProductsByStoreSlug(storeSlug: string): Promise<PublicProductPage[]> {
    // Use the same server-side editorial ordering as StoreCatalogPage. This
    // keeps home-builder product sections and the full catalog consistent;
    // the intentionally unbounded limit preserves this method's existing
    // "load the complete public catalog" contract.
    const { data, error } = await rpcClient.rpc('public_catalog_search_page', {
      p_store_slug: storeSlug,
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
    if (error) throw new Error(error.message);
    return attachPublicStorefrontData(((data ?? []) as PublicProductPageRow[]).map(mapPublicProductPageRowToPublicProductPage));
  },

  /** Compact index for the persistent public header. Deliberately excludes
   * product copy, prices, media, modifiers and checkout settings. */
  async getPublicCatalogNavigationProducts(storeSlug: string): Promise<PublicCatalogNavigationProduct[]> {
    const { data, error } = await supabase
      .from('public_product_pages')
      .select('category_id, category_slug, category_parent_id, collections, facet_values, variant_options, variants')
      .eq('store_slug', storeSlug);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapPublicCatalogNavigationProductRow(row));
  },

  async getPublicCartUpsells(
    storeSlug: string,
    productIds: string[],
    limit = 3,
  ): Promise<Array<{ title: string; products: PublicProductPage[] }>> {
    if (productIds.length === 0) return [];
    const { data, error } = await rpcClient.rpc('get_public_cart_upsells', {
      p_store_slug: storeSlug,
      p_product_ids: Array.from(new Set(productIds)),
      p_limit: Math.min(6, Math.max(1, limit)),
    });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ rule_title?: string; product_data?: PublicProductPageRow }>;
    const productRows = rows
      .map((row) => row.product_data)
      .filter((row): row is PublicProductPageRow => Boolean(row));
    const products = await attachPublicStorefrontData(productRows.map(mapPublicProductPageRowToPublicProductPage));
    const productsById = new Map(products.map((product) => [product.productId, product]));
    const groups = new Map<string, PublicProductPage[]>();
    rows.forEach((row) => {
      const productId = row.product_data?.product_id;
      const product = productId ? productsById.get(productId) : null;
      if (!product) return;
      const title = row.rule_title?.trim() || 'Completa tu pedido';
      const current = groups.get(title) ?? [];
      current.push(product);
      groups.set(title, current);
    });
    return Array.from(groups, ([title, groupedProducts]) => ({ title, products: groupedProducts }));
  },

  async getPublicProductsPageByStoreSlug(
    storeSlug: string,
    offset: number,
    limit: number,
  ): Promise<{ products: PublicProductPage[]; totalCount: number }> {
    const from = Math.max(0, offset);
    const to = Math.max(from, from + Math.max(1, limit) - 1);

    const { data, error, count } = await supabase
      .from('public_product_pages')
      .select('*', { count: 'exact' })
      .eq('store_slug', storeSlug)
      .order('product_name', { ascending: true })
      .range(from, to);

    if (error) throw new Error(error.message);

    return {
      products: await attachPublicStorefrontData((data ?? []).map(mapPublicProductPageRowToPublicProductPage)),
      totalCount: count ?? 0,
    };
  },

  async searchPublicCatalogPage(params: PublicCatalogSearchParams): Promise<{ products: PublicProductPage[]; totalCount: number }> {
    const rpcArgs = {
      p_store_slug: params.storeSlug,
      p_category_slug: params.categorySlug || null,
      p_category_parent_id: params.categoryParentId || null,
      p_subcategory_slug: params.subcategorySlug || null,
      p_collection_slug: params.collectionSlug || null,
      p_query: params.query?.trim() || null,
      p_only_featured: params.onlyFeatured ?? false,
      p_only_on_sale: params.onlyOnSale ?? false,
      p_sort_key: params.sortKey ?? 'relevance',
      p_offset: params.offset,
      p_limit: params.limit,
    };

    const [pageResult, countResult] = await Promise.all([
      rpcClient.rpc('public_catalog_search_page', rpcArgs),
      rpcClient.rpc('public_catalog_search_count', {
        p_store_slug: rpcArgs.p_store_slug,
        p_category_slug: rpcArgs.p_category_slug,
        p_category_parent_id: rpcArgs.p_category_parent_id,
        p_subcategory_slug: rpcArgs.p_subcategory_slug,
        p_collection_slug: rpcArgs.p_collection_slug,
        p_query: rpcArgs.p_query,
        p_only_featured: rpcArgs.p_only_featured,
        p_only_on_sale: rpcArgs.p_only_on_sale,
      }),
    ]);

    if (pageResult.error) throw new Error(pageResult.error.message);
    if (countResult.error) throw new Error(countResult.error.message);

    const rows = (pageResult.data ?? []) as PublicProductPageRow[];
    return {
      products: await attachPublicStorefrontData(rows.map(mapPublicProductPageRowToPublicProductPage)),
      totalCount: Number(countResult.data ?? 0),
    };
  },

  async getPublicCatalogPriceBounds(params: PublicCatalogBaseFilterParams): Promise<{ min: number; max: number }> {
    const { data, error } = await rpcClient.rpc('public_catalog_search_price_bounds', {
      p_store_slug: params.storeSlug,
      p_category_slug: params.categorySlug || null,
      p_category_parent_id: params.categoryParentId || null,
      p_subcategory_slug: params.subcategorySlug || null,
      p_collection_slug: params.collectionSlug || null,
      p_query: params.query?.trim() || null,
      p_only_featured: params.onlyFeatured ?? false,
      p_only_on_sale: params.onlyOnSale ?? false,
    });

    if (error) throw new Error(error.message);

    const row = (Array.isArray(data) ? data[0] : data) as { min_price?: number | string | null; max_price?: number | string | null } | undefined;
    return {
      min: Number(row?.min_price ?? 0),
      max: Number(row?.max_price ?? 0),
    };
  },

  async countProductsByStore(storeId: string): Promise<ProductCountStats> {
    const { data, error } = await supabase
      .from('products')
      .select('status, is_available')
      .eq('store_id', storeId)
      .neq('status', 'archived');
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    return {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active' && r.is_available).length,
      drafts: rows.filter((r) => r.status === 'draft').length,
      unavailable: rows.filter((r) => r.status === 'active' && !r.is_available).length,
    };
  },

  async createProduct(payload: ProductInsert): Promise<Product> {
    const ownerId = await getOwnerId();
    const row = mapProductInsertToRow(payload, ownerId);
    const { data, error } = await supabase
      .from('products')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after insert');
    return mapProductRowToProduct(data);
  },

  async updateProduct(id: string, payload: ProductUpdate): Promise<Product> {
    const row = mapProductUpdateToRow(payload);
    const { data, error } = await supabase
      .from('products')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapProductRowToProduct(data);
  },

  /** Updates only the optional price used by Carta digital. The ecommerce
   * regular/sale prices are intentionally left untouched. */
  async updateProductCartaPrice(id: string, cartaPrice: number | null): Promise<Product> {
    return productsService.updateProduct(id, { cartaPrice });
  },

  /** Persists an explicit full order (drag-and-drop can move a product
   * more than one position at once) — assigns sort_order = index for
   * every id in `orderedIds`. */
  async reorderProducts(orderedIds: string[]): Promise<void> {
    const results = await Promise.all(
      orderedIds.map((id, index) => supabase.from('products').update({ sort_order: index }).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  },

  async publishProduct(id: string): Promise<Product> {
    return productsService.updateProduct(id, { status: 'active', isAvailable: true });
  },

  async toggleAvailability(id: string, isAvailable: boolean): Promise<Product> {
    return productsService.updateProduct(id, { isAvailable });
  },

  async archiveProduct(id: string): Promise<Product> {
    return productsService.updateProduct(id, { status: 'archived' });
  },

  async deleteProduct(id: string): Promise<void> {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, store_id, owner_id')
      .eq('id', id)
      .single();
    if (productError) throw new Error(productError.message);

    const { data: images, error: imagesError } = await supabase
      .from('product_images')
      .select('storage_path')
      .eq('product_id', id);
    if (imagesError) throw new Error(imagesError.message);

    const storagePaths = (images ?? [])
      .map((image) => image.storage_path)
      .filter((path): path is string => typeof path === 'string' && path.length > 0);

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from('store-assets').remove(storagePaths);
      if (storageError) throw new Error(storageError.message);
    }

    const { data: video, error: videoError } = await supabase
      .from('product_videos')
      .select('storage_path')
      .eq('product_id', id)
      .maybeSingle();
    if (videoError) throw new Error(videoError.message);
    if (video?.storage_path) {
      const { error: videoStorageError } = await supabase.storage
        .from('store-videos')
        .remove([video.storage_path]);
      if (videoStorageError) throw new Error(videoStorageError.message);
    }

    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('id')
      .eq('product_id', id);
    if (offersError) throw new Error(offersError.message);

    for (const offer of offers ?? []) {
      const { data: offerImages, error: offerImagesError } = await supabase
        .from('offer_images')
        .select('storage_path')
        .eq('offer_id', offer.id);
      if (offerImagesError) throw new Error(offerImagesError.message);

      const offerStoragePaths = (offerImages ?? [])
        .map((image) => image.storage_path)
        .filter((path): path is string => typeof path === 'string' && path.length > 0);

      if (offerStoragePaths.length > 0) {
        const { error: offerStorageError } = await supabase.storage.from('store-assets').remove(offerStoragePaths);
        if (offerStorageError) throw new Error(offerStorageError.message);
      }

      await removeStorageFolderFiles(
        'store-assets',
        `${product.owner_id}/stores/${product.store_id}/offers/${offer.id}`
      );
    }

    const { data: checkoutSessions, error: checkoutSessionsError } = await supabase
      .from('checkout_sessions')
      .select('id, items_snapshot')
      .is('order_id', null);
    if (checkoutSessionsError) throw new Error(checkoutSessionsError.message);

    const checkoutSessionIdsToDelete = (checkoutSessions ?? [])
      .filter((session) => snapshotContainsProduct(session.items_snapshot, id))
      .map((session) => session.id);

    if (checkoutSessionIdsToDelete.length > 0) {
      const { error: checkoutSessionsDeleteError } = await supabase
        .from('checkout_sessions')
        .delete()
        .in('id', checkoutSessionIdsToDelete);
      if (checkoutSessionsDeleteError) throw new Error(checkoutSessionsDeleteError.message);
    }

    const { error: offersDeleteError } = await supabase.from('offers').delete().eq('product_id', id);
    if (offersDeleteError) throw new Error(offersDeleteError.message);

    await removeStorageFolderFiles(
      'store-assets',
      `${product.owner_id}/stores/${product.store_id}/products/${product.id}`
    );

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getProductImages(productId: string): Promise<ProductImage[]> {
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .is('variant_id', null)
      .is('option_value_id', null)
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapProductImageRowToProductImage);
  },

  /** Loads each product's general gallery images in one query. Used by
   * visual builders such as Carta so their live preview has the same
   * primary-image fallback as the public storefront. */
  async getProductImagesByStore(storeId: string): Promise<ProductImage[]> {
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('store_id', storeId)
      .is('variant_id', null)
      .is('option_value_id', null)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapProductImageRowToProductImage);
  },

  async uploadProductImage(
    storeId: string,
    productId: string,
    file: File,
    sortOrder: number,
    isPrimary: boolean
  ): Promise<ProductImage> {
    assertImageReadyForUpload(file, 'product_image');
    const ownerId = await getOwnerId();
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const uuid = crypto.randomUUID();
    const storagePath = `${ownerId}/stores/${storeId}/products/${productId}/${uuid}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('store-assets')
      .upload(storagePath, file, { upsert: false, contentType: file.type, cacheControl: '31536000' });
    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from('store-assets')
      .getPublicUrl(storagePath);

    const { data, error } = await supabase
      .from('product_images')
      .insert({
        store_id: storeId,
        product_id: productId,
        owner_id: ownerId,
        image_url: publicUrl,
        storage_path: storagePath,
        sort_order: sortOrder,
        is_primary: isPrimary,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after image insert');
    return mapProductImageRowToProductImage(data);
  },

  async deleteProductImage(imageId: string, storagePath: string | null): Promise<void> {
    if (storagePath) {
      await supabase.storage.from('store-assets').remove([storagePath]);
    }
    const { error } = await supabase.from('product_images').delete().eq('id', imageId);
    if (error) throw new Error(error.message);
  },

  async getProductVideo(productId: string): Promise<ProductVideo | null> {
    const { data, error } = await supabase
      .from('product_videos')
      .select('*')
      .eq('product_id', productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapProductVideoRowToProductVideo(data) : null;
  },

  async uploadProductVideo(
    storeId: string,
    productId: string,
    file: File,
    metadata: { durationSeconds: number; width: number; height: number },
  ): Promise<ProductVideo> {
    if (!isProductVideoMimeType(file.type)) throw new Error('Usa un video MP4 o WebM.');
    if (file.size <= 0 || file.size > PRODUCT_VIDEO_MAX_BYTES) {
      throw new Error('El video supera el peso máximo permitido de 20 MB.');
    }
    if (
      metadata.durationSeconds <= 0
      || metadata.durationSeconds > PRODUCT_VIDEO_MAX_DURATION_SECONDS + 0.05
      || metadata.width <= 0
      || metadata.height <= 0
      || metadata.width > PRODUCT_VIDEO_MAX_WIDTH
      || metadata.height > PRODUCT_VIDEO_MAX_HEIGHT
    ) {
      throw new Error('El video no cumple los límites de duración o resolución.');
    }

    const ownerId = await getOwnerId();
    const normalizedMimeType = file.type.startsWith('video/webm') ? 'video/webm' : 'video/mp4';
    const extension = normalizedMimeType === 'video/webm' ? 'webm' : 'mp4';
    const storagePath = `${ownerId}/stores/${storeId}/products/${productId}/video/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('store-videos')
      .upload(storagePath, file, {
        upsert: false,
        contentType: normalizedMimeType,
        cacheControl: '31536000',
      });
    if (uploadError) throw new Error(`store-videos: ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from('store-videos').getPublicUrl(storagePath);
    const { data: previous, error: previousError } = await supabase
      .from('product_videos')
      .select('storage_path')
      .eq('product_id', productId)
      .maybeSingle();
    if (previousError) {
      await supabase.storage.from('store-videos').remove([storagePath]);
      throw new Error(previousError.message);
    }

    const { data, error } = await supabase
      .from('product_videos')
      .upsert({
        store_id: storeId,
        product_id: productId,
        owner_id: ownerId,
        video_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        mime_type: normalizedMimeType,
        file_size_bytes: file.size,
        duration_seconds: Number(metadata.durationSeconds.toFixed(2)),
        width: metadata.width,
        height: metadata.height,
      }, { onConflict: 'product_id' })
      .select()
      .single();
    if (error || !data) {
      await supabase.storage.from('store-videos').remove([storagePath]);
      throw new Error(error?.message ?? 'No se pudo guardar el video del producto.');
    }

    if (previous?.storage_path && previous.storage_path !== storagePath) {
      const { error: cleanupError } = await supabase.storage
        .from('store-videos')
        .remove([previous.storage_path]);
      if (cleanupError) console.error('[Videos] No se pudo limpiar el archivo anterior.', cleanupError);
    }
    return mapProductVideoRowToProductVideo(data);
  },

  async deleteProductVideo(productId: string): Promise<void> {
    const { data: video, error: readError } = await supabase
      .from('product_videos')
      .select('storage_path')
      .eq('product_id', productId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!video) return;
    const { error: storageError } = await supabase.storage
      .from('store-videos')
      .remove([video.storage_path]);
    if (storageError) throw new Error(storageError.message);
    const { error } = await supabase.from('product_videos').delete().eq('product_id', productId);
    if (error) throw new Error(error.message);
  },

  async getPublicProductVideo(productId: string) {
    const { data, error } = await supabase
      .from('public_product_videos')
      .select('video_url, mime_type, duration_seconds, width, height')
      .eq('product_id', productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      videoUrl: data.video_url,
      mimeType: data.mime_type === 'video/webm' ? 'video/webm' as const : 'video/mp4' as const,
      durationSeconds: Number(data.duration_seconds),
      width: data.width,
      height: data.height,
    };
  },

  async reorderProductImages(productId: string, imageIds: string[]): Promise<void> {
    const { error } = await supabase.rpc('reorder_product_images', {
      p_product_id: productId,
      p_image_ids: imageIds,
    });
    if (error) throw new Error(error.message);
  },

  async setProductCollections(productId: string, collectionIds: string[]): Promise<void> {
    const deduped = Array.from(new Set(collectionIds));
    const { error: deleteError } = await supabase.from('product_collections').delete().eq('product_id', productId);
    if (deleteError) throw new Error(deleteError.message);
    if (deduped.length === 0) return;

    const { error } = await supabase
      .from('product_collections')
      .insert(deduped.map((collectionId) => ({ product_id: productId, collection_id: collectionId })));
    if (error) throw new Error(error.message);
  },
};
