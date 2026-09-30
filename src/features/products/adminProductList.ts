import { normalizeSearchText } from '@/lib/storefront/searchText';
import type { Product } from './products.types';

// Pure list logic for the admin products panel: filters live in the URL
// (shareable, and kept when coming back from the edit page), the page only
// renders. Everything here runs over the already-loaded store catalog.

export type ProductStatusTab = 'all' | 'active' | 'draft' | 'unavailable' | 'archived';
export type ProductStockFilter = '' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'untracked';
export type ProductImageFilter = '' | 'with' | 'without';
export type ProductIssue = 'no_image' | 'no_price' | 'no_description' | 'no_short_description' | 'no_category';
export type ProductSortKey =
  | 'manual'
  | 'name_asc'
  | 'name_desc'
  | 'newest'
  | 'oldest'
  | 'updated'
  | 'price_asc'
  | 'price_desc'
  | 'stock_asc'
  | 'stock_desc';

/** Category filter value for products without a category. */
export const UNCATEGORIZED = '__none__';
export const LOW_STOCK_THRESHOLD = 5;
const MIN_DESCRIPTION_LENGTH = 20;

export interface AdminProductFilters {
  query: string;
  status: ProductStatusTab;
  categoryIds: string[];
  collectionIds: string[];
  facetValueIds: string[];
  stock: ProductStockFilter;
  image: ProductImageFilter;
  issues: ProductIssue[];
  priceMin: number | null;
  priceMax: number | null;
  featured: boolean;
  onSale: boolean;
  withVariants: boolean;
  sort: ProductSortKey;
}

export const EMPTY_ADMIN_PRODUCT_FILTERS: AdminProductFilters = {
  query: '',
  status: 'all',
  categoryIds: [],
  collectionIds: [],
  facetValueIds: [],
  stock: '',
  image: '',
  issues: [],
  priceMin: null,
  priceMax: null,
  featured: false,
  onSale: false,
  withVariants: false,
  sort: 'manual',
};

export const PRODUCT_SORT_OPTIONS: { value: ProductSortKey; label: string }[] = [
  { value: 'manual', label: 'Orden del catálogo' },
  { value: 'name_asc', label: 'Nombre A → Z' },
  { value: 'name_desc', label: 'Nombre Z → A' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'updated', label: 'Editados recientemente' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'stock_asc', label: 'Stock: menor a mayor' },
  { value: 'stock_desc', label: 'Stock: mayor a menor' },
];

export const PRODUCT_ISSUE_LABELS: Record<ProductIssue, string> = {
  no_image: 'Sin imagen',
  no_price: 'Sin precio',
  no_description: 'Sin descripción',
  no_short_description: 'Sin descripción corta',
  no_category: 'Sin categoría',
};

const STATUS_TABS: ProductStatusTab[] = ['all', 'active', 'draft', 'unavailable', 'archived'];
const STOCK_FILTERS: ProductStockFilter[] = ['', 'in_stock', 'low_stock', 'out_of_stock', 'untracked'];
const IMAGE_FILTERS: ProductImageFilter[] = ['', 'with', 'without'];
const ISSUES = Object.keys(PRODUCT_ISSUE_LABELS) as ProductIssue[];
const SORT_KEYS = PRODUCT_SORT_OPTIONS.map((option) => option.value);

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function list(value: string | null): string[] {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function toNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function adminProductFiltersFromParams(params: URLSearchParams): AdminProductFilters {
  return {
    query: params.get('q') ?? '',
    status: pick(params.get('estado'), STATUS_TABS, 'all'),
    categoryIds: list(params.get('cat')),
    collectionIds: list(params.get('col')),
    facetValueIds: list(params.get('attr')),
    stock: pick(params.get('stock'), STOCK_FILTERS, ''),
    image: pick(params.get('img'), IMAGE_FILTERS, ''),
    issues: list(params.get('ficha')).filter((issue): issue is ProductIssue => (ISSUES as string[]).includes(issue)),
    priceMin: toNumber(params.get('pmin')),
    priceMax: toNumber(params.get('pmax')),
    featured: params.get('dest') === '1',
    onSale: params.get('oferta') === '1',
    withVariants: params.get('var') === '1',
    sort: pick(params.get('orden'), SORT_KEYS, 'manual'),
  };
}

export function adminProductFiltersToParams(filters: AdminProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query);
  if (filters.status !== 'all') params.set('estado', filters.status);
  if (filters.categoryIds.length) params.set('cat', filters.categoryIds.join(','));
  if (filters.collectionIds.length) params.set('col', filters.collectionIds.join(','));
  if (filters.facetValueIds.length) params.set('attr', filters.facetValueIds.join(','));
  if (filters.stock) params.set('stock', filters.stock);
  if (filters.image) params.set('img', filters.image);
  if (filters.issues.length) params.set('ficha', filters.issues.join(','));
  if (filters.priceMin !== null) params.set('pmin', String(filters.priceMin));
  if (filters.priceMax !== null) params.set('pmax', String(filters.priceMax));
  if (filters.featured) params.set('dest', '1');
  if (filters.onSale) params.set('oferta', '1');
  if (filters.withVariants) params.set('var', '1');
  if (filters.sort !== 'manual') params.set('orden', filters.sort);
  return params;
}

