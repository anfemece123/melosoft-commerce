import type {
  Json,
  ProductRow,
  ProductRowInsert,
  ProductRowUpdate,
  ProductImageRow,
  ProductOptionGroupRow,
  ProductOptionItemRow,
  ProductVariantOptionRow,
  ProductVariantOptionValueRow,
  ProductVariantRow,
  ProductVariantSelectedValueRow,
  ProductSizeChartRow,
  PublicProductPageRow,
} from '@/types/database.types';
import type {
  ProductDescriptionSection,
  ProductCollectionAssignment,
  ProductFacetValue,
  ProductOptionSelectionType,
  ProductStatus,
  ProductType,
  PublicProductImage,
  PublicProductPage,
  PublicProductVariant,
  PublicProductVariantOptionValue,
  PublicSizeChart,
  PublicVariantOption,
  PublicVariantOptionValue,
  TemplateKey,
  ThemeMode,
  CatalogType,
  CommerceMode,
} from '@/types/common.types';
import type {
  Product,
  ProductImage,
  ProductInsert,
  ProductOptionGroup,
  ProductOptionItem,
  ProductUpdate,
} from './products.types';
import type {
  ProductSizeChart,
  ProductVariant,
  ProductVariantImage,
  ProductVariantOption,
  ProductVariantOptionType,
  ProductVariantOptionValue,
  ProductVariantSelectedValue,
  ProductVariantStatus,
  ProductVariantStockPolicy,
} from './productVariants.types';

function parseDescriptionSections(raw: unknown): ProductDescriptionSection[] {
  if (!Array.isArray(raw)) return [];
  return raw as ProductDescriptionSection[];
}

function parseFacetValues(raw: unknown): ProductFacetValue[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((item) => ({
    facetId: String(item.facet_id ?? ''),
    facetName: String(item.facet_name ?? ''),
    facetSlug: String(item.facet_slug ?? ''),
    inputType: item.input_type === 'multi_select' ? 'multi_select' : 'single_select',
    valueId: String(item.value_id ?? ''),
    value: String(item.value ?? ''),
    valueSlug: String(item.value_slug ?? ''),
  }));
}

function parseCollections(raw: unknown): ProductCollectionAssignment[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((item) => ({
    id: String(item.id ?? ''),
    name: String(item.name ?? ''),
    slug: String(item.slug ?? ''),
  }));
}

function parsePublicVariantImages(raw: unknown): PublicProductImage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((item) => ({
    imageUrl: String(item.imageUrl ?? ''),
    altText: (item.altText as string | null) ?? null,
    sortOrder: Number(item.sortOrder ?? 0),
    isPrimary: item.isPrimary === true,
  }));
}

function parseVariantOptions(raw: unknown): PublicVariantOption[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((item) => ({
    id: String(item.id ?? ''),
    name: String(item.name ?? ''),
    type: (item.type as PublicVariantOption['type']) ?? 'custom',
    useAsPublicFilter: item.useAsPublicFilter !== false,
    controlsMedia: item.controlsMedia === true,
    sortOrder: Number(item.sortOrder ?? 0),
    values: Array.isArray(item.values)
      ? (item.values as Array<Record<string, unknown>>).map((value): PublicVariantOptionValue => ({
          id: String(value.id ?? ''),
          value: String(value.value ?? ''),
          normalizedValue: String(value.normalizedValue ?? ''),
          colorHex: (value.colorHex as string | null) ?? null,
          images: parsePublicVariantImages(value.images),
        }))
      : [],
  }));
}

function parseVariants(raw: unknown): PublicProductVariant[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((item) => ({
    id: String(item.id ?? ''),
    sku: (item.sku as string | null) ?? null,
    price: item.price !== null && item.price !== undefined ? Number(item.price) : null,
    compareAtPrice: item.compareAtPrice !== null && item.compareAtPrice !== undefined ? Number(item.compareAtPrice) : null,
    stockQuantity: Number(item.stockQuantity ?? 0),
    stockPolicy: (item.stockPolicy as 'deny' | 'allow_backorder') ?? 'deny',
    isDefault: item.isDefault === true,
    imageUrl: (item.imageUrl as string | null) ?? null,
    optionValues: Array.isArray(item.optionValues)
      ? (item.optionValues as Array<Record<string, unknown>>).map((value): PublicProductVariantOptionValue => ({
          optionId: String(value.optionId ?? ''),
          optionName: String(value.optionName ?? ''),
          valueId: String(value.valueId ?? ''),
          value: String(value.value ?? ''),
        }))
      : [],
  }));
}

