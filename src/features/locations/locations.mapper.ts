import type { StoreLocationRow, PublicStoreLocationRow } from '@/types/database.types';
import type { StoreLocation, PublicStoreLocation } from './locations.types';

export function mapLocationRowToStoreLocation(row: StoreLocationRow): StoreLocation {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    slug: row.slug,
    addressLine: row.address_line,
    neighborhood: row.neighborhood,
    city: row.city,
    department: row.department,
    country: row.country,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    isPrimary: row.is_primary,
    isActive: row.is_active,
    isPublic: row.is_public,
    allowsPickup: row.allows_pickup,
    allowsLocalDelivery: row.allows_local_delivery,
    phone: row.phone,
    whatsappNumber: row.whatsapp_number,
    sortOrder: row.sort_order,
    deliveryNotes: row.delivery_notes,
    pickupNotes: row.pickup_notes,
    timezone: row.timezone,
    orderScheduleMode: row.order_schedule_mode as StoreLocation['orderScheduleMode'],
    ordersPaused: row.orders_paused,
    ordersPausedUntil: row.orders_paused_until,
    ordersPauseReason: row.orders_pause_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPublicLocationRowToPublicStoreLocation(row: PublicStoreLocationRow): PublicStoreLocation {
  return {
    locationId: row.location_id,
    storeId: row.store_id,
    storeSlug: row.store_slug,
    name: row.name,
    city: row.city,
    department: row.department,
    country: row.country,
    addressLine: row.address_line,
    neighborhood: row.neighborhood,
    phone: row.phone,
    whatsappNumber: row.whatsapp_number,
    allowsPickup: row.allows_pickup,
    allowsLocalDelivery: row.allows_local_delivery,
    deliveryNotes: row.delivery_notes,
    pickupNotes: row.pickup_notes,
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
    timezone: row.timezone,
    orderScheduleMode: row.order_schedule_mode as PublicStoreLocation['orderScheduleMode'],
  };
}
