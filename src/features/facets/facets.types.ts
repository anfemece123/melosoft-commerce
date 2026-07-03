export type FacetInputType = 'single_select' | 'multi_select';

export interface FacetCategoryAssignment {
  categoryId: string;
  appliesToChildren: boolean;
}

export interface StoreFacetValue {
  id: string;
  storeId: string;
  facetId: string;
  value: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface StoreFacet {
  id: string;
  storeId: string;
  ownerId: string;
  name: string;
  slug: string;
  inputType: FacetInputType;
  showInProductForm: boolean;
  showInCatalogFilters: boolean;
  showInMegaMenu: boolean;
  appliesToAllCategories: boolean;
  applicableCategories: FacetCategoryAssignment[];
  sortOrder: number;
  isActive: boolean;
  values: StoreFacetValue[];
  createdAt: string;
  updatedAt: string;
}

export interface FacetInsert {
  storeId: string;
  name: string;
  slug: string;
  inputType: FacetInputType;
  showInProductForm: boolean;
  showInCatalogFilters: boolean;
  showInMegaMenu: boolean;
  appliesToAllCategories: boolean;
  applicableCategories?: FacetCategoryAssignment[];
  sortOrder: number;
}

export interface FacetUpdate {
  name?: string;
  slug?: string;
  inputType?: FacetInputType;
  showInProductForm?: boolean;
  showInCatalogFilters?: boolean;
  showInMegaMenu?: boolean;
  appliesToAllCategories?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface FacetValueInsert {
  storeId: string;
  facetId: string;
  value: string;
  slug: string;
  sortOrder: number;
}
