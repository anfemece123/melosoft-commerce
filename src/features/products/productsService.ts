import { supabase } from '@/lib/supabase';
import type { Product, ProductInsert, ProductUpdate, ProductImage, ProductCountStats } from './products.types';
import type { PublicProductImage, PublicProductPage } from '@/types/common.types';
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

type PublicProductImageRow = {
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean | null;
};

function mapPublicImageRow(row: PublicProductImageRow): PublicProductImage {
  return {
    imageUrl: row.image_url,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary ?? false,
  };
}

async function attachPublicImages(products: PublicProductPage[]): Promise<PublicProductPage[]> {
  if (products.length === 0) return products;

  const productIds = products.map((product) => product.productId);
  const { data, error } = await supabase
    .from('product_images')
    .select('product_id, image_url, alt_text, sort_order, is_primary')
    .in('product_id', productIds)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

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
    return (data ?? []).map(mapProductRowToProduct);
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
    return mapProductRowToProduct(data);
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

    const { data: productSettings, error: productSettingsError } = await supabase
      .from('products')
      .select('allows_special_instructions, special_instructions_label, special_instructions_placeholder, special_instructions_max_length')
      .eq('id', product.productId)
      .single();

    if (productSettingsError) throw new Error(productSettingsError.message);

    return {
      ...product,
      allowsSpecialInstructions: productSettings?.allows_special_instructions ?? true,
      specialInstructionsLabel: productSettings?.special_instructions_label ?? null,
      specialInstructionsPlaceholder: productSettings?.special_instructions_placeholder ?? null,
      specialInstructionsMaxLength: productSettings?.special_instructions_max_length ?? 180,
    };
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
};
