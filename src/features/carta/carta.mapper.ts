import type {
  StoreCartaSettingsRow,
  StoreCartaSettingsRowInsert,
  StoreCartaSettingsRowUpdate,
  PublicCartaPageRow,
} from '@/types/database.types';
import type {
  CartaSettings,
  CartaSettingsInsert,
  CartaSettingsUpdate,
  PublicCartaCategory,
  PublicCartaPage,
  PublicCartaProduct,
  PublicCartaVariant,
  PublicCartaVariantOptionValue,
  CartaCategoryImagePosition,
  CartaCategoryImageSize,
  CartaProductImagePosition,
} from './carta.types';

function normalizeTemplateKey(value: string | null | undefined): CartaSettings['templateKey'] {
  return value === 'gallery' || value === 'minimal' ? value : 'signature';
}

function normalizeNavigationMode(value: string | null | undefined): CartaSettings['navigationMode'] {
  return value === 'paginated' ? 'paginated' : 'continuous';
}

function normalizeCoverLayout(value: string | null | undefined): CartaSettings['coverLayout'] {
  // Preserve old compositions as a single-image cover until migration 124
  // normalizes the persisted value.
  return value === 'single' || value === 'collage' ? 'single' : 'none';
}

function normalizeCategoryHeadingAlignment(value: string | null | undefined): CartaSettings['categoryHeadingAlignment'] {
  return value === 'left' ? 'left' : 'center';
}

function normalizeProductImageMode(value: string | null | undefined): CartaSettings['productImageMode'] {
  return value === 'first_per_category' || value === 'none' ? value : 'all';
}

function normalizeCategoryImageModes(value: unknown): CartaSettings['categoryImageModes'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const validModes = new Set<CartaSettings['productImageMode']>(['all', 'first_per_category', 'none']);
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, CartaSettings['productImageMode']] => validModes.has(entry[1] as CartaSettings['productImageMode']))
  );
}

function normalizeCategoryImageSelections(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function normalizeCategoryImagePositions(value: unknown): Record<string, CartaCategoryImagePosition> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const validPositions = new Set<CartaCategoryImagePosition>(['above_heading', 'below_heading', 'beside_left', 'beside_right']);
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, CartaCategoryImagePosition] => validPositions.has(entry[1] as CartaCategoryImagePosition))
  );
}

function normalizeCategoryImageSizes(value: unknown): Record<string, CartaCategoryImageSize> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const validSizes = new Set<CartaCategoryImageSize>(['small', 'medium', 'large']);
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, CartaCategoryImageSize] => validSizes.has(entry[1] as CartaCategoryImageSize))
  );
}

function normalizeProductImagePositions(value: unknown): Record<string, CartaProductImagePosition> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const validPositions = new Set<CartaProductImagePosition>(['left', 'right']);
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, CartaProductImagePosition] => validPositions.has(entry[1] as CartaProductImagePosition))
  );
}

const UNCATEGORIZED_LABEL = 'Otros';

function parseCartaVariants(value: unknown): PublicCartaVariant[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((rawVariant): PublicCartaVariant[] => {
    if (!rawVariant || typeof rawVariant !== 'object' || Array.isArray(rawVariant)) return [];

    const variant = rawVariant as Record<string, unknown>;
    const id = typeof variant.id === 'string' ? variant.id : '';
    if (!id) return [];

    const optionValues = Array.isArray(variant.optionValues)
      ? variant.optionValues.flatMap((rawOptionValue): PublicCartaVariantOptionValue[] => {
          if (!rawOptionValue || typeof rawOptionValue !== 'object' || Array.isArray(rawOptionValue)) return [];
          const optionValue = rawOptionValue as Record<string, unknown>;
          if (
            typeof optionValue.optionId !== 'string' ||
            typeof optionValue.optionName !== 'string' ||
            typeof optionValue.valueId !== 'string' ||
            typeof optionValue.value !== 'string'
          ) {
            return [];
          }
          return [{
            optionId: optionValue.optionId,
            optionName: optionValue.optionName,
            valueId: optionValue.valueId,
            value: optionValue.value,
          }];
        })
      : [];

    const sku = typeof variant.sku === 'string' && variant.sku.trim() ? variant.sku : null;
    const stockPolicy = variant.stockPolicy === 'allow_backorder' ? 'allow_backorder' : 'deny';
    const stockQuantity = Number(variant.stockQuantity ?? 0);
    const isAvailable = variant.isAvailable === true || stockPolicy === 'allow_backorder' || stockQuantity > 0;
    const label = optionValues
      .map((optionValue) => optionValue.optionName ? `${optionValue.optionName}: ${optionValue.value}` : optionValue.value)
      .filter(Boolean)
      .join(' · ') || sku || 'Presentación';

    return [{
      id,
      sku,
      price: Number(variant.price ?? 0),
      compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
      stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
      stockPolicy,
      isDefault: variant.isDefault === true,
      isAvailable,
      imageUrl: typeof variant.imageUrl === 'string' ? variant.imageUrl : null,
      optionValues,
      label,
    }];
  });
}