/** Number of refinements beyond the status tab, search and sort. */
export function countActiveRefinements(filters: AdminProductFilters): number {
  return filters.categoryIds.length
    + filters.collectionIds.length
    + filters.facetValueIds.length
    + (filters.stock ? 1 : 0)
    + (filters.image ? 1 : 0)
    + filters.issues.length
    + (filters.priceMin !== null ? 1 : 0)
    + (filters.priceMax !== null ? 1 : 0)
    + (filters.featured ? 1 : 0)
    + (filters.onSale ? 1 : 0)
    + (filters.withVariants ? 1 : 0);
}

export function hasProductDiscount(product: Product): boolean {
  return product.salePrice !== null && product.salePrice > 0 && product.salePrice < product.regularPrice;
}

export function effectiveProductPrice(product: Product): number {
  return hasProductDiscount(product) ? (product.salePrice as number) : product.regularPrice;
}

/** What is missing for the product's page to look complete. Price is not
 * required when the store sells by WhatsApp inquiry (no prices shown). */
export function getProductIssues(product: Product, options: { requirePrice: boolean }): ProductIssue[] {
  const issues: ProductIssue[] = [];
  if (!product.mainImageUrl) issues.push('no_image');
  if (options.requirePrice && !product.hasVariants && product.regularPrice <= 0) issues.push('no_price');
  if (product.description.trim().length < MIN_DESCRIPTION_LENGTH) issues.push('no_description');
  if (!product.shortDescription?.trim()) issues.push('no_short_description');
  if (!product.categoryId) issues.push('no_category');
  return issues;
}

export function matchesStatusTab(product: Product, status: ProductStatusTab): boolean {
  switch (status) {
    case 'active': return product.status === 'active' && product.isAvailable;
    case 'draft': return product.status === 'draft';
    case 'unavailable': return product.status === 'active' && !product.isAvailable;
    case 'archived': return product.status === 'archived';
    default: return true;
  }
}

export interface AdminProductListContext {
  /** category id → parent id, to let a parent category include its children. */
  categoryParentById: Map<string, string | null>;
  /** category id → name, for search. */
  categoryNameById: Map<string, string>;
  /** facet value id → facet id: values of one facet are OR'd, facets AND'd. */
  facetIdByValueId: Map<string, string>;
  requirePrice: boolean;
}

/** Normalized text each product is searched against (built once per load). */
export function buildProductSearchIndex(products: Product[], context: AdminProductListContext): Map<string, string> {
  const index = new Map<string, string>();
  for (const product of products) {
    index.set(product.id, normalizeSearchText([
      product.name,
      product.sku ?? '',
      product.slug,
      product.shortDescription ?? '',
      product.description,
      product.categoryId ? context.categoryNameById.get(product.categoryId) ?? '' : '',
      ...product.facetValues.map((value) => value.value),
      ...product.collections.map((collection) => collection.name),
    ].join(' ')));
  }
  return index;
}

