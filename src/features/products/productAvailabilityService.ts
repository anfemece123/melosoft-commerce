import { supabase } from '@/lib/supabase';
import type { ProductAvailabilityMap } from './productAvailability.types';

export const productAvailabilityService = {
  /** Returns a map of { [storeLocationId]: isAvailable } for a single product. */
  async getProductAvailability(productId: string): Promise<ProductAvailabilityMap> {
    const { data, error } = await supabase
      .from('product_location_availability')
      .select('store_location_id, is_available')
      .eq('product_id', productId);

    if (error) throw new Error(error.message);
    const map: ProductAvailabilityMap = {};
    for (const row of data ?? []) {
      map[row.store_location_id] = row.is_available;
    }
    return map;
  },

  /** Returns productIds that are explicitly marked unavailable for a location.
   *  "absent row = available" model: only rows with is_available=false matter for hiding.
   */
  async getUnavailableProductIds(storeId: string, storeLocationId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('product_location_availability')
      .select('product_id')
      .eq('store_id', storeId)
      .eq('store_location_id', storeLocationId)
      .eq('is_available', false);

    if (error) throw new Error(error.message);
    return new Set((data ?? []).map(r => r.product_id));
  },

  async upsertAvailability(
    storeId: string,
    productId: string,
    storeLocationId: string,
    isAvailable: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from('product_location_availability')
      .upsert(
        { store_id: storeId, product_id: productId, store_location_id: storeLocationId, is_available: isAvailable },
        { onConflict: 'product_id,store_location_id' },
      );

    if (error) throw new Error(error.message);
  },

  /** For a list of products and one location, returns a map of { [productId]: isAvailable }.
   *  Products with no row default to true.
   */
  async getAvailabilityForLocation(
    storeId: string,
    productIds: string[],
    storeLocationId: string,
  ): Promise<Record<string, boolean>> {
    if (productIds.length === 0) return {};

    const { data, error } = await supabase
      .from('product_location_availability')
      .select('product_id, is_available')
      .eq('store_id', storeId)
      .eq('store_location_id', storeLocationId)
      .in('product_id', productIds);

    if (error) throw new Error(error.message);

    const result: Record<string, boolean> = {};
    for (const id of productIds) result[id] = true; // default: available
    for (const row of data ?? []) result[row.product_id] = row.is_available;
    return result;
  },
};
