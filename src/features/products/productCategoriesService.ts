import { supabase } from '@/lib/supabase';
import { slugify } from '@/utils/slugify';
import type {
  StoreProductCategoryRow,
  StoreProductCategoryRowInsert,
} from '@/types/database.types';
import type {
  StoreProductCategory,
  StoreProductCategoryCreateInput,
} from './productCategories.types';

function mapStoreProductCategoryRow(row: StoreProductCategoryRow): StoreProductCategory {
  return {
    id: row.id,
    storeId: row.store_id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getOwnerId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

async function syncCategoriesFromProducts(storeId: string): Promise<void> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('store_id', storeId)
    .not('category', 'is', null);

  if (error) throw new Error(error.message);

  const uniqueNames = Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.category?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  if (uniqueNames.length === 0) return;

  const rows: StoreProductCategoryRowInsert[] = uniqueNames.map((name, index) => ({
    store_id: storeId,
    owner_id: ownerId,
    name,
    slug: slugify(name),
    sort_order: index,
    is_active: true,
  }));

  const { error: upsertError } = await supabase
    .from('store_product_categories')
    .upsert(rows, { onConflict: 'store_id,slug', ignoreDuplicates: false });

  if (upsertError) throw new Error(upsertError.message);
}

export const productCategoriesService = {
  async getStoreCategories(storeId: string): Promise<StoreProductCategory[]> {
    await syncCategoriesFromProducts(storeId);

    const { data, error } = await supabase
      .from('store_product_categories')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreProductCategoryRow);
  },

  async createStoreCategory(input: StoreProductCategoryCreateInput): Promise<StoreProductCategory> {
    const ownerId = await getOwnerId();
    const name = input.name.trim();
    if (!name) throw new Error('La categoría no puede estar vacía.');

    const slug = slugify(name);
    const { data: existing } = await supabase
      .from('store_product_categories')
      .select('*')
      .eq('store_id', input.storeId)
      .eq('slug', slug)
      .maybeSingle();

    if (existing) return mapStoreProductCategoryRow(existing);

    const { data: maxSortRows, error: maxSortError } = await supabase
      .from('store_product_categories')
      .select('sort_order')
      .eq('store_id', input.storeId)
      .order('sort_order', { ascending: false })
      .limit(1);

    if (maxSortError) throw new Error(maxSortError.message);

    const nextSortOrder = (maxSortRows?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('store_product_categories')
      .insert({
        store_id: input.storeId,
        owner_id: ownerId,
        name,
        slug,
        description: input.description ?? null,
        sort_order: nextSortOrder,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapStoreProductCategoryRow(data);
  },

  async renameStoreCategory(categoryId: string, name: string): Promise<StoreProductCategory> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('La categoría no puede estar vacía.');

    const { data: current, error: currentError } = await supabase
      .from('store_product_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (currentError) throw new Error(currentError.message);

    const { data, error } = await supabase
      .from('store_product_categories')
      .update({
        name: trimmedName,
        slug: slugify(trimmedName),
      })
      .eq('id', categoryId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    if (current.name !== trimmedName) {
      const { error: productsError } = await supabase
        .from('products')
        .update({ category: trimmedName })
        .eq('store_id', current.store_id)
        .eq('category', current.name);

      if (productsError) throw new Error(productsError.message);
    }

    return mapStoreProductCategoryRow(data);
  },
};