function parseSizeChart(raw: unknown): PublicSizeChart | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (!item.id) return null;
  return {
    id: String(item.id),
    name: String(item.name ?? ''),
    chartType: (item.chartType as PublicSizeChart['chartType']) ?? 'custom',
    unit: (item.unit as PublicSizeChart['unit']) ?? 'cm',
    content: (item.content as Record<string, unknown>) ?? {},
  };
}

export function mapProductRowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    shortDescription: row.short_description,
    descriptionSections: parseDescriptionSections(row.description_sections),
    productType: (row.product_type as ProductType) ?? 'physical_product',
    regularPrice: Number(row.regular_price),
    compareAtPrice: row.compare_at_price !== null ? Number(row.compare_at_price) : null,
    salePrice: row.sale_price !== null ? Number(row.sale_price) : null,
    costPrice: row.cost_price !== null ? Number(row.cost_price) : null,
    stock: row.stock,
    sku: row.sku ?? null,
    trackInventory: row.track_inventory ?? true,
    isFeatured: row.is_featured ?? false,
    isAvailable: row.is_available ?? true,
    preparationTimeMinutes: row.preparation_time_minutes ?? null,
    allowsSpecialInstructions: row.allows_special_instructions ?? true,
    specialInstructionsLabel: row.special_instructions_label ?? null,
    specialInstructionsPlaceholder: row.special_instructions_placeholder ?? null,
    specialInstructionsMaxLength: row.special_instructions_max_length ?? 180,
    sortOrder: row.sort_order ?? 0,
    status: row.status as ProductStatus,
    mainImageUrl: row.main_image_url,
    category: row.category,
    categoryId: row.category_id ?? null,
    hasVariants: row.has_variants ?? false,
    showVariantsAsCards: row.show_variants_as_cards ?? false,
    sizeChartId: row.size_chart_id ?? null,
    collections: [],
    facetValues: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductImageRowToProductImage(row: ProductImageRow): ProductImage {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    ownerId: row.owner_id,
    imageUrl: row.image_url,
    storagePath: row.storage_path,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary ?? false,
    createdAt: row.created_at,
  };
}

