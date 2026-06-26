import type {
  ProductRow,
  ProductRowInsert,
  ProductRowUpdate,
  ProductImageRow,
  ProductOptionGroupRow,
  ProductOptionItemRow,
  PublicProductPageRow,
} from '@/types/database.types';
import type {
  ProductOptionSelectionType,
  ProductStatus,
  ProductType,
  PublicProductPage,
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

export function mapProductRowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    shortDescription: row.short_description,
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
    productType: (row.product_type as ProductType) ?? 'physical_product',
    regularPrice: Number(row.regular_price),
    compareAtPrice: row.compare_at_price !== null ? Number(row.compare_at_price) : null,
    salePrice: row.sale_price !== null ? Number(row.sale_price) : null,
    stock: row.stock,
    isFeatured: row.is_featured ?? false,
    isAvailable: row.is_available ?? true,
    preparationTimeMinutes: row.preparation_time_minutes ?? null,
    allowsSpecialInstructions: true,
    specialInstructionsLabel: null,
    specialInstructionsPlaceholder: null,
    specialInstructionsMaxLength: 180,
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
    whatsappCheckoutEnabled: row.whatsapp_checkout_enabled ?? null,
    webOrderEnabled: row.web_order_enabled ?? null,
    allowsPickup: row.allows_pickup ?? null,
    allowsLocalDelivery: row.allows_local_delivery ?? null,
    commerceMode: (row.commerce_mode as CommerceMode) ?? null,
    catalogType: (row.catalog_type as CatalogType) ?? null,
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
  };
}

export function mapProductUpdateToRow(data: ProductUpdate): ProductRowUpdate {
  const row: ProductRowUpdate = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.slug !== undefined) row.slug = data.slug;
  if (data.description !== undefined) row.description = data.description;
  if (data.shortDescription !== undefined) row.short_description = data.shortDescription ?? null;
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
  return row;
}
