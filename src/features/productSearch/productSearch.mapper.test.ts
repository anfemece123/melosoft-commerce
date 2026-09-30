import { describe, expect, it } from 'vitest';
import { mapProductSearchSuggestions } from './productSearch.mapper';

describe('mapProductSearchSuggestions', () => {
  it('maps the public_catalog_suggest payload', () => {
    const result = mapProductSearchSuggestions({
      total: 2,
      products: [{
        product_id: 'p1',
        product_slug: 'lattafa-asad',
        product_name: 'Lattafa Asad',
        main_image_url: 'https://cdn.test/asad.webp',
        category_name: 'Perfumeria',
        brand: 'Lattafa',
        regular_price: '180000',
        sale_price: null,
        min_price: 180000,
        max_price: 180000,
        has_variants: false,
        is_available: true,
        stock: 4,
        track_inventory: true,
      }],
      terms: [{
        kind: 'category',
        group_label: 'Categoría',
        label: 'Perfumeria',
        facet_slug: null,
        value_slug: null,
        category_slug: 'perfumeria',
        parent_category_slug: null,
        product_count: 294,
      }],
    });

    expect(result.total).toBe(2);
    expect(result.products[0]).toMatchObject({ productSlug: 'lattafa-asad', regularPrice: 180000, salePrice: null, brand: 'Lattafa' });
    expect(result.terms[0]).toMatchObject({ kind: 'category', categorySlug: 'perfumeria', productCount: 294 });
  });

  it('drops malformed rows instead of failing', () => {
    const result = mapProductSearchSuggestions({ total: 'x', products: [null, { product_id: 'p1' }], terms: [{ kind: 'other', label: 'x' }] });
    expect(result).toEqual({ total: 0, products: [], terms: [] });
    expect(mapProductSearchSuggestions(null)).toEqual({ total: 0, products: [], terms: [] });
  });
});
