export interface ProductLocationAvailability {
  id: string;
  storeId: string;
  productId: string;
  storeLocationId: string;
  isAvailable: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Keyed by storeLocationId */
export type ProductAvailabilityMap = Record<string, boolean>;
