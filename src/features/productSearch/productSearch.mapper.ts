import type {
  ProductSearchSuggestionProduct,
  ProductSearchSuggestions,
  ProductSearchTerm,
} from './productSearch.types';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapProduct(row: JsonRecord): ProductSearchSuggestionProduct | null {
  const productId = toText(row.product_id);
  const productSlug = toText(row.product_slug);
  const productName = toText(row.product_name);
  if (!productId || !productSlug || !productName) return null;
  const regularPrice = toNumber(row.regular_price);
  return {
    productId,
    productSlug,
    productName,
    mainImageUrl: toText(row.main_image_url),
    categoryName: toText(row.category_name),
    brand: toText(row.brand),
    regularPrice,
    salePrice: row.sale_price === null || row.sale_price === undefined ? null : toNumber(row.sale_price),
    minPrice: toNumber(row.min_price, regularPrice),
    maxPrice: toNumber(row.max_price, regularPrice),
    hasVariants: row.has_variants === true,
    isAvailable: row.is_available !== false,
    stock: toNumber(row.stock),
    trackInventory: row.track_inventory === true,
  };
}

function mapTerm(row: JsonRecord): ProductSearchTerm | null {
  const kind = row.kind === 'facet' || row.kind === 'category' ? row.kind : null;
  const label = toText(row.label);
  if (!kind || !label) return null;
  return {
    kind,
    groupLabel: toText(row.group_label) ?? '',
    label,
    facetSlug: toText(row.facet_slug),
    valueSlug: toText(row.value_slug),
    categorySlug: toText(row.category_slug),
    parentCategorySlug: toText(row.parent_category_slug),
    productCount: toNumber(row.product_count),
  };
}

/** Maps the jsonb returned by public_catalog_suggest. Defensive on purpose:
 * a malformed row is dropped instead of breaking the whole dropdown. */
export function mapProductSearchSuggestions(data: unknown): ProductSearchSuggestions {
  const root = isRecord(data) ? data : {};
  const products = Array.isArray(root.products) ? root.products : [];
  const terms = Array.isArray(root.terms) ? root.terms : [];
  return {
    total: toNumber(root.total),
    products: products.filter(isRecord).map(mapProduct).filter((p): p is ProductSearchSuggestionProduct => p !== null),
    terms: terms.filter(isRecord).map(mapTerm).filter((t): t is ProductSearchTerm => t !== null),
  };
}
