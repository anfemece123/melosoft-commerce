import type { PublicProductImage, PublicProductPage, PublicProductVariant } from '@/types/common.types';
import { isVariantAvailable, resolveVariantPrice } from '@/lib/products/productVariants.utils';
import { productMatchesFilters, type FacetFilterLike } from '@/lib/storefront/variantFilters';

/**
 * One catalog grid cell. Most products produce exactly one (the whole
 * product, `optionValueId: null`) — the same as before this existed.
 * A product with a controlsMedia option AND `showVariantsAsCards` enabled
 * produces one CatalogItem per active/relevant value of that option (e.g.
 * "Zapatos deportivos - Verde", "Zapatos deportivos - Azul") — the product
 * row in the DB is never duplicated, only its public *presentation* splits.
 */
export interface CatalogItem {
  id: string;
  product: PublicProductPage;
  optionValueId: string | null;
  visualOptionId: string | null;
  displayName: string;
  imageUrl: string | null;
  /** The card's own "second image" for a desktop hover swap — always drawn
   * from the exact same image pool that produced `imageUrl` (the whole
   * product's general gallery, or a specific color/model value's own
   * gallery), never a different pool, so a color card's hover image can
   * never cross into an unrelated color's photo. `null` when that pool has
   * no second (different-url) image — the card simply has no hover swap. */
  secondImageUrl: string | null;
  minPrice: number;
  maxPrice: number;
  isOutOfStock: boolean;
}

/** Picks the "next" image after `primaryUrl` from `images` — sorted primary
 * first (then by sortOrder), so this is stable regardless of upload order.
 * Returns `null` when there isn't a second, distinct URL to show. */
function pickSecondImage(images: PublicProductImage[], primaryUrl: string | null): string | null {
  const sorted = [...images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
  const second = sorted.find((img) => img.imageUrl !== primaryUrl);
  return second?.imageUrl ?? null;
}

function buildWholeProductItem(product: PublicProductPage): CatalogItem {
  const prices = product.hasVariants && product.variants.length > 0
    ? product.variants.map((v) => resolveVariantPrice(product, v))
    : [product.regularPrice];
  return {
    id: product.productId,
    product,
    optionValueId: null,
    visualOptionId: null,
    displayName: product.productName,
    imageUrl: product.mainImageUrl,
    secondImageUrl: pickSecondImage(product.images, product.mainImageUrl),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    isOutOfStock: !product.isAvailable || (product.hasVariants
      ? product.variants.length === 0 || product.variants.every((v) => !isVariantAvailable(v))
      : product.trackInventory && product.stock <= 0),
  };
}

/**
 * Builds one CatalogItem per value of `visualOption` that has at least one
 * real variant — a value with no variant at all (e.g. defined but never
 * combined into a purchasable combination) produces no card, since there's
 * nothing valid to link to. A value whose variants are all out of
 * stock/backorder-disabled still gets a card, marked isOutOfStock — same
 * "show it, don't hide it" treatment simple out-of-stock products already
 * get elsewhere in the catalog.
 */
function buildVisualVariantItems(product: PublicProductPage, visualOption: PublicProductPage['variantOptions'][number]): CatalogItem[] {
  const items: CatalogItem[] = [];

  for (const value of visualOption.values) {
    const valueVariants: PublicProductVariant[] = product.variants.filter((variant) =>
      variant.optionValues.some((ov) => ov.optionId === visualOption.id && ov.valueId === value.id)
    );
    if (valueVariants.length === 0) continue;

    const availableVariants = valueVariants.filter(isVariantAvailable);
    const prices = valueVariants.map((v) => resolveVariantPrice(product, v));
    const image = value.images[0]?.imageUrl ?? product.images[0]?.imageUrl ?? product.mainImageUrl ?? null;
    // Second image comes from whichever pool actually produced `image` —
    // this value's own gallery when it has one, otherwise the product's
    // general gallery — never a mix of the two.
    const secondImagePool = value.images.length > 0 ? value.images : product.images;

    items.push({
      id: `${product.productId}:${value.id}`,
      product,
      optionValueId: value.id,
      visualOptionId: visualOption.id,
      displayName: `${product.productName} - ${value.value}`,
      imageUrl: image,
      secondImageUrl: pickSecondImage(secondImagePool, image),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      isOutOfStock: !product.isAvailable || availableVariants.length === 0,
    });
  }

  return items;
}

/**
 * Splits `products` into catalog grid cells. A product only splits when it
 * has variants, a controlsMedia option, and `showVariantsAsCards` is on —
 * every other product (simple, no variants, or controlsMedia without the
 * card toggle) yields exactly one item, identical to rendering the product
 * directly. The parent product is never duplicated in the database; this
 * is presentation-only, derived fresh from the same `product.variantOptions`
 * used everywhere else (public_product_pages, variantFilters, PDP).
 */
export function buildCatalogItems(products: PublicProductPage[]): CatalogItem[] {
  const items: CatalogItem[] = [];

  for (const product of products) {
    const visualOption = product.hasVariants && product.showVariantsAsCards
      ? product.variantOptions.find((option) => option.controlsMedia)
      : undefined;

    if (!visualOption) {
      items.push(buildWholeProductItem(product));
      continue;
    }

    const visualItems = buildVisualVariantItems(product, visualOption);
    // Defensive: a controlsMedia option with zero variants anywhere (should
    // not happen once "Generar variantes" has run, but a product mid-setup
    // could have the option defined with no variants yet) falls back to a
    // single whole-product card rather than silently disappearing.
    items.push(...(visualItems.length > 0 ? visualItems : [buildWholeProductItem(product)]));
  }

  return items;
}

/**
 * True if `item` satisfies every selected filter. For a whole-product item
 * this is identical to `productMatchesFilters`. For a visual-variant item,
 * filtering is scoped to ONLY that value's own variants — e.g. with
 * Verde/38 and Azul/40, filtering by Talla=40 must show the Azul card and
 * NOT the Verde one, even though both come from the same parent product.
 * Reuses `productMatchesFilters` itself (never a parallel reimplementation)
 * by matching against a shallow clone whose `variants` is narrowed to this
 * card's own combinations — attribute-scoped facets still resolve against
 * the real, unscoped product (an attribute applies to the whole product,
 * not to one of its colors).
 */
export function catalogItemMatchesFilters(
  item: CatalogItem,
  selectedFilters: FacetFilterLike[],
  concepts: Map<string, string>
): boolean {
  if (!item.optionValueId || !item.visualOptionId) {
    return productMatchesFilters(item.product, selectedFilters, concepts);
  }

  const scopedProduct: PublicProductPage = {
    ...item.product,
    variants: item.product.variants.filter((variant) =>
      variant.optionValues.some((ov) => ov.optionId === item.visualOptionId && ov.valueId === item.optionValueId)
    ),
  };
  return productMatchesFilters(scopedProduct, selectedFilters, concepts);
}
