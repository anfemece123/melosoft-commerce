import { supabase } from '@/lib/supabase';
import {
  mapStoreCommerceSettingsRowToStoreCommerceSettings,
  mapStoreCommerceSettingsUpdateToRow,
} from './storeCommerce.mapper';
import type { StoreCommerceSettings, StoreCommerceSettingsUpdate } from './storeCommerce.types';

export const storeCommerceService = {
  async fetchStoreCommerceSettings(storeId: string): Promise<StoreCommerceSettings | null> {
    const { data, error } = await supabase
      .from('store_commerce_settings')
      .select('*')
      .eq('store_id', storeId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapStoreCommerceSettingsRowToStoreCommerceSettings(data);
  },

  async updateStoreCommerceSettings(
    storeId: string,
    payload: StoreCommerceSettingsUpdate
  ): Promise<StoreCommerceSettings> {
    const row = mapStoreCommerceSettingsUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_commerce_settings')
      .update(row)
      .eq('store_id', storeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapStoreCommerceSettingsRowToStoreCommerceSettings(data);
  },
};
