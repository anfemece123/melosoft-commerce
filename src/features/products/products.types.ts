import type {
  AsyncStatus,
  ProductCollectionAssignment,
  ProductDescriptionSection,
  ProductFacetValue,
  ProductOptionSelectionType,
  ProductStatus,
  ProductType,
} from '@/types/common.types';

export interface ProductImage {
  id: string;
  storeId: string;
  productId: string;
  ownerId: string;
  imageUrl: string;
  storagePath: string | null;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  descriptionSections: ProductDescriptionSection[];
  productType: ProductType;
  regularPrice: number;
  compareAtPrice: number | null;
  salePrice: number | null;
  costPrice: number | null;
  stock: number;
  sku: string | null;
  trackInventory: boolean;
  isFeatured: boolean;
  isAvailable: boolean;
  preparationTimeMinutes: number | null;
  allowsSpecialInstructions: boolean;
  specialInstructionsLabel: string | null;
  specialInstructionsPlaceholder: string | null;
  specialInstructionsMaxLength: number;
  sortOrder: number;
  status: ProductStatus;
  mainImageUrl: string | null;
  category: string | null;
  categoryId: string | null;
  collections: ProductCollectionAssignment[];
  facetValues: ProductFacetValue[];
  images?: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export type ProductInsert = Omit<Product, 'id' | 'ownerId' | 'images' | 'collections' | 'facetValues' | 'createdAt' | 'updatedAt'>;
export type ProductUpdate = Partial<Omit<ProductInsert, 'storeId'>>;

export interface ProductCountStats {
  total: number;
  active: number;
  drafts: number;
  unavailable: number;
}

export interface ProductOptionItem {
  id: string;
  groupId: string;
  storeId: string;
  ownerId: string;
  label: string;
  description: string | null;
  priceDelta: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductOptionGroup {
  id: string;
  storeId: string;
  productId: string;
  ownerId: string;
  name: string;
  description: string | null;
  selectionType: ProductOptionSelectionType;
  minSelect: number;
  maxSelect: number | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  items: ProductOptionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductsState {
  items: Product[];
  current: Product | null;
  status: AsyncStatus;
  error: string | null;
}
