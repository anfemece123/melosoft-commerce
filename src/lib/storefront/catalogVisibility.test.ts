import { describe, expect, it } from 'vitest';
import type { PublicStoreFacet, PublicStoreFacetValue } from '@/types/common.types';
import { getContextualFacets } from './catalogVisibility';
import type { FacetMatchProduct } from './variantFilters';

function value(slug: string, label: string): PublicStoreFacetValue {
  return { id: slug, storeId: 'store-1', facetId: 'genero', value: label, slug, sortOrder: 0 };
}

const generoFacet: PublicStoreFacet = {
  id: 'genero',
  storeId: 'store-1',
  storeSlug: 'velaire',
  name: 'Género',
  slug: 'genero',
  inputType: 'single_select',
  showInCatalogFilters: true,
  showInMegaMenu: false,
  appliesToAllCategories: true,
  applicableCategories: [],
  sortOrder: 0,
  values: [value('mujer', 'Mujer'), value('hombre', 'Hombre'), value('unisex', 'Unisex')],
};

function product(genderSlug: string): FacetMatchProduct {
  return {
    facetValues: [{
      facetId: 'genero',
      facetName: 'Género',
      facetSlug: 'genero',
      inputType: 'single_select',
      valueId: genderSlug,
      value: genderSlug,
      valueSlug: genderSlug,
    }],
    variantOptions: [],
    variants: [],
  };
}

describe('getContextualFacets', () => {
  it('prunes values without products when the full product set is known', () => {
    const [facet] = getContextualFacets([generoFacet], null, [product('hombre'), product('unisex')], new Map());
    expect(facet.values.map((v) => v.slug)).toEqual(['hombre', 'unisex']);
  });

  it('keeps every value while the paginated catalog is still partial', () => {
    const [facet] = getContextualFacets([generoFacet], null, null, new Map());
    expect(facet.values.map((v) => v.slug)).toEqual(['mujer', 'hombre', 'unisex']);
  });
});
