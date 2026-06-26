export interface StoreProductCategory {
  id: string;
  storeId: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreProductCategoryCreateInput {
  storeId: string;
  name: string;
  description?: string | null;
}
