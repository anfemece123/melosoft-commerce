import { supabase } from '@/lib/supabase';
import type { CartaSettings, CartaSettingsInsert, CartaSettingsUpdate, PublicCartaPage } from './carta.types';
import {
  mapCartaSettingsInsertToRow,
  mapCartaSettingsRowToCartaSettings,
  mapCartaSettingsUpdateToRow,
  attachPublicCartaImages,
  mapPublicCartaPageRowsToPublicCartaPage,
} from './carta.mapper';

export const cartaService = {
  async getCartaSettings(storeId: string): Promise<CartaSettings | null> {
    const { data, error } = await supabase
      .from('store_carta_settings')
      .select('*')
      .eq('store_id', storeId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapCartaSettingsRowToCartaSettings(data);
  },

  async upsertCartaSettings(payload: CartaSettingsInsert): Promise<CartaSettings> {
    const row = mapCartaSettingsInsertToRow(payload);
    const { data, error } = await supabase
      .from('store_carta_settings')
      .upsert(row, { onConflict: 'store_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after upsert');
    return mapCartaSettingsRowToCartaSettings(data);
  },

  async updateCartaSettings(storeId: string, payload: CartaSettingsUpdate): Promise<CartaSettings> {
    const row = mapCartaSettingsUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_carta_settings')
      .update(row)
      .eq('store_id', storeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapCartaSettingsRowToCartaSettings(data);
  },

  async getPublicCarta(storeSlug: string): Promise<PublicCartaPage | null> {
    const { data, error } = await supabase
      .from('public_carta_pages')
      .select('*')
      .eq('store_slug', storeSlug);
    if (error) throw new Error(error.message);
    const page = mapPublicCartaPageRowsToPublicCartaPage(data ?? []);
    if (!page) return null;

    // `product_images` is the catalog's real source of truth. Keep this
    // explicit public-view fallback even though migration 120 also folds
    // it into public_carta_pages: it makes Carta resilient when an
    // environment has not rebuilt that SQL view yet, and mirrors the
    // storefront's existing attachPublicImages behavior.
    const productIds = page.categories.flatMap((category) => category.products.map((product) => product.id));
    if (productIds.length === 0) return page;

    const { data: images, error: imagesError } = await supabase
      .from('public_product_images')
      .select('product_id, image_url, is_primary, sort_order')
      .in('product_id', productIds)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true });
    if (imagesError) throw new Error(imagesError.message);

    return attachPublicCartaImages(page, images ?? []);
  },
};
