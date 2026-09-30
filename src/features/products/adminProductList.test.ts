import { describe, expect, it } from 'vitest';
import {
  EMPTY_ADMIN_PRODUCT_FILTERS,
  UNCATEGORIZED,
  adminProductFiltersFromParams,
  adminProductFiltersToParams,
  buildProductSearchIndex,
  countActiveRefinements,
  filterAdminProducts,
  getProductIssues,
  matchesStatusTab,
  mergeUpdatedProduct,
  sortAdminProducts,
} from './adminProductList';
import type { AdminProductFilters, AdminProductListContext } from './adminProductList';
import type { Product } from './products.types';

function product(overrides: Partial<Product>): Product {
  return {
    id: 'p',
    storeId: 's',
    ownerId: 'o',
    name: 'Producto',
    slug: 'producto',
    description: 'Una descripción suficientemente larga para contar.',
    shortDescription: 'Corta',
    descriptionSections: [],
    productType: 'physical_product',
    regularPrice: 100,
    compareAtPrice: null,
    salePrice: null,
    costPrice: null,
    cartaPrice: null,
    showInCarta: false,
    showInEcommerce: true,
    stock: 10,
    sku: null,
    trackInventory: true,
    isFeatured: false,
    isAvailable: true,
    preparationTimeMinutes: null,
    allowsSpecialInstructions: false,
    specialInstructionsLabel: null,
    specialInstructionsPlaceholder: null,
    specialInstructionsMaxLength: 180,
    sortOrder: 0,
    status: 'active',
    mainImageUrl: 'https://img/p.webp',
    category: null,
    categoryId: 'perfumes',
    hasVariants: false,
    showVariantsAsCards: false,
    sizeChartId: null,
    collections: [],
    facetValues: [],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

function facet(facetId: string, valueId: string, value: string) {
  return { facetId, facetName: facetId, facetSlug: facetId, inputType: 'single_select' as const, valueId, value, valueSlug: valueId };
}

const context: AdminProductListContext = {
  categoryParentById: new Map([['perfumes', null], ['arabes', 'perfumes'], ['cremas', null]]),
  categoryNameById: new Map([['perfumes', 'Perfumería'], ['arabes', 'Árabes'], ['cremas', 'Cremas']]),
  facetIdByValueId: new Map([['lattafa', 'marca'], ['armaf', 'marca'], ['mujer', 'genero'], ['hombre', 'genero']]),
  requirePrice: true,
};

const catalog: Product[] = [
  product({ id: 'asad', name: 'Lattafa Asad', sku: 'LAT-ASAD', categoryId: 'arabes', facetValues: [facet('marca', 'lattafa', 'Lattafa'), facet('genero', 'hombre', 'Hombre')], regularPrice: 180, stock: 0 }),
  product({ id: 'yara', name: 'Lattafa Yara', categoryId: 'arabes', facetValues: [facet('marca', 'lattafa', 'Lattafa'), facet('genero', 'mujer', 'Mujer')], regularPrice: 160, salePrice: 120, stock: 3, isFeatured: true }),
  product({ id: 'club', name: 'Armaf Club de Nuit', categoryId: 'perfumes', facetValues: [facet('marca', 'armaf', 'Armaf'), facet('genero', 'hombre', 'Hombre')], regularPrice: 200, mainImageUrl: null, updatedAt: '2026-09-20T00:00:00Z' }),
  product({ id: 'crema', name: 'Crema Nívea', categoryId: null, regularPrice: 0, trackInventory: false, status: 'draft', description: '', shortDescription: null }),
];

function run(overrides: Partial<AdminProductFilters>): string[] {
  const filters = { ...EMPTY_ADMIN_PRODUCT_FILTERS, ...overrides };
  const index = buildProductSearchIndex(catalog, context);
  return sortAdminProducts(filterAdminProducts(catalog, filters, context, index), filters.sort).map((p) => p.id);
}

describe('filterAdminProducts', () => {
  it('searches name, SKU, attributes and category, accent-insensitive, any word order', () => {
    expect(run({ query: 'asad lattafa' })).toEqual(['asad']);
    expect(run({ query: 'lat-asad' })).toEqual(['asad']);
    expect(run({ query: 'arabes' })).toEqual(['asad', 'yara']);
    expect(run({ query: 'nivea' })).toEqual(['crema']);
  });

  it('parent category includes subcategories; uncategorized is selectable', () => {
    expect(run({ categoryIds: ['perfumes'] })).toEqual(['asad', 'yara', 'club']);
    expect(run({ categoryIds: [UNCATEGORIZED] })).toEqual(['crema']);
  });

  it('ORs values of one attribute and ANDs different attributes', () => {
    expect(run({ facetValueIds: ['lattafa', 'armaf'] })).toEqual(['asad', 'yara', 'club']);
    expect(run({ facetValueIds: ['lattafa', 'hombre'] })).toEqual(['asad']);
  });

  it('filters by stock, image, issues, price and flags', () => {
    expect(run({ stock: 'out_of_stock' })).toEqual(['asad']);
    expect(run({ stock: 'low_stock' })).toEqual(['yara']);
    expect(run({ stock: 'untracked' })).toEqual(['crema']);
    expect(run({ image: 'without' })).toEqual(['club']);
    expect(run({ issues: ['no_price', 'no_image'] })).toEqual(['club', 'crema']);
    expect(run({ priceMin: 125, priceMax: 190 })).toEqual(['asad']);
    expect(run({ onSale: true })).toEqual(['yara']);
    expect(run({ featured: true })).toEqual(['yara']);
  });

  it('sorts by price using the sale price and by last edit', () => {
    expect(run({ sort: 'price_asc' })).toEqual(['crema', 'yara', 'asad', 'club']);
    expect(run({ sort: 'updated' })[0]).toBe('club');
    expect(run({ sort: 'name_asc' })).toEqual(['club', 'crema', 'asad', 'yara']);
  });
});

describe('status tabs and issues', () => {
  it('classifies status tabs', () => {
    expect(catalog.filter((p) => matchesStatusTab(p, 'draft')).map((p) => p.id)).toEqual(['crema']);
    expect(matchesStatusTab(product({ isAvailable: false }), 'unavailable')).toBe(true);
  });

  it('does not require a price in WhatsApp inquiry stores', () => {
    const crema = catalog[3];
    expect(getProductIssues(crema, { requirePrice: true })).toContain('no_price');
    expect(getProductIssues(crema, { requirePrice: false })).not.toContain('no_price');
  });
});

describe('URL round trip', () => {
  it('serializes only non-default values and parses them back', () => {
    const filters: AdminProductFilters = {
      ...EMPTY_ADMIN_PRODUCT_FILTERS,
      query: 'lattafa',
      status: 'draft',
      categoryIds: ['arabes'],
      facetValueIds: ['lattafa', 'mujer'],
      stock: 'low_stock',
      issues: ['no_image'],
      priceMin: 10,
      featured: true,
      sort: 'price_desc',
    };
    const params = adminProductFiltersToParams(filters);
    expect(adminProductFiltersFromParams(params)).toEqual(filters);
    expect(adminProductFiltersToParams(EMPTY_ADMIN_PRODUCT_FILTERS).toString()).toBe('');
    expect(countActiveRefinements(filters)).toBe(7);
  });

  it('ignores invalid values', () => {
    const parsed = adminProductFiltersFromParams(new URLSearchParams('estado=x&stock=y&orden=z&pmin=-3&ficha=no_image,bad'));
    expect(parsed.status).toBe('all');
    expect(parsed.stock).toBe('');
    expect(parsed.sort).toBe('manual');
    expect(parsed.priceMin).toBeNull();
    expect(parsed.issues).toEqual(['no_image']);
  });
});

describe('mergeUpdatedProduct', () => {
  it('keeps taxonomy the base-row update does not carry', () => {
    const previous = catalog[0];
    const merged = mergeUpdatedProduct(previous, { ...previous, facetValues: [], collections: [], isFeatured: true });
    expect(merged.isFeatured).toBe(true);
    expect(merged.facetValues).toHaveLength(2);
  });
});
