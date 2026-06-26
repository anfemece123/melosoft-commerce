import { supabase } from '@/lib/supabase';
import type { StoreLocationRowInsert, StoreLocationRowUpdate } from '@/types/database.types';
import type { StoreLocation, PublicStoreLocation } from './locations.types';
import { mapLocationRowToStoreLocation, mapPublicLocationRowToPublicStoreLocation } from './locations.mapper';

export interface CreateLocationPayload {
  name: string;
  slug?: string | null;
  addressLine?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  department?: string | null;
  country?: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isPrimary?: boolean;
  isActive?: boolean;
  isPublic?: boolean;
  allowsPickup?: boolean;
  allowsLocalDelivery?: boolean;
  phone?: string | null;
  whatsappNumber?: string | null;
  sortOrder?: number;
  deliveryNotes?: string | null;
  pickupNotes?: string | null;
}

export interface UpdateLocationPayload {
  name?: string;
  slug?: string | null;
  addressLine?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  department?: string | null;
  country?: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isPrimary?: boolean;
  isActive?: boolean;
  isPublic?: boolean;
  allowsPickup?: boolean;
  allowsLocalDelivery?: boolean;
  phone?: string | null;
  whatsappNumber?: string | null;
  sortOrder?: number;
  deliveryNotes?: string | null;
  pickupNotes?: string | null;
}

function toUpdateRow(p: UpdateLocationPayload): StoreLocationRowUpdate {
  const row: StoreLocationRowUpdate = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.slug !== undefined) row.slug = p.slug;
  if (p.addressLine !== undefined) row.address_line = p.addressLine;
  if (p.neighborhood !== undefined) row.neighborhood = p.neighborhood;
  if (p.city !== undefined) row.city = p.city;
  if (p.department !== undefined) row.department = p.department;
  if (p.country !== undefined) row.country = p.country;
  if (p.postalCode !== undefined) row.postal_code = p.postalCode;
  if (p.latitude !== undefined) row.latitude = p.latitude;
  if (p.longitude !== undefined) row.longitude = p.longitude;
  if (p.isPrimary !== undefined) row.is_primary = p.isPrimary;
  if (p.isActive !== undefined) row.is_active = p.isActive;
  if (p.isPublic !== undefined) row.is_public = p.isPublic;
  if (p.allowsPickup !== undefined) row.allows_pickup = p.allowsPickup;
  if (p.allowsLocalDelivery !== undefined) row.allows_local_delivery = p.allowsLocalDelivery;
  if (p.phone !== undefined) row.phone = p.phone;
  if (p.whatsappNumber !== undefined) row.whatsapp_number = p.whatsappNumber;
  if (p.sortOrder !== undefined) row.sort_order = p.sortOrder;
  if (p.deliveryNotes !== undefined) row.delivery_notes = p.deliveryNotes;
  if (p.pickupNotes !== undefined) row.pickup_notes = p.pickupNotes;
  return row;
}

export const locationsService = {
  async getStoreLocations(storeId: string): Promise<StoreLocation[]> {
    const { data, error } = await supabase
      .from('store_locations')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapLocationRowToStoreLocation);
  },

  async createLocation(storeId: string, payload: CreateLocationPayload): Promise<StoreLocation> {
    const row: StoreLocationRowInsert = {
      store_id: storeId,
      name: payload.name,
      slug: payload.slug ?? null,
      address_line: payload.addressLine ?? null,
      neighborhood: payload.neighborhood ?? null,
      city: payload.city ?? null,
      department: payload.department ?? null,
      country: payload.country ?? 'CO',
      postal_code: payload.postalCode ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      is_primary: payload.isPrimary ?? false,
      is_active: payload.isActive ?? true,
      is_public: payload.isPublic ?? true,
      allows_pickup: payload.allowsPickup ?? true,
      allows_local_delivery: payload.allowsLocalDelivery ?? false,
      phone: payload.phone ?? null,
      whatsapp_number: payload.whatsappNumber ?? null,
      sort_order: payload.sortOrder ?? 0,
      delivery_notes: payload.deliveryNotes ?? null,
      pickup_notes: payload.pickupNotes ?? null,
    };

    const { data, error } = await supabase
      .from('store_locations')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapLocationRowToStoreLocation(data);
  },

  async updateLocation(locationId: string, payload: UpdateLocationPayload): Promise<StoreLocation> {
    const { data, error } = await supabase
      .from('store_locations')
      .update(toUpdateRow(payload))
      .eq('id', locationId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapLocationRowToStoreLocation(data);
  },

  async deleteLocation(locationId: string): Promise<void> {
    const { error } = await supabase
      .from('store_locations')
      .delete()
      .eq('id', locationId);

    if (error) throw new Error(error.message);
  },

  async setPrimaryLocation(storeId: string, locationId: string): Promise<void> {
    const { error } = await supabase
      .from('store_locations')
      .update({ is_primary: true })
      .eq('id', locationId)
      .eq('store_id', storeId);

    if (error) throw new Error(error.message);
  },

  async getPublicStoreLocations(storeSlug: string): Promise<PublicStoreLocation[]> {
    const { data, error } = await supabase
      .from('public_store_locations')
      .select('*')
      .eq('store_slug', storeSlug)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapPublicLocationRowToPublicStoreLocation);
  },
};
