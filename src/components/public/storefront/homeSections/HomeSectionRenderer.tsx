import type { MouseEvent } from 'react';
import type { PublicHomeSection, PublicProductPage, PublicStoreCategory } from '@/types/common.types';
import type { StorefrontTheme } from '../storefrontTheme';
import { PromoBannersSectionRenderer } from './PromoBannersSectionRenderer';
import { FeaturedProductsSectionRenderer } from './FeaturedProductsSectionRenderer';
import { CatalogProductsSectionRenderer } from './CatalogProductsSectionRenderer';
import { FeaturedCategoriesSectionRenderer } from './FeaturedCategoriesSectionRenderer';
import { TestimonialsSectionRenderer } from './TestimonialsSectionRenderer';
import { ImageTextSectionRenderer } from './ImageTextSectionRenderer';
import { BenefitsSectionRenderer } from './BenefitsSectionRenderer';
import { GallerySectionRenderer } from './GallerySectionRenderer';

interface HomeSectionRendererProps {
  section: PublicHomeSection;
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  showCartButton: boolean;
  productCardCtaLabel: string;
  products: PublicProductPage[];
  categories: PublicStoreCategory[];
  unavailableProductIds: Set<string>;
  onAddToCart?: (event: MouseEvent<HTMLElement>, product: PublicProductPage) => void;
}

/** Dispatches a single active Home Builder section to its public renderer.
 * 'hero' is never dispatched here — StoreHomePage renders the portada
 * unconditionally via StorefrontHero, independent of the Home Builder, and
 * filters any 'hero' row out before this component ever sees the list.
 * Returns null defensively for any section_type without a renderer yet
 * (e.g. 'featured_collections'/'menu_highlights', valid in the DB check
 * constraint but not offered in the admin picker) so a stale/future value
 * never crashes the storefront. */
export function HomeSectionRenderer(props: HomeSectionRendererProps) {
  const { section } = props;

  switch (section.sectionType) {
    case 'promo_banners':
      return <PromoBannersSectionRenderer section={section} theme={props.theme} />;
    case 'featured_products':
      return (
        <FeaturedProductsSectionRenderer
          section={section}
          products={props.products}
          categories={props.categories}
          theme={props.theme}
          storeSlug={props.storeSlug}
          currency={props.currency}
          isMenu={props.isMenu}
          showCartButton={props.showCartButton}
          productCardCtaLabel={props.productCardCtaLabel}
          unavailableProductIds={props.unavailableProductIds}
          onAddToCart={props.onAddToCart}
        />
      );
    case 'catalog_products':
      return (
        <CatalogProductsSectionRenderer
          section={section}
          products={props.products}
          categories={props.categories}
          theme={props.theme}
          storeSlug={props.storeSlug}
          currency={props.currency}
          isMenu={props.isMenu}
          showCartButton={props.showCartButton}
          productCardCtaLabel={props.productCardCtaLabel}
          unavailableProductIds={props.unavailableProductIds}
          onAddToCart={props.onAddToCart}
        />
      );
    case 'featured_categories':
      return (
        <FeaturedCategoriesSectionRenderer
          section={section}
          categories={props.categories}
          theme={props.theme}
          storeSlug={props.storeSlug}
        />
      );
    case 'testimonials':
      return <TestimonialsSectionRenderer section={section} theme={props.theme} />;
    case 'image_text':
      return <ImageTextSectionRenderer section={section} theme={props.theme} />;
    case 'benefits':
      return <BenefitsSectionRenderer section={section} theme={props.theme} />;
    case 'gallery':
      return <GallerySectionRenderer section={section} theme={props.theme} />;
    default:
      return null;
  }
}
