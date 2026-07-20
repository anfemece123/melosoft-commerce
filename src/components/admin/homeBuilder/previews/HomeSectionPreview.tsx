import { useEffect, useMemo, useState } from 'react';
import { homeSectionsService } from '@/features/homeSections/homeSectionsService';
import { mapStoreHomeSectionToPublicPreviewSection } from '@/features/homeSections/homeSections.mapper';
import type { StoreHomeSection, StoreHomeSectionItem } from '@/features/homeSections/homeSections.types';
import type { PublicProductPage, PublicStoreCategory } from '@/types/common.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import {
  StorefrontSectionPreviewFrame,
  type PreviewDevice,
} from '@/components/admin/homeBuilder/previewFrame/StorefrontSectionPreviewFrame';
import { sectionHasRenderableContent } from '@/components/admin/homeBuilder/previewFrame/sectionRenderableContent';

interface HomeSectionPreviewProps {
  section: StoreHomeSection;
  device: PreviewDevice;
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  showCartButton: boolean;
  productCardCtaLabel: string;
  /** Loaded once by HomeBuilderPage (Promise.all alongside the sections
   * fetch) and threaded down through the canvas — every card resolves its
   * preview against these in-memory lists instead of firing its own
   * products/categories fetch per card. */
  publicProducts: PublicProductPage[];
  categories: PublicStoreCategory[];
}

const NO_ITEMS_SECTION_TYPES = new Set<StoreHomeSection['sectionType']>(['image_text', 'catalog_products']);

/** Canvas counterpart to the wizard's WizardLivePreview — same
 * StorefrontSectionPreviewFrame, same real HomeSectionRenderer, so a
 * section on the "Diseño de inicio" list looks like a small, faithful
 * fragment of the actual public page instead of an admin-only
 * approximation. Only the items fetch is canvas-specific (a saved section
 * needs its own `getStoreHomeSectionItems` call — the wizard's draft
 * already has its items in memory). */
export function HomeSectionPreview({
  section,
  device,
  theme,
  storeSlug,
  currency,
  isMenu,
  showCartButton,
  productCardCtaLabel,
  publicProducts,
  categories,
}: HomeSectionPreviewProps) {
  const [items, setItems] = useState<StoreHomeSectionItem[]>([]);
  const [loading, setLoading] = useState(!NO_ITEMS_SECTION_TYPES.has(section.sectionType));

  useEffect(() => {
    if (NO_ITEMS_SECTION_TYPES.has(section.sectionType)) return;
    let cancelled = false;
    homeSectionsService
      .getStoreHomeSectionItems(section.id)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => { /* preview is best-effort — an empty preview is fine */ })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section.id, section.sectionType]);

  const rootCategoriesCount = useMemo(() => categories.filter((category) => !category.parentId).length, [categories]);
  const previewSection = useMemo(() => mapStoreHomeSectionToPublicPreviewSection(section, items), [section, items]);

  if (loading) {
    return <div className="h-24 animate-pulse rounded-xl bg-gray-100" />;
  }

  const hasContent = sectionHasRenderableContent(
    section.content,
    section.heading,
    section.subheading,
    items,
    publicProducts.length,
    rootCategoriesCount
  );

  return (
    <StorefrontSectionPreviewFrame
      section={previewSection}
      hasContent={hasContent}
      device={device}
      theme={theme}
      storeSlug={storeSlug}
      currency={currency}
      isMenu={isMenu}
      showCartButton={showCartButton}
      productCardCtaLabel={productCardCtaLabel}
      publicProducts={publicProducts}
      categories={categories}
      mobilePreviewScale={0.78}
      mobileMaxHeight={420}
      mobileClipMode="fade"
    />
  );
}
