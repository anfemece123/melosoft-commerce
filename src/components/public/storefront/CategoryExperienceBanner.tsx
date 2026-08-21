import type { PublicCategoryExperience, PublicStoreHeroSlide } from '@/types/common.types';
import { StorefrontHero } from './StorefrontHero';
import type { StorefrontTheme } from './storefrontTheme';

interface CategoryExperienceBannerProps {
  theme: StorefrontTheme;
  experience: PublicCategoryExperience;
}

/** Image-only contextual cover rendered with the exact same hero component as
 * the storefront home. Keeping one implementation prevents the catalog mode
 * from drifting in height, spacing, cropping, overlays, or responsive rules.
 */
export function CategoryExperienceBanner({ theme, experience }: CategoryExperienceBannerProps) {
  const coverSlide: PublicStoreHeroSlide = {
    id: `category-experience-cover-${experience.id}`,
    storeId: experience.storeId,
    sortOrder: 0,
    isActive: true,
    showTitle: false,
    showSubtitle: false,
    showCta: false,
    showMainImage: false,
    showBadgeImage: false,
    title: null,
    subtitle: null,
    ctaLabel: null,
    ctaTargetType: 'catalog',
    ctaTargetId: null,
    ctaTargetUrl: null,
    mainImageUrl: null,
    backgroundImageUrl: experience.coverImageUrl,
    badgeImageUrl: null,
  };

  return (
    <div className="-mx-4 -mt-6 mb-6 w-[calc(100%+2rem)] sm:-mx-6 sm:-mt-8 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]">
      <StorefrontHero
        theme={theme}
        storeName={experience.displayName}
        storeLogoUrl={null}
        dataTestId="category-experience-banner"
        getCtaHref={() => '#'}
        fallbackCtaLabel=""
        slides={[coverSlide]}
      />
    </div>
  );
}
