export interface StoreLocation {
  id: string;
  storeId: string;
  name: string;
  slug: string | null;
  addressLine: string | null;
  neighborhood: string | null;
  city: string | null;
  department: string | null;
  country: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  isPrimary: boolean;
  isActive: boolean;
  isPublic: boolean;
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  phone: string | null;
  whatsappNumber: string | null;
  sortOrder: number;
  deliveryNotes: string | null;
  pickupNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StoreLocationInsert = Omit<StoreLocation, 'id' | 'createdAt' | 'updatedAt'>;
export type StoreLocationUpdate = Partial<Omit<StoreLocationInsert, 'storeId'>>;

export interface PublicStoreLocation {
  locationId: string;
  storeId: string;
  storeSlug: string;
  name: string;
  city: string | null;
  department: string | null;
  country: string | null;
  addressLine: string | null;
  neighborhood: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  deliveryNotes: string | null;
  pickupNotes: string | null;
  isPrimary: boolean;
  sortOrder: number;
}
