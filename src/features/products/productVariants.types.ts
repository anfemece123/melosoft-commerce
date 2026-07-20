export type ProductVariantOptionType = 'size' | 'color' | 'material' | 'style' | 'custom';
export type ProductVariantStockPolicy = 'deny' | 'allow_backorder';
export type ProductVariantStatus = 'active' | 'inactive';
export type ProductSizeChartType = 'shoes' | 'clothing' | 'custom';
export type ProductSizeChartUnit = 'cm' | 'in';

export interface ProductVariantImage {
  id: string;
  imageUrl: string;
  storagePath: string | null;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductVariantOptionValue {
  id: string;
  storeId: string;
  optionId: string;
  ownerId: string;
  value: string;
  colorHex: string | null;
  metadata: Record<string, unknown>;
  normalizedValue: string;
  sortOrder: number;
  isActive: boolean;
  // Gallery attached to this value (e.g. every "Color: Verde" photo) —
  // reused by every variant with that value instead of re-uploading per
  // combination. See product_images.option_value_id (migration 047).
  images: ProductVariantImage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantOption {
  id: string;
  storeId: string;
  productId: string;
  ownerId: string;
  name: string;
  type: ProductVariantOptionType;
  useAsPublicFilter: boolean;
  // True for at most the one option (usually Color/Modelo) whose value
  // images should drive the public product gallery.
  controlsMedia: boolean;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  values: ProductVariantOptionValue[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantSelectedValue {
  variantId: string;
  optionId: string;
  optionValueId: string;
  optionName?: string;
  value?: string;
}

export interface ProductVariant {
  id: string;
  storeId: string;
  productId: string;
  ownerId: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  compareAtPrice: number | null;
  cost: number | null;
  stockQuantity: number;
  stockPolicy: ProductVariantStockPolicy;
  lowStockThreshold: number | null;
  weight: number | null;
  status: ProductVariantStatus;
  isDefault: boolean;
  position: number;
  optionSignature: string;
  metadata: Record<string, unknown>;
  selectedValues: ProductVariantSelectedValue[];
  images: ProductVariantImage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductSizeChart {
  id: string;
  storeId: string;
  ownerId: string;
  categoryId: string | null;
  name: string;
  chartType: ProductSizeChartType;
  unit: ProductSizeChartUnit;
  content: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Draft shapes used by the admin form before it's persisted ──
// (outside Formik, same pattern as ProductOptionGroupDraft)

export interface ProductVariantOptionValueDraft {
  // Stable identity for this value on the client: the real id once saved,
  // or a locally-generated uuid before that (set once, at creation, and
  // never regenerated) — used to reliably map a pending image upload back
  // to the correct saved option_value_id, independent of array position.
  clientKey: string;
  id?: string;
  value: string;
  colorHex?: string | null;
  isActive: boolean;
  // Already-saved gallery for this value (populated when editing).
  images?: ProductVariantImage[];
  // Client-only: files picked before this value has a real id (or just
  // queued for upload), uploaded right after the value itself is saved —
  // same pattern as ProductVariantDraft.pendingImageFile, but a list since
  // a value's gallery can hold more than one photo.
  pendingImageFiles?: File[];
  pendingImagePreviewUrls?: string[];
}

export interface ProductVariantOptionDraft {
  // Same idea as ProductVariantOptionValueDraft.clientKey, one level up.
  clientKey: string;
  id?: string;
  name: string;
  type: ProductVariantOptionType;
  useAsPublicFilter: boolean;
  // Marks this as the option whose selected value's gallery should drive
  // the product's images on the public page (usually Color/Modelo).
  controlsMedia: boolean;
  isRequired: boolean;
  isActive: boolean;
  values: ProductVariantOptionValueDraft[];
}

export interface ProductVariantDraft {
  id?: string;
  sku: string;
  barcode?: string | null;
  price: number | '';
  compareAtPrice: number | '';
  // '' only while the variant hasn't been saved yet — the input starts empty
  // so the merchant must consciously type a number (including 0), rather
  // than silently inheriting a stock of 0. Once saved, this always holds a
  // real number (the current stock, editable only via "Ajustar stock").
  stockQuantity: number | '';
  stockPolicy: ProductVariantStockPolicy;
  status: ProductVariantStatus;
  isDefault: boolean;
  position: number;
  optionSignature: string;
  // { optionName -> selected value string } — used to render/regenerate
  // the combination label and to rebuild selected_values rows on save.
  optionValues: Record<string, string>;
  imageUrl?: string | null;
  // Client-only, never sent to Supabase directly: a variant image chosen
  // before this variant has a real id (new product, or a new row added
  // while editing). Uploaded and turned into a real product_images row
  // right after the variant itself is saved (see ProductFormPage). Survives
  // "Generar variantes" as long as the row still matches the same
  // combination; a genuinely different combination starts with none.
  pendingImageFile?: File | null;
  pendingImagePreviewUrl?: string | null;
}