export function mapProductOptionItemRowToProductOptionItem(row: ProductOptionItemRow): ProductOptionItem {
  return {
    id: row.id,
    groupId: row.group_id,
    storeId: row.store_id,
    ownerId: row.owner_id,
    label: row.label,
    description: row.description ?? null,
    priceDelta: Number(row.price_delta ?? 0),
    isDefault: row.is_default ?? false,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductOptionGroupRowToProductOptionGroup(
  row: ProductOptionGroupRow,
  items: ProductOptionItem[]
): ProductOptionGroup {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description ?? null,
    selectionType: (row.selection_type as ProductOptionSelectionType) ?? 'single',
    minSelect: row.min_select ?? 0,
    maxSelect: row.max_select ?? null,
    isRequired: row.is_required ?? false,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPublicProductPageRowToPublicProductPage(row: PublicProductPageRow): PublicProductPage {
  return {
    storeSlug: row.store_slug,
    storeName: row.store_name,
    storeWhatsappNumber: row.store_whatsapp_number ?? null,
    logoUrl: row.logo_url,
    themeMode: row.theme_mode as ThemeMode | null,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    buttonRadius: row.button_radius,
    templateKey: row.template_key as TemplateKey | null,
    productId: row.product_id,
    productSlug: row.product_slug,
    productName: row.product_name,
    description: row.description,
    shortDescription: row.short_description,
    descriptionSections: parseDescriptionSections(row.description_sections),
    productType: (row.product_type as ProductType) ?? 'physical_product',
    regularPrice: Number(row.regular_price),
    compareAtPrice: row.compare_at_price !== null ? Number(row.compare_at_price) : null,
    salePrice: row.sale_price !== null ? Number(row.sale_price) : null,
    stock: row.stock,
    trackInventory: row.track_inventory ?? false,
    isFeatured: row.is_featured ?? false,
    isAvailable: row.is_available ?? true,
    preparationTimeMinutes: row.preparation_time_minutes ?? null,
    allowsSpecialInstructions: row.allows_special_instructions ?? true,
    specialInstructionsLabel: row.special_instructions_label ?? null,
    specialInstructionsPlaceholder: row.special_instructions_placeholder ?? null,
    specialInstructionsMaxLength: row.special_instructions_max_length ?? 180,
    mainImageUrl: row.main_image_url,
    images: row.main_image_url
      ? [
          {
            imageUrl: row.main_image_url,
            altText: row.product_name,
            sortOrder: 0,
            isPrimary: true,
          },
        ]
      : [],
    optionGroups: [],
    category: row.category,
    categoryId: row.category_id ?? null,
    categoryName: row.category_name ?? null,
    categorySlug: row.category_slug ?? null,
    categoryParentId: row.category_parent_id ?? null,
    collections: parseCollections(row.collections),
    facetValues: parseFacetValues(row.facet_values),
    whatsappCheckoutEnabled: row.whatsapp_checkout_enabled ?? null,
    webOrderEnabled: row.web_order_enabled ?? null,
    allowsPickup: row.allows_pickup ?? null,
    allowsLocalDelivery: row.allows_local_delivery ?? null,
    commerceMode: (row.commerce_mode as CommerceMode) ?? null,
    catalogType: (row.catalog_type as CatalogType) ?? null,
    hasVariants: row.has_variants ?? false,
    showVariantsAsCards: row.show_variants_as_cards ?? false,
    sizeChart: parseSizeChart(row.size_chart),
    variantOptions: parseVariantOptions(row.variant_options),
    variants: parseVariants(row.variants),
    createdAt: row.product_created_at,
  };
}

export function mapProductInsertToRow(data: ProductInsert, ownerId: string): ProductRowInsert {
  return {
    store_id: data.storeId,
    owner_id: ownerId,
    name: data.name,
    slug: data.slug,
    description: data.description,
    short_description: data.shortDescription ?? null,
    description_sections: data.descriptionSections.length > 0 ? (data.descriptionSections as unknown as Json) : null,
    product_type: data.productType,
    regular_price: data.regularPrice,
    compare_at_price: data.compareAtPrice ?? null,
    sale_price: data.salePrice ?? null,
    cost_price: data.costPrice ?? null,
    stock: data.stock,
    sku: data.sku ?? null,
    track_inventory: data.trackInventory,
    is_featured: data.isFeatured,
    is_available: data.isAvailable,
    preparation_time_minutes: data.preparationTimeMinutes ?? null,
    allows_special_instructions: data.allowsSpecialInstructions,
    special_instructions_label: data.specialInstructionsLabel ?? null,
    special_instructions_placeholder: data.specialInstructionsPlaceholder ?? null,
    special_instructions_max_length: data.specialInstructionsMaxLength,
    sort_order: data.sortOrder,
    status: data.status,
    main_image_url: data.mainImageUrl ?? null,
    category: data.category ?? null,
    category_id: data.categoryId ?? null,
    has_variants: data.hasVariants,
    show_variants_as_cards: data.showVariantsAsCards,
    size_chart_id: data.sizeChartId ?? null,
  };
}

export function mapProductUpdateToRow(data: ProductUpdate): ProductRowUpdate {
  const row: ProductRowUpdate = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.slug !== undefined) row.slug = data.slug;
  if (data.description !== undefined) row.description = data.description;
  if (data.shortDescription !== undefined) row.short_description = data.shortDescription ?? null;
  if (data.descriptionSections !== undefined) row.description_sections = data.descriptionSections.length > 0 ? (data.descriptionSections as unknown as Json) : null;
  if (data.productType !== undefined) row.product_type = data.productType;
  if (data.regularPrice !== undefined) row.regular_price = data.regularPrice;
  if (data.compareAtPrice !== undefined) row.compare_at_price = data.compareAtPrice ?? null;
  if (data.salePrice !== undefined) row.sale_price = data.salePrice ?? null;
  if (data.costPrice !== undefined) row.cost_price = data.costPrice ?? null;
  if (data.stock !== undefined) row.stock = data.stock;
  if (data.sku !== undefined) row.sku = data.sku ?? null;
  if (data.trackInventory !== undefined) row.track_inventory = data.trackInventory;
  if (data.isFeatured !== undefined) row.is_featured = data.isFeatured;
  if (data.isAvailable !== undefined) row.is_available = data.isAvailable;
  if (data.preparationTimeMinutes !== undefined) row.preparation_time_minutes = data.preparationTimeMinutes ?? null;
  if (data.allowsSpecialInstructions !== undefined) row.allows_special_instructions = data.allowsSpecialInstructions;
  if (data.specialInstructionsLabel !== undefined) row.special_instructions_label = data.specialInstructionsLabel ?? null;
  if (data.specialInstructionsPlaceholder !== undefined) row.special_instructions_placeholder = data.specialInstructionsPlaceholder ?? null;
  if (data.specialInstructionsMaxLength !== undefined) row.special_instructions_max_length = data.specialInstructionsMaxLength;
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
  if (data.status !== undefined) row.status = data.status;
  if (data.mainImageUrl !== undefined) row.main_image_url = data.mainImageUrl ?? null;
  if (data.category !== undefined) row.category = data.category ?? null;
  if (data.categoryId !== undefined) row.category_id = data.categoryId ?? null;
  if (data.hasVariants !== undefined) row.has_variants = data.hasVariants;
  if (data.showVariantsAsCards !== undefined) row.show_variants_as_cards = data.showVariantsAsCards;
  if (data.sizeChartId !== undefined) row.size_chart_id = data.sizeChartId ?? null;
  return row;
}

// ── Variants ──────────────────────────────────────────────────

export function mapProductVariantOptionValueRowToProductVariantOptionValue(
  row: ProductVariantOptionValueRow,
  images: ProductVariantImage[] = []
): ProductVariantOptionValue {
  return {
    id: row.id,
    storeId: row.store_id,
    optionId: row.option_id,
    ownerId: row.owner_id,
    value: row.value,
    colorHex: row.color_hex ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    normalizedValue: row.normalized_value ?? '',
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    images,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductVariantOptionRowToProductVariantOption(
  row: ProductVariantOptionRow,
  values: ProductVariantOptionValue[]
): ProductVariantOption {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    ownerId: row.owner_id,
    name: row.name,
    type: (row.type as ProductVariantOptionType) ?? 'custom',
    useAsPublicFilter: row.use_as_public_filter ?? true,
    controlsMedia: row.controls_media ?? false,
    isRequired: row.is_required ?? true,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0,
    values,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductVariantSelectedValueRowToProductVariantSelectedValue(
  row: ProductVariantSelectedValueRow
): ProductVariantSelectedValue {
  return {
    variantId: row.variant_id,
    optionId: row.option_id,
    optionValueId: row.option_value_id,
  };
}

export function mapProductVariantRowToProductVariant(
  row: ProductVariantRow,
  selectedValues: ProductVariantSelectedValue[]
): ProductVariant {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    ownerId: row.owner_id,
    sku: row.sku ?? null,
    barcode: row.barcode ?? null,
    price: row.price !== null ? Number(row.price) : null,
    compareAtPrice: row.compare_at_price !== null ? Number(row.compare_at_price) : null,
    cost: row.cost !== null ? Number(row.cost) : null,
    stockQuantity: row.stock_quantity ?? 0,
    stockPolicy: (row.stock_policy as ProductVariantStockPolicy) ?? 'deny',
    lowStockThreshold: row.low_stock_threshold ?? null,
    weight: row.weight !== null ? Number(row.weight) : null,
    status: (row.status as ProductVariantStatus) ?? 'active',
    isDefault: row.is_default ?? false,
    position: row.position ?? 0,
    optionSignature: row.option_signature,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    selectedValues,
    images: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProductSizeChartRowToProductSizeChart(row: ProductSizeChartRow): ProductSizeChart {
  return {
    id: row.id,
    storeId: row.store_id,
    ownerId: row.owner_id,
    categoryId: row.category_id ?? null,
    name: row.name,
    chartType: row.chart_type as ProductSizeChart['chartType'],
    unit: row.unit as ProductSizeChart['unit'],
    content: (row.content as Record<string, unknown>) ?? {},
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
