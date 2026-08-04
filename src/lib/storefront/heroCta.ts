import type {
  HeroCtaTargetType,
  PublicProductPage,
  PublicStoreCategory,
  PublicStoreCollection,
  PublicStoreHeroSlide,
  StoreCampaignOffer,
} from '@/types/common.types';
import { buildStorefrontPath } from './storefrontPaths';

export interface HeroCtaResolutionContext {
  storeSlug: string;
  categories: PublicStoreCategory[];
  collections: PublicStoreCollection[];
  products: PublicProductPage[];
  offers: StoreCampaignOffer[];
}

const ENTITY_TARGETS = new Set<HeroCtaTargetType>([
  'category',
  'collection',
  'product',
  'offer',
]);

export function heroCtaTargetNeedsEntity(type: HeroCtaTargetType): boolean {
  return ENTITY_TARGETS.has(type);
}

export function isExternalHeroCtaHref(href: string): boolean {
  return /^(?:https?:\/\/|mailto:|tel:)/i.test(href);
}

function resolveCustomHref(storeSlug: string, rawUrl: string | null): string | null {
  const value = rawUrl?.trim();
  if (!value) return null;

  if (value.startsWith('/')) {
    return buildStorefrontPath(storeSlug, value);
  }

  if (/^www\./i.test(value)) {
    return `https://${value}`;
  }

  if (/^(?:mailto:|tel:)/i.test(value)) return value;

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function isSafeHeroCustomUrl(rawUrl: string | null): boolean {
  const value = rawUrl?.trim();
  if (!value) return false;
  if (value.startsWith('/') || /^www\./i.test(value) || /^(?:mailto:|tel:)/i.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Resolves the current slug at render time. Deleted or invalid targets
 * intentionally fall back to the catalog instead of producing a dead CTA. */
export function resolveHeroCtaHref(
  slide: Pick<PublicStoreHeroSlide, 'ctaTargetType' | 'ctaTargetId' | 'ctaTargetUrl'>,
  context: HeroCtaResolutionContext,
): string {
  const catalogHref = buildStorefrontPath(context.storeSlug, '/catalog');

  switch (slide.ctaTargetType) {
    case 'featured':
      return buildStorefrontPath(context.storeSlug, '/catalog?featured=1');
    case 'sale':
      return buildStorefrontPath(context.storeSlug, '/catalog?sale=1');
    case 'category': {
      const category = context.categories.find((item) => item.id === slide.ctaTargetId);
      if (!category) return catalogHref;
      const parent = category.parentId
        ? context.categories.find((item) => item.id === category.parentId)
        : null;
      const query = parent
        ? `cat=${encodeURIComponent(parent.slug)}&sub=${encodeURIComponent(category.slug)}`
        : `cat=${encodeURIComponent(category.slug)}`;
      return buildStorefrontPath(context.storeSlug, `/catalog?${query}`);
    }
    case 'collection': {
      const collection = context.collections.find((item) => item.id === slide.ctaTargetId);
      return collection
        ? buildStorefrontPath(context.storeSlug, `/catalog?collection=${encodeURIComponent(collection.slug)}`)
        : catalogHref;
    }
    case 'product': {
      const product = context.products.find((item) => item.productId === slide.ctaTargetId);
      return product
        ? buildStorefrontPath(context.storeSlug, `/p/${encodeURIComponent(product.productSlug)}`)
        : catalogHref;
    }
    case 'offer': {
      const offer = context.offers.find((item) => item.id === slide.ctaTargetId);
      return offer
        ? buildStorefrontPath(context.storeSlug, `/o/${encodeURIComponent(offer.offerSlug)}`)
        : catalogHref;
    }
    case 'custom':
      return resolveCustomHref(context.storeSlug, slide.ctaTargetUrl) ?? catalogHref;
    case 'catalog':
    default:
      return catalogHref;
  }
}
