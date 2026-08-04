import { describe, expect, it } from 'vitest';
import {
  mapProductUpdateToRow,
  mapPublicCatalogNavigationProductRow,
} from './products.mapper';

describe('product carta price mapping', () => {
  it('updates only carta_price without touching ecommerce prices', () => {
    expect(mapProductUpdateToRow({ cartaPrice: 19000 })).toEqual({ carta_price: 19000 });
    expect(mapProductUpdateToRow({ cartaPrice: null })).toEqual({ carta_price: null });
  });
});

describe('compact public catalog navigation mapping', () => {
  it('keeps only taxonomy and filter data required by the persistent header', () => {
    const product = mapPublicCatalogNavigationProductRow({
      category_id: 'drinks',
      category_slug: 'bebidas',
      category_parent_id: null,
      collections: [{ id: 'cold', name: 'Frías', slug: 'frias' }],
      facet_values: [{
        facet_id: 'brand',
        facet_name: 'Marca',
        facet_slug: 'marca',
        input_type: 'single_select',
        value_id: 'brand-1',
        value: 'Demo',
        value_slug: 'demo',
      }],
      variant_options: [],
      variants: [],
    });

    expect(product).toEqual({
      categoryId: 'drinks',
      categorySlug: 'bebidas',
      categoryParentId: null,
      collections: [{ id: 'cold', name: 'Frías', slug: 'frias' }],
      facetValues: [{
        facetId: 'brand',
        facetName: 'Marca',
        facetSlug: 'marca',
        inputType: 'single_select',
        valueId: 'brand-1',
        value: 'Demo',
        valueSlug: 'demo',
      }],
      variantOptions: [],
      variants: [],
    });
    expect(product).not.toHaveProperty('description');
    expect(product).not.toHaveProperty('images');
    expect(product).not.toHaveProperty('optionGroups');
  });
});
