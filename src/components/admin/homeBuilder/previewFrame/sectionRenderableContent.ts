import type { HomeSectionContent } from '@/features/homeSections/homeSections.types';

/** Structural shape shared by HomeSectionDraftItem and StoreHomeSectionItem
 * — everything sectionHasRenderableContent needs, nothing section- or
 * draft-specific, so one function serves both the wizard's live draft and
 * the canvas's already-saved sections without duplicating this switch. */
export interface RenderableItemLike {
  isActive: boolean;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  linkedEntityType: 'product' | 'category' | 'collection' | null;
  linkedEntityId: string | null;
}

/** Whether HomeSectionRenderer would actually draw anything for this
 * content right now — mirrors each public renderer's own bail-out
 * condition (e.g. FeaturedProductsSectionRenderer returns null when
 * resolvedProducts is empty) so a preview can show a friendly empty state
 * instead of a blank panel, without duplicating each renderer's full
 * resolution logic. */
export function sectionHasRenderableContent(
  content: HomeSectionContent,
  _heading: string | null,
  _subheading: string | null,
  items: RenderableItemLike[],
  publicProductsCount: number,
  rootCategoriesCount: number
): boolean {
  const activeItems = items.filter((item) => item.isActive);
  switch (content.sectionType) {
    case 'promo_banners':
      return activeItems.some((item) => Boolean(item.imageUrl) || Boolean(item.title?.trim()));
    case 'featured_products':
      return content.selectionMode === 'manual'
        ? activeItems.some((item) => item.linkedEntityType === 'product' && item.linkedEntityId)
        : publicProductsCount > 0;
    case 'catalog_products':
      return publicProductsCount > 0;
    case 'featured_categories':
      // Auto mode only shows root categories (see
      // FeaturedCategoriesSectionRenderer) — a store with only
      // subcategories and no roots would render nothing, same as here.
      return content.selectionMode === 'manual'
        ? activeItems.some((item) => item.linkedEntityType === 'category' && item.linkedEntityId)
        : rootCategoriesCount > 0;
    case 'testimonials':
      return activeItems.some((item) => Boolean(item.title?.trim()) || Boolean(item.body?.trim()));
    case 'image_text':
      // ImageTextSectionRenderer never bails to null — a fully blank
      // section still renders its real shell (a gray fallback image box,
      // no text), which IS the accurate preview of an unfinished section,
      // so there's no separate "empty state" to show instead.
      return true;
    case 'benefits':
      // Matches BenefitsSectionRenderer's own filter exactly — a
      // logos/marcas item can be image-only with no title.
      return activeItems.some((item) => Boolean(item.title?.trim()) || Boolean(item.imageUrl));
    case 'gallery':
      return activeItems.some((item) => Boolean(item.imageUrl));
    default:
      return false;
  }
}
