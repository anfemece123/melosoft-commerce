import { describe, expect, it } from 'vitest';
import type {
  PublicProductPage,
  PublicStoreCategory,
  PublicStoreCollection,
  StoreCampaignOffer,
} from '@/types/common.types';
import { resolveHeroCtaHref } from './heroCta';

const category = { id: 'root', slug: 'comidas', parentId: null } as PublicStoreCategory;
const subcategory = { id: 'child', slug: 'hamburguesas', parentId: 'root' } as PublicStoreCategory;
const collection = { id: 'collection', slug: 'combos' } as PublicStoreCollection;
const product = { productId: 'product', productSlug: 'combo-familiar' } as PublicProductPage;
const offer = { id: 'offer', offerSlug: 'martes-2x1' } as StoreCampaignOffer;
const context = {
  storeSlug: 'demo',
  categories: [category, subcategory],
  collections: [collection],
  products: [product],
  offers: [offer],
};

describe('resolveHeroCtaHref', () => {
  it('sends the default menu CTA to the catalog page', () => {
    expect(resolveHeroCtaHref({ ctaTargetType: 'catalog', ctaTargetId: null, ctaTargetUrl: null }, context))
      .toBe('/s/demo/catalog');
  });

  it('resolves nested categories with parent and subcategory filters', () => {
    expect(resolveHeroCtaHref({ ctaTargetType: 'category', ctaTargetId: 'child', ctaTargetUrl: null }, context))
      .toBe('/s/demo/catalog?cat=comidas&sub=hamburguesas');
  });

  it('resolves collection, product, promotion and campaign destinations', () => {
    expect(resolveHeroCtaHref({ ctaTargetType: 'collection', ctaTargetId: 'collection', ctaTargetUrl: null }, context))
      .toBe('/s/demo/catalog?collection=combos');
    expect(resolveHeroCtaHref({ ctaTargetType: 'product', ctaTargetId: 'product', ctaTargetUrl: null }, context))
      .toBe('/s/demo/p/combo-familiar');
    expect(resolveHeroCtaHref({ ctaTargetType: 'sale', ctaTargetId: null, ctaTargetUrl: null }, context))
      .toBe('/s/demo/catalog?sale=1');
    expect(resolveHeroCtaHref({ ctaTargetType: 'offer', ctaTargetId: 'offer', ctaTargetUrl: null }, context))
      .toBe('/s/demo/o/martes-2x1');
  });

  it('keeps safe custom links and falls back when a destination is invalid', () => {
    expect(resolveHeroCtaHref({ ctaTargetType: 'custom', ctaTargetId: null, ctaTargetUrl: '/contacto' }, context))
      .toBe('/s/demo/contacto');
    expect(resolveHeroCtaHref({ ctaTargetType: 'custom', ctaTargetId: null, ctaTargetUrl: 'javascript:alert(1)' }, context))
      .toBe('/s/demo/catalog');
    expect(resolveHeroCtaHref({ ctaTargetType: 'product', ctaTargetId: 'deleted', ctaTargetUrl: null }, context))
      .toBe('/s/demo/catalog');
  });
});
