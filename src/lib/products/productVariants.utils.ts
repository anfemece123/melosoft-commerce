import type { PublicProductImage, PublicProductPage, PublicProductVariant } from '@/types/common.types';
import { getActivePrice } from '@/lib/pricing/pricing.utils';

/** A variant can be sold right now if it's in stock, or explicitly allowed to backorder. */
export function isVariantAvailable(variant: PublicProductVariant): boolean {
  return variant.stockPolicy === 'allow_backorder' || variant.stockQuantity > 0;
}

/** A variant's own price, falling back to the parent product's active price when null. */
export function resolveVariantPrice(product: PublicProductPage, variant: PublicProductVariant | null): number {
  if (variant?.price != null) return variant.price;
  return getActivePrice(product.regularPrice, product.salePrice);
}

/** Min/max price across all variants — null when the product has no variants (single price applies). */
export function getVariantPriceRange(product: PublicProductPage): { min: number; max: number } | null {
  if (!product.hasVariants || product.variants.length === 0) return null;
  const prices = product.variants.map((v) => resolveVariantPrice(product, v));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** True when nothing about this product can currently be bought. */
export function isProductFullyOutOfStock(product: PublicProductPage): boolean {
  if (product.hasVariants) {
    if (product.variants.length === 0) return true;
    return product.variants.every((v) => !isVariantAvailable(v));
  }
  return product.trackInventory && product.stock <= 0;
}

/** The variant to preselect: the explicit default, or the only active variant. */
export function getDefaultVariant(product: PublicProductPage): PublicProductVariant | null {
  if (product.variants.length === 0) return null;
  const marked = product.variants.find((v) => v.isDefault);
  if (marked) return marked;
  return product.variants.length === 1 ? product.variants[0] : null;
}

/**
 * Initial `{ optionId: valueId }` selection for the product page: if
 * `presetOptionValueId` (e.g. from a catalog card's `?opt=` link, or any
 * other value id known ahead of time) matches a real value on this product,
 * seed the selection with just that one option — leaving the rest (e.g.
 * Talla) unselected, same as clicking that value manually. Falls back to
 * the product's default/only variant when there's no preset or it doesn't
 * match anything on this product.
 */
export function resolveInitialVariantSelection(
  product: PublicProductPage,
  presetOptionValueId: string | null
): Record<string, string> {
  if (presetOptionValueId) {
    for (const option of product.variantOptions) {
      const match = option.values.find((value) => value.id === presetOptionValueId);
      if (match) return { [option.id]: match.id };
    }
  }

  const defaultVariant = product.hasVariants ? getDefaultVariant(product) : null;
  return defaultVariant
    ? Object.fromEntries(defaultVariant.optionValues.map((ov) => [ov.optionId, ov.valueId]))
    : {};
}

/** Resolves the variant matching an exact set of selected option value ids (order-independent). */
export function findVariantByOptionValueIds(
  product: PublicProductPage,
  selectedValueIds: string[]
): PublicProductVariant | null {
  if (selectedValueIds.length === 0 || product.variantOptions.length !== selectedValueIds.length) return null;
  const selectedSet = new Set(selectedValueIds);
  return (
    product.variants.find((variant) => {
      const variantValueIds = variant.optionValues.map((ov) => ov.valueId);
      return variantValueIds.length === selectedSet.size && variantValueIds.every((id) => selectedSet.has(id));
    }) ?? null
  );
}

export function buildVariantLabel(variant: PublicProductVariant): string {
  return variant.optionValues.map((ov) => ov.value).join(' / ');
}

/** Whether picking `valueId` for `optionId` can still resolve to an available
 * variant given the OTHER options already selected — used to grey out
 * combinations that don't exist or are out of stock. */
export function isOptionValueSelectable(
  product: PublicProductPage,
  optionId: string,
  valueId: string,
  otherSelections: Record<string, string>
): boolean {
  return product.variants.some((variant) => {
    if (!isVariantAvailable(variant)) return false;
    const matchesThisValue = variant.optionValues.some((ov) => ov.optionId === optionId && ov.valueId === valueId);
    if (!matchesThisValue) return false;
    return Object.entries(otherSelections).every(([otherOptionId, otherValueId]) =>
      variant.optionValues.some((ov) => ov.optionId === otherOptionId && ov.valueId === otherValueId)
    );
  });
}

/**
 * Resolves which gallery the product page should show, in priority order:
 *   1. The exact selected variant's own image, if it has one (advanced
 *      per-combination override).
 *   2. The gallery attached to the currently selected value of whichever
 *      option is marked `controlsMedia` (usually Color/Modelo) — e.g. every
 *      "Verde" photo, shared by all sizes of that color.
 *   3. The product's general gallery.
 *
 * Deliberately reacts to `selectedValueIds` rather than requiring a fully
 * resolved variant — selecting just "Color: Verde" must switch the gallery
 * immediately, before a size is even picked.
 */
export function resolveVariantGalleryImages(
  product: PublicProductPage,
  selectedVariant: PublicProductVariant | null,
  selectedValueIds: Record<string, string>
): PublicProductImage[] {
  if (selectedVariant?.imageUrl) {
    return [{ imageUrl: selectedVariant.imageUrl, altText: product.productName, sortOrder: 0, isPrimary: true }];
  }

  const mediaOption = product.variantOptions.find((option) => option.controlsMedia);
  if (mediaOption) {
    const selectedValueId = selectedValueIds[mediaOption.id];
    const selectedValue = mediaOption.values.find((value) => value.id === selectedValueId);
    if (selectedValue && selectedValue.images.length > 0) {
      return selectedValue.images;
    }
  }

  return product.images;
}