function matchesStock(product: Product, filter: ProductStockFilter): boolean {
  if (!filter) return true;
  if (filter === 'untracked') return !product.trackInventory;
  if (!product.trackInventory || product.hasVariants) return false;
  if (filter === 'out_of_stock') return product.stock <= 0;
  if (filter === 'low_stock') return product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
  return product.stock > 0;
}

/** Every filter except the status tab (so tab counts reflect the rest). */
export function filterAdminProducts(
  products: Product[],
  filters: AdminProductFilters,
  context: AdminProductListContext,
  searchIndex: Map<string, string>,
): Product[] {
  const tokens = normalizeSearchText(filters.query).split(' ').filter(Boolean);
  const categories = new Set(filters.categoryIds);
  const collections = new Set(filters.collectionIds);
  const valuesByFacet = new Map<string, Set<string>>();
  for (const valueId of filters.facetValueIds) {
    const facetId = context.facetIdByValueId.get(valueId) ?? valueId;
    const set = valuesByFacet.get(facetId) ?? new Set<string>();
    set.add(valueId);
    valuesByFacet.set(facetId, set);
  }
  const issues = filters.issues;

  return products.filter((product) => {
    if (tokens.length > 0) {
      const haystack = searchIndex.get(product.id) ?? '';
      if (!tokens.every((token) => haystack.includes(token))) return false;
    }
    if (categories.size > 0) {
      const own = product.categoryId;
      const parent = own ? context.categoryParentById.get(own) ?? null : null;
      const matches = own
        ? categories.has(own) || (parent !== null && categories.has(parent))
        : categories.has(UNCATEGORIZED);
      if (!matches) return false;
    }
    if (collections.size > 0 && !product.collections.some((collection) => collections.has(collection.id))) return false;
    for (const values of valuesByFacet.values()) {
      if (!product.facetValues.some((value) => values.has(value.valueId))) return false;
    }
    if (!matchesStock(product, filters.stock)) return false;
    if (filters.image === 'with' && !product.mainImageUrl) return false;
    if (filters.image === 'without' && product.mainImageUrl) return false;
    if (issues.length > 0) {
      const productIssues = getProductIssues(product, { requirePrice: context.requirePrice });
      if (!issues.some((issue) => productIssues.includes(issue))) return false;
    }
    const price = effectiveProductPrice(product);
    if (filters.priceMin !== null && price < filters.priceMin) return false;
    if (filters.priceMax !== null && price > filters.priceMax) return false;
    if (filters.featured && !product.isFeatured) return false;
    if (filters.onSale && !hasProductDiscount(product)) return false;
    if (filters.withVariants && !product.hasVariants) return false;
    return true;
  });
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Sorted copy. `manual` keeps the loaded catalog order. */
export function sortAdminProducts(products: Product[], sort: ProductSortKey): Product[] {
  if (sort === 'manual') return products;
  const sorted = [...products];
  const byName = (a: Product, b: Product) => collator.compare(a.name, b.name);
  switch (sort) {
    case 'name_asc': return sorted.sort(byName);
    case 'name_desc': return sorted.sort((a, b) => byName(b, a));
    case 'newest': return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'oldest': return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'updated': return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'price_asc': return sorted.sort((a, b) => effectiveProductPrice(a) - effectiveProductPrice(b) || byName(a, b));
    case 'price_desc': return sorted.sort((a, b) => effectiveProductPrice(b) - effectiveProductPrice(a) || byName(a, b));
    case 'stock_asc': return sorted.sort((a, b) => a.stock - b.stock || byName(a, b));
    case 'stock_desc': return sorted.sort((a, b) => b.stock - a.stock || byName(a, b));
    default: return sorted;
  }
}

/** Keeps a product's collections/attributes when a base-row update
 * (which doesn't carry them) comes back from the server. */
export function mergeUpdatedProduct(previous: Product, updated: Product): Product {
  return {
    ...updated,
    collections: previous.collections,
    facetValues: previous.facetValues,
    images: previous.images,
  };
}
