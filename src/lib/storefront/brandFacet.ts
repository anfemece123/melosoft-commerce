import type { ProductFacetValue } from '@/types/common.types';

/** Slug of the attribute filter that holds a product's brand. A store
 * that creates a filter with this slug gets a brand link on each product
 * page pointing to the catalog filtered by that brand. */
export const BRAND_FACET_SLUG = 'marca';

export function findBrandFacetValue(facetValues: ProductFacetValue[]): ProductFacetValue | null {
  return facetValues.find((value) => value.facetSlug === BRAND_FACET_SLUG) ?? null;
}

/** Catalog query string listing every product of one brand. */
export function brandCatalogQuery(valueSlug: string): string {
  return `/catalog?f_${BRAND_FACET_SLUG}=${encodeURIComponent(valueSlug)}`;
}