export function attachPublicCartaImages(
  page: PublicCartaPage,
  images: Array<{ product_id: string; image_url: string }>
): PublicCartaPage {
  const firstImageByProduct = new Map<string, string>();
  for (const image of images) {
    if (!firstImageByProduct.has(image.product_id)) firstImageByProduct.set(image.product_id, image.image_url);
  }

  return {
    ...page,
    categories: page.categories.map((category) => ({
      ...category,
      products: category.products.map((product) => ({
        ...product,
        imageUrl: firstImageByProduct.get(product.id) ?? product.imageUrl,
      })),
    })),
  };
}

export function mapCartaSettingsRowToCartaSettings(row: StoreCartaSettingsRow): CartaSettings {
  return {
    id: row.id,
    storeId: row.store_id,
    enabled: row.enabled,
    listedInStorefront: row.listed_in_storefront,
    title: row.title,
    subtitle: row.subtitle,
    templateKey: normalizeTemplateKey(row.template_key),
    navigationMode: normalizeNavigationMode(row.navigation_mode),
    showCategoryDescriptions: row.show_category_descriptions,
    categoryOrder: row.category_order,
    productOrder: row.product_order,
    coverLayout: normalizeCoverLayout(row.cover_layout),
    coverProductIds: row.cover_product_ids ?? [],
    coverImageUrl: row.cover_image_url ?? null,
    coverBackgroundImageUrl: row.cover_background_image_url ?? null,
    showLogo: row.show_logo ?? true,
    showProductDescriptions: row.show_product_descriptions ?? true,
    categoryHeadingAlignment: normalizeCategoryHeadingAlignment(row.category_heading_alignment),
    productImageMode: normalizeProductImageMode(row.product_image_mode),
    categoryImageModes: normalizeCategoryImageModes(row.category_image_modes),
    categoryImageSelections: normalizeCategoryImageSelections(row.category_image_selections),
    categoryImagePositions: normalizeCategoryImagePositions(row.category_image_positions),
    categoryImageSizes: normalizeCategoryImageSizes(row.category_image_sizes),
    productImagePositions: normalizeProductImagePositions(row.product_image_positions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCartaSettingsInsertToRow(data: CartaSettingsInsert): StoreCartaSettingsRowInsert {
  return {
    store_id: data.storeId,
    enabled: data.enabled,
    listed_in_storefront: data.listedInStorefront,
    title: data.title ?? null,
    subtitle: data.subtitle ?? null,
    template_key: data.templateKey,
    navigation_mode: data.navigationMode,
    show_category_descriptions: data.showCategoryDescriptions,
    category_order: data.categoryOrder,
    product_order: data.productOrder,
    cover_layout: data.coverLayout,
    cover_product_ids: data.coverProductIds,
    cover_image_url: data.coverImageUrl,
    cover_background_image_url: data.coverBackgroundImageUrl,
    show_logo: data.showLogo,
    show_product_descriptions: data.showProductDescriptions,
    category_heading_alignment: data.categoryHeadingAlignment,
    product_image_mode: data.productImageMode,
    category_image_modes: data.categoryImageModes,
    category_image_selections: data.categoryImageSelections,
    category_image_positions: data.categoryImagePositions,
    category_image_sizes: data.categoryImageSizes,
    product_image_positions: data.productImagePositions,
  };
}

export function mapCartaSettingsUpdateToRow(data: CartaSettingsUpdate): StoreCartaSettingsRowUpdate {
  const row: StoreCartaSettingsRowUpdate = {};
  if (data.enabled !== undefined) row.enabled = data.enabled;
  if (data.listedInStorefront !== undefined) row.listed_in_storefront = data.listedInStorefront;
  if (data.title !== undefined) row.title = data.title ?? null;
  if (data.subtitle !== undefined) row.subtitle = data.subtitle ?? null;
  if (data.templateKey !== undefined) row.template_key = data.templateKey;
  if (data.navigationMode !== undefined) row.navigation_mode = data.navigationMode;
  if (data.showCategoryDescriptions !== undefined) row.show_category_descriptions = data.showCategoryDescriptions;
  if (data.categoryOrder !== undefined) row.category_order = data.categoryOrder;
  if (data.productOrder !== undefined) row.product_order = data.productOrder;
  if (data.coverLayout !== undefined) row.cover_layout = data.coverLayout;
  if (data.coverProductIds !== undefined) row.cover_product_ids = data.coverProductIds;
  if (data.coverImageUrl !== undefined) row.cover_image_url = data.coverImageUrl ?? null;
  if (data.coverBackgroundImageUrl !== undefined) row.cover_background_image_url = data.coverBackgroundImageUrl ?? null;
  if (data.showLogo !== undefined) row.show_logo = data.showLogo;
  if (data.showProductDescriptions !== undefined) row.show_product_descriptions = data.showProductDescriptions;
  if (data.categoryHeadingAlignment !== undefined) row.category_heading_alignment = data.categoryHeadingAlignment;
  if (data.productImageMode !== undefined) row.product_image_mode = data.productImageMode;
  if (data.categoryImageModes !== undefined) row.category_image_modes = data.categoryImageModes;
  if (data.categoryImageSelections !== undefined) row.category_image_selections = data.categoryImageSelections;
  if (data.categoryImagePositions !== undefined) row.category_image_positions = data.categoryImagePositions;
  if (data.categoryImageSizes !== undefined) row.category_image_sizes = data.categoryImageSizes;
  if (data.productImagePositions !== undefined) row.product_image_positions = data.productImagePositions;
  return row;
}

/** Groups the flat public_carta_pages rows (one row per product) into
 * categories ordered by category_sort_order, each with its products
 * ordered by product_sort_order. Products without a category are
 * bucketed under a single "Otros" group at the end. */
export function mapPublicCartaPageRowsToPublicCartaPage(rows: PublicCartaPageRow[]): PublicCartaPage | null {
  const first = rows[0];
  if (!first) return null;

  const categoryMap = new Map<string, PublicCartaCategory>();

  for (const row of rows) {
    const product: PublicCartaProduct = {
      id: row.product_id,
      name: row.product_name,
      shortDescription: row.short_description,
      imageUrl: row.main_image_url,
      price: Number(row.effective_price),
      sortOrder: row.product_sort_order,
      variants: parseCartaVariants(row.variants),
    };

    const categoryKey = row.category_id ?? '__uncategorized__';
    const existing = categoryMap.get(categoryKey);
    if (existing) {
      existing.products.push(product);
      continue;
    }

    categoryMap.set(categoryKey, {
      id: row.category_id,
      name: row.category_name ?? UNCATEGORIZED_LABEL,
      slug: row.category_slug,
      description: row.category_description,
      imageUrl: row.category_image_url,
      sortOrder: row.category_id ? row.category_sort_order ?? 0 : Number.MAX_SAFE_INTEGER,
      products: [product],
    });
  }

  const categories = Array.from(categoryMap.values())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => ({
      ...category,
      products: category.products.sort((a, b) => a.sortOrder - b.sortOrder),
    }));

  return {
    storeName: first.store_name,
    logoUrl: first.logo_url,
    currency: first.currency,
    title: first.title,
    subtitle: first.subtitle,
    templateKey: normalizeTemplateKey(first.carta_template_key),
    navigationMode: normalizeNavigationMode(first.carta_navigation_mode),
    showCategoryDescriptions: first.show_category_descriptions,
    coverLayout: normalizeCoverLayout(first.cover_layout),
    coverProductIds: first.cover_product_ids ?? [],
    coverImageUrl: first.cover_image_url ?? null,
    coverBackgroundImageUrl: first.cover_background_image_url ?? null,
    showLogo: first.show_logo ?? true,
    showProductDescriptions: first.show_product_descriptions ?? true,
    categoryHeadingAlignment: normalizeCategoryHeadingAlignment(first.category_heading_alignment),
    productImageMode: normalizeProductImageMode(first.product_image_mode),
    categoryImageModes: normalizeCategoryImageModes(first.category_image_modes),
    categoryImageSelections: normalizeCategoryImageSelections(first.category_image_selections),
    categoryImagePositions: normalizeCategoryImagePositions(first.category_image_positions),
    categoryImageSizes: normalizeCategoryImageSizes(first.category_image_sizes),
    productImagePositions: normalizeProductImagePositions(first.product_image_positions),
    themeMode: first.theme_mode,
    primaryColor: first.primary_color,
    secondaryColor: first.secondary_color,
    accentColor: first.accent_color,
    backgroundColor: first.background_color,
    textColor: first.text_color,
    buttonRadius: first.button_radius,
    categories,
  };
}
