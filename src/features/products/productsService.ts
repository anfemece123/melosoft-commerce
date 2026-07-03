import { supabase } from '@/lib/supabase';
import type { Product, ProductInsert, ProductUpdate, ProductImage, ProductCountStats } from './products.types';
import type { ProductFacetValue, ProductCollectionAssignment, PublicProductImage, PublicProductPage } from '@/types/common.types';
import type { PublicProductImageRow } from '@/types/database.types';
import {
  mapProductRowToProduct,
  mapProductInsertToRow,
  mapProductUpdateToRow,
  mapPublicProductPageRowToPublicProductPage,
  mapProductImageRowToProductImage,
} from './products.mapper';

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

export const productsService = {
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
    const [product] = await attachPublicImages([mapPublicProductPageRowToPublicProductPage(data)]);
    if (!product) return null;
    return product;
  },

  async getPublicProductsByStoreSlug(storeSlug: string): Promise<PublicProductPage[]> {
    const { data, error } = await supabase
      .from('public_product_pages')
      .select('*')
      .eq('store_slug', storeSlug)
      .order('product_name', { ascending: true });
    if (error) throw new Error(error.message);
    return attachPublicImages((data ?? []).map(mapPublicProductPageRowToPublicProductPage));
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
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getProductImages(productId: string): Promise<ProductImage[]> {
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
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
    const ownerId = await getOwnerId();
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const uuid = crypto.randomUUID();
    const storagePath = `${ownerId}/stores/${storeId}/products/${productId}/${uuid}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('store-assets')
      .upload(storagePath, file, { upsert: false, contentType: file.type });
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
