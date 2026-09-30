export interface ProductSearchSuggestionProduct {
  productId: string;
  productSlug: string;
  productName: string;
  mainImageUrl: string | null;
  categoryName: string | null;
  brand: string | null;
  regularPrice: number;
  salePrice: number | null;
  minPrice: number;
  maxPrice: number;
  hasVariants: boolean;
  isAvailable: boolean;
  stock: number;
  trackInventory: boolean;
}

/** A brand/attribute value or category whose name matches the query —
 * shown above the products as a shortcut to the filtered catalog. */
export interface ProductSearchTerm {
  kind: 'facet' | 'category';
  groupLabel: string;
  label: string;
  facetSlug: string | null;
  valueSlug: string | null;
  categorySlug: string | null;
  parentCategorySlug: string | null;
  productCount: number;
}

export interface ProductSearchSuggestions {
  /** Every product matching the query, not only the ones returned. */
  total: number;
  products: ProductSearchSuggestionProduct[];
  terms: ProductSearchTerm[];
}
