import { supabase } from '@/lib/supabase';
import { slugify } from '@/utils/slugify';
import type { PublicStoreCategory } from '@/types/common.types';

async function getOwnerId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

function mapRow(row: {
  id: string;
  store_id: string;
  store_slug: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  color: string | null;
  sort_order: number;
  show_in_menu: boolean;
}): PublicStoreCategory {
  return {
    id: row.id,
    storeId: row.store_id,
    storeSlug: row.store_slug,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parent_id,
    imageUrl: row.image_url,
    color: row.color,
    sortOrder: row.sort_order,
    showInMenu: row.show_in_menu ?? true,
  };
}

export function buildCategoryTree(categories: PublicStoreCategory[]): PublicStoreCategory[] {
  const byId = new Map<string, PublicStoreCategory>();
  const roots: PublicStoreCategory[] = [];

  for (const cat of categories) {
    byId.set(cat.id, { ...cat, children: [] });
  }

  for (const cat of byId.values()) {
    if (cat.parentId && byId.has(cat.parentId)) {
      const parent = byId.get(cat.parentId)!;
      (parent.children ??= []).push(cat);
    } else {
      roots.push(cat);
    }
  }

  return roots;
}

export const categoriesService = {
  async getPublicCategories(storeSlug: string): Promise<PublicStoreCategory[]> {
    const { data, error } = await supabase
      .from('public_store_categories')
      .select('*')
      .eq('store_slug', storeSlug)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  },

  async getStoreCategories(storeId: string): Promise<PublicStoreCategory[]> {
    const { data: storeData } = await supabase
      .from('stores')
      .select('slug')
      .eq('id', storeId)
      .single();
    const storeSlug = storeData?.slug ?? '';
    const { data, error } = await supabase
      .from('store_product_categories')
      .select('id, store_id, name, slug, description, parent_id, image_url, color, sort_order, show_in_menu, is_active')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      storeId: row.store_id,
      storeSlug,
      name: row.name,
      slug: row.slug,
      description: row.description,
      parentId: row.parent_id,
      imageUrl: row.image_url,
      color: row.color,
      sortOrder: row.sort_order,
      showInMenu: row.show_in_menu ?? true,
    }));
  },

  async createCategory(
    storeId: string,
    data: { name: string; parentId?: string | null; description?: string | null; color?: string | null; showInMenu?: boolean }
  ): Promise<PublicStoreCategory> {
    const ownerId = await getOwnerId();
    const { data: storeData } = await supabase.from('stores').select('slug').eq('id', storeId).single();
    const storeSlug = storeData?.slug ?? '';
    const name = data.name.trim();
    const slug = slugify(name);

    let existingQuery = supabase
      .from('store_product_categories')
      .select('id, store_id, name, slug, description, parent_id, image_url, color, sort_order, show_in_menu')
      .eq('store_id', storeId)
      .eq('slug', slug);
    existingQuery = data.parentId
      ? existingQuery.eq('parent_id', data.parentId)
      : existingQuery.is('parent_id', null);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      return {
        id: existing.id,
        storeId: existing.store_id,
        storeSlug,
        name: existing.name,
        slug: existing.slug,
        description: existing.description,
        parentId: existing.parent_id,
        imageUrl: existing.image_url,
        color: existing.color,
        sortOrder: existing.sort_order,
        showInMenu: existing.show_in_menu ?? true,
      };
    }

    const { data: maxRow } = await supabase
      .from('store_product_categories')
      .select('sort_order')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (maxRow?.sort_order ?? -1) + 1;

    const { data: row, error } = await supabase
      .from('store_product_categories')
      .insert({
        store_id: storeId,
        owner_id: ownerId,
        name,
        slug,
        description: data.description ?? null,
        parent_id: data.parentId ?? null,
        color: data.color ?? null,
        show_in_menu: data.showInMenu ?? true,
        sort_order: nextSort,
        is_active: true,
      })
      .select('id, store_id, name, slug, description, parent_id, image_url, color, sort_order, show_in_menu')
      .single();
    if (error) throw new Error(error.message);
    return { ...row, storeId: row.store_id, storeSlug, parentId: row.parent_id, imageUrl: row.image_url, sortOrder: row.sort_order, showInMenu: row.show_in_menu ?? true };
  },

  async updateCategory(
    id: string,
    data: { name?: string; description?: string | null; parentId?: string | null; color?: string | null; showInMenu?: boolean; isActive?: boolean }
  ): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) { patch.name = data.name; patch.slug = slugify(data.name); }
    if (data.description !== undefined) patch.description = data.description;
    if (data.parentId !== undefined) patch.parent_id = data.parentId;
    if (data.color !== undefined) patch.color = data.color;
    if (data.showInMenu !== undefined) patch.show_in_menu = data.showInMenu;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    const { error } = await supabase.from('store_product_categories').update(patch as never).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase.from('store_product_categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
