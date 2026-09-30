import { describe, expect, it } from 'vitest';
import { buildProductsCsv } from './productsCsv';
import type { Product } from './products.types';

const base = {
  storeId: 's', ownerId: 'o', description: '', shortDescription: null, descriptionSections: [],
  productType: 'physical_product', compareAtPrice: null, costPrice: null, cartaPrice: null, showInCarta: false,
  showInEcommerce: true, preparationTimeMinutes: null, allowsSpecialInstructions: false, specialInstructionsLabel: null,
  specialInstructionsPlaceholder: null, specialInstructionsMaxLength: 180, sortOrder: 0, category: null,
  showVariantsAsCards: false, sizeChartId: null, collections: [], hasVariants: false,
  createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z',
} as const;

describe('buildProductsCsv', () => {
  it('writes one column per attribute, escapes values and neutralizes formulas', () => {
    const products = [
      {
        ...base, id: '1', name: 'Lattafa "Asad", EDP', slug: 'lattafa-asad', sku: 'L-1', status: 'active', isAvailable: true,
        isFeatured: true, regularPrice: 180000, salePrice: null, stock: 3, trackInventory: true, mainImageUrl: null, categoryId: 'c1',
        facetValues: [{ facetId: 'm', facetName: 'Marca', facetSlug: 'marca', inputType: 'single_select', valueId: 'v', value: 'Lattafa', valueSlug: 'lattafa' }],
      },
      {
        ...base, id: '2', name: '=HYPERLINK("x")', slug: 'x', sku: null, status: 'draft', isAvailable: true,
        isFeatured: false, regularPrice: 0, salePrice: null, stock: 0, trackInventory: false, mainImageUrl: null, categoryId: null,
        facetValues: [],
      },
    ] as Product[];

    const csv = buildProductsCsv(products, { categoryLabelById: new Map([['c1', 'Perfumería']]), publicBaseUrl: 'https://velaire.melosoftapp.com' });
    const [header, first, second] = csv.replace('\uFEFF', '').split('\r\n');

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(header).toContain('Marca');
    expect(first).toContain('"Lattafa ""Asad"", EDP"');
    expect(first).toContain('https://velaire.melosoftapp.com/p/lattafa-asad');
    expect(first).toContain(',Lattafa,');
    expect(second.startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
  });
});
