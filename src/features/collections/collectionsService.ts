import { supabase } from '@/lib/supabase';
import { slugify } from '@/utils/slugify';
import type { PublicStoreCollection } from '@/types/common.types';

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
  image_url: string | null;
  color: string | null;
  sort_order: number;
  show_on_home: boolean;
  show_in_menu: boolean;
}): PublicStoreCollection {
  return {
    id: row.id,
    storeId: row.store_id,
    storeSlug: row.store_slug,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    color: row.color,
    sortOrder: row.sort_order,
    showOnHome: row.show_on_home,
    showInMenu: row.show_in_menu,
  };
}

export const collectionsService = {
  async getPublicCollections(storeSlug: string): Promise<PublicStoreCollection[]> {
    const { data, error } = await supabase
      .from('public_store_collections')
      .select('*')
      .eq('store_slug', storeSlug)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  },

  async getStoreCollections(storeId: string): Promise<PublicStoreCollection[]> {
    const { data: storeData } = await supabase
      .from('stores')
      .select('slug')
      .eq('id', storeId)
      .single();
    const storeSlug = storeData?.slug ?? '';
    const { data, error } = await supabase
      .from('store_product_collections')
      .select('id, store_id, name, slug, description, image_url, color, sort_order, show_on_home, show_in_menu, is_active')
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
      imageUrl: row.image_url,
      color: row.color,
      sortOrder: row.sort_order,
      showOnHome: row.show_on_home,
      showInMenu: row.show_in_menu,
    }));
  },

  async createCollection(
    storeId: string,
    data: { name: string; description?: string | null; color?: string | null; showOnHome?: boolean; showInMenu?: boolean }
  ): Promise<PublicStoreCollection> {
    const ownerId = await getOwnerId();
    const { data: storeData } = await supabase.from('stores').select('slug').eq('id', storeId).single();
    const storeSlug = storeData?.slug ?? '';

    const { data: maxRow } = await supabase
      .from('store_product_collections')
      .select('sort_order')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (maxRow?.sort_order ?? -1) + 1;

    const { data: row, error } = await supabase
      .from('store_product_collections')
      .insert({
        store_id: storeId,
        owner_id: ownerId,
        name: data.name,
        slug: slugify(data.name),
        description: data.description ?? null,
        color: data.color ?? null,
        show_on_home: data.showOnHome ?? false,
        show_in_menu: data.showInMenu ?? false,
        sort_order: nextSort,
        is_active: true,
      })
      .select('id, store_id, name, slug, description, image_url, color, sort_order, show_on_home, show_in_menu')
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id,
      storeId: row.store_id,
      storeSlug,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.image_url,
      color: row.color,
      sortOrder: row.sort_order,
      showOnHome: row.show_on_home,
      showInMenu: row.show_in_menu,
    };
  },

  async updateCollection(
    id: string,
    data: { name?: string; description?: string | null; color?: string | null; showOnHome?: boolean; showInMenu?: boolean; isActive?: boolean }
  ): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) { patch.name = data.name; patch.slug = slugify(data.name); }
    if (data.description !== undefined) patch.description = data.description;
    if (data.color !== undefined) patch.color = data.color;
    if (data.showOnHome !== undefined) patch.show_on_home = data.showOnHome;
    if (data.showInMenu !== undefined) patch.show_in_menu = data.showInMenu;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    const { error } = await supabase.from('store_product_collections').update(patch as never).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteCollection(id: string): Promise<void> {
    const { error } = await supabase.from('store_product_collections').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
