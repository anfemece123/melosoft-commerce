import type {
  StoreHomeSectionRow,
  StoreHomeSectionRowInsert,
  StoreHomeSectionRowUpdate,
  StoreHomeSectionItemRow,
  StoreHomeSectionItemRowInsert,
  StoreHomeSectionItemRowUpdate,
  PublicStoreHomeSectionRow,
  PublicStoreHomeSectionItemRow,
  Json,
} from '@/types/database.types';
import type { HomeSectionType, PublicHomeSection, PublicHomeSectionItem } from '@/types/common.types';
import {
  defaultHomeSectionContent,
  clampCatalogProductsMaxItems,
  type CatalogProductsOrder,
  type HomeSectionContent,
  type StoreHomeSection,
  type StoreHomeSectionInsert,
  type StoreHomeSectionUpdate,
  type StoreHomeSectionItem,
  type StoreHomeSectionItemInsert,
  type StoreHomeSectionItemUpdate,
} from './homeSections.types';
import {
  resolvePromoSectionSize,
  resolvePromoContentSize,
  resolvePromoButtonSize,
  resolvePromoContentWidth,
  resolvePromoSectionSpacing,
} from './promoBanner.types';
import {
  resolveCatalogNavMode,
  resolveCatalogNavStyle,
  resolveCatalogNavAlign,
  resolveCatalogNavVisibleCount,
  resolveManualCategoryIds,
} from './catalogNav.types';
import {
  resolveImageTextLayout,
  resolveImageTextImagePosition,
  resolveImageTextAspect,
  resolveImageTextRounded,
  resolveImageTextOverlay,
  resolveImageTextContentPosition,
  resolveImageTextTitleSize,
  resolveImageTextSubtitleSize,
  resolveImageTextButtonSize,
  resolveImageTextButtonStyle,
  resolveImageTextTitleColorMode,
  resolveImageTextSubtitleColorMode,
  resolveImageTextButtonColorMode,
  resolveImageTextTextAlign,
  resolveImageTextContentWidth,
  resolveImageTextSpacing,
  resolveImageTextContentBg,
  resolveImageTextBgOpacity,
  resolveImageTextSectionBg,
  resolveImageTextSectionSize,
  parseImageTextHexColor,
} from './imageTextSection.types';
import { resolveBenefitsLayout, resolveBenefitsItemSize, resolveBenefitsStyle } from './benefitSection.types';

function isHomeSectionType(value: unknown): value is HomeSectionType {
  return (
    value === 'hero' ||
    value === 'promo_banners' ||
    value === 'featured_products' ||
    value === 'featured_categories' ||
    value === 'testimonials' ||
    value === 'image_text' ||
    value === 'featured_collections' ||
    value === 'menu_highlights' ||
    value === 'benefits' ||
    value === 'gallery' ||
    value === 'catalog_products'
  );
}

function isCatalogProductsOrder(value: unknown): value is CatalogProductsOrder {
  return value === 'recent' || value === 'featured' || value === 'name_asc' || value === 'price_asc';
}

/** Defensive: unknown/malformed jsonb (or a shape mismatched with the
 * section's own type, e.g. after a manual DB edit) falls back to that
 * type's default content instead of throwing — same convention as
 * parseDescriptionSections in products.mapper.ts. */
export function parseHomeSectionContent(sectionType: HomeSectionType, raw: Json | null): HomeSectionContent {
  const fallback = defaultHomeSectionContent(sectionType);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const record = raw as Record<string, unknown>;

  switch (sectionType) {
    case 'promo_banners':
      return {
        sectionType,
        // Capped at 2 — a section saved with the old 'grid_3' (or any
        // other unrecognized value) degrades to 'grid_2', never throws
        // and never keeps a 3-column layout alive. Combined with the
        // renderer's own `.slice(0, 2)` safety net, an old 3-item section
        // renders its first 2 banners and simply drops the third.
        layout: record.layout === 'grid_1' ? 'grid_1' : 'grid_2',
        sectionSize: resolvePromoSectionSize(record.sectionSize),
        contentSize: resolvePromoContentSize(record.contentSize),
        buttonSize: resolvePromoButtonSize(record.buttonSize),
        contentWidth: resolvePromoContentWidth(record.contentWidth),
        spacing: resolvePromoSectionSpacing(record.spacing),
      };
    case 'featured_products':
      return {
        sectionType,
        selectionMode: record.selectionMode === 'manual' ? 'manual' : 'auto',
        maxItems: typeof record.maxItems === 'number' && record.maxItems > 0 ? record.maxItems : 8,
        columnsDesktop:
          typeof record.columnsDesktop === 'number' && record.columnsDesktop >= 2 && record.columnsDesktop <= 5
            ? record.columnsDesktop
            : 4,
        showViewAllButton: record.showViewAllButton !== false,
        viewAllLabel: typeof record.viewAllLabel === 'string' && record.viewAllLabel.trim() ? record.viewAllLabel : 'Ver catálogo',
        // Missing on any section saved before this field existed — defaults
        // every pre-existing "Productos destacados" section to the new
        // professional carousel the moment it's next loaded, with no
        // per-store migration/reconfiguration needed.
        layout: record.layout === 'grid' ? 'grid' : 'carousel',
      };
    case 'featured_categories':
      return {
        sectionType,
        selectionMode: record.selectionMode === 'manual' ? 'manual' : 'auto',
        maxItems: typeof record.maxItems === 'number' && record.maxItems > 0 ? record.maxItems : 6,
      };
    case 'testimonials':
      return {
        sectionType,
        layout: record.layout === 'carousel' ? 'carousel' : 'grid',
      };
    case 'image_text': {
      // Legacy bridge: a section saved before this field set shipped only
      // has `background: 'light'|'normal'` and no `sectionBg` key — map it
      // to the equivalent new value so the section keeps its exact current
      // look (light-highlighted vs. plain) the first time it's reloaded,
      // with no per-store migration needed.
      const legacySectionBg = record.sectionBg === undefined && typeof record.background === 'string'
        ? (record.background === 'light' ? 'theme' : 'none')
        : undefined;
      return {
        sectionType,
        imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : null,
        linkUrl: typeof record.linkUrl === 'string' ? record.linkUrl : null,
        linkLabel: typeof record.linkLabel === 'string' ? record.linkLabel : null,
        eyebrow: typeof record.eyebrow === 'string' && record.eyebrow.trim() ? record.eyebrow : null,
        layout: resolveImageTextLayout(record.layout),
        imagePosition: resolveImageTextImagePosition(record.imagePosition),
        aspect: resolveImageTextAspect(record.aspect),
        rounded: resolveImageTextRounded(record.rounded),
        overlay: resolveImageTextOverlay(record.overlay),
        contentPosition: resolveImageTextContentPosition(record.contentPosition),
        titleSize: resolveImageTextTitleSize(record.titleSize),
        subtitleSize: resolveImageTextSubtitleSize(record.subtitleSize),
        buttonSize: resolveImageTextButtonSize(record.buttonSize),
        titleColorMode: resolveImageTextTitleColorMode(record.titleColorMode),
        customTitleColor: parseImageTextHexColor(record.customTitleColor),
        subtitleColorMode: resolveImageTextSubtitleColorMode(record.subtitleColorMode),
        customSubtitleColor: parseImageTextHexColor(record.customSubtitleColor),
        buttonColorMode: resolveImageTextButtonColorMode(record.buttonColorMode),
        customButtonColor: parseImageTextHexColor(record.customButtonColor),
        buttonStyle: resolveImageTextButtonStyle(record.buttonStyle),
        textAlign: resolveImageTextTextAlign(record.textAlign),
        contentWidth: resolveImageTextContentWidth(record.contentWidth),
        spacing: resolveImageTextSpacing(record.spacing),
        contentBg: resolveImageTextContentBg(record.contentBg),
        customContentBgColor: parseImageTextHexColor(record.customContentBgColor),
        contentBgOpacity: resolveImageTextBgOpacity(record.contentBgOpacity),
        contentBgBlur: record.contentBgBlur === true,
        sectionBg: resolveImageTextSectionBg(legacySectionBg ?? record.sectionBg),
        customSectionBgColor: parseImageTextHexColor(record.customSectionBgColor),
        sectionSize: resolveImageTextSectionSize(record.sectionSize),
      };
    }
    case 'gallery':
      return {
        sectionType,
        layout: record.layout === 'carousel' ? 'carousel' : 'grid',
      };
    case 'catalog_products':
      return {
        sectionType,
        maxItems: clampCatalogProductsMaxItems(typeof record.maxItems === 'number' ? record.maxItems : 8),
        order: isCatalogProductsOrder(record.order) ? record.order : 'recent',
        layout: record.layout === 'grid' ? 'grid' : 'carousel',
        columnsDesktop:
          typeof record.columnsDesktop === 'number' && record.columnsDesktop >= 2 && record.columnsDesktop <= 5
            ? record.columnsDesktop
            : 4,
        visibleMobile: record.visibleMobile === 2 ? 2 : 1,
        showViewAllButton: record.showViewAllButton !== false,
        viewAllLabel:
          typeof record.viewAllLabel === 'string' && record.viewAllLabel.trim() ? record.viewAllLabel : 'Ver catálogo completo',
        // Every field below is new — missing on any section saved before
        // this shipped, so it falls through to `showCategoryNav: false`,
        // which renders identically to today (no nav row at all).
        showCategoryNav: record.showCategoryNav === true,
        categoryNavMode: resolveCatalogNavMode(record.categoryNavMode),
        manualCategoryIds: resolveManualCategoryIds(record.manualCategoryIds),
        defaultCategoryId: typeof record.defaultCategoryId === 'string' ? record.defaultCategoryId : null,
        navStyle: resolveCatalogNavStyle(record.navStyle),
        navAlign: resolveCatalogNavAlign(record.navAlign),
        maxVisibleCategories: resolveCatalogNavVisibleCount(record.maxVisibleCategories),
      };
    case 'benefits':
      return {
        sectionType,
        // Every field below is new — missing on any section saved before
        // this shipped, so it falls through to the same defaults as
        // defaultHomeSectionContent, which render identically to today's
        // fixed grid/icon-badge look (see BenefitsSectionRenderer.tsx).
        layout: resolveBenefitsLayout(record.layout),
        itemSize: resolveBenefitsItemSize(record.itemSize),
        style: resolveBenefitsStyle(record.style),
        showArrows: record.showArrows !== false,
        showDots: record.showDots !== false,
        autoScroll: record.autoScroll === true,
      };
    case 'hero':
    case 'featured_collections':
    case 'menu_highlights':
      return fallback;
  }
}

export function serializeHomeSectionContent(content: HomeSectionContent): Json {
  const rest: Record<string, unknown> = { ...content };
  delete rest.sectionType;
  return rest as Json;
}

export function mapStoreHomeSectionRowToStoreHomeSection(row: StoreHomeSectionRow): StoreHomeSection {
  const sectionType = isHomeSectionType(row.section_type) ? row.section_type : 'hero';
  return {
    id: row.id,
    storeId: row.store_id,
    sectionType,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    heading: row.heading,
    subheading: row.subheading,
    content: parseHomeSectionContent(sectionType, row.content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreHomeSectionInsertToRow(data: StoreHomeSectionInsert): StoreHomeSectionRowInsert {
  return {
    store_id: data.storeId,
    section_type: data.sectionType,
    sort_order: data.sortOrder,
    is_active: data.isActive,
    heading: data.heading ?? null,
    subheading: data.subheading ?? null,
    content: serializeHomeSectionContent(data.content),
  };
}

export function mapStoreHomeSectionUpdateToRow(data: StoreHomeSectionUpdate): StoreHomeSectionRowUpdate {
  const row: StoreHomeSectionRowUpdate = {};
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  if (data.heading !== undefined) row.heading = data.heading ?? null;
  if (data.subheading !== undefined) row.subheading = data.subheading ?? null;
  if (data.content !== undefined) row.content = serializeHomeSectionContent(data.content);
  return row;
}

function parseItemSettingsJson(raw: Json): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function mapStoreHomeSectionItemRowToStoreHomeSectionItem(
  row: StoreHomeSectionItemRow
): StoreHomeSectionItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    storeId: row.store_id,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    linkedEntityType:
      row.linked_entity_type === 'product' ||
      row.linked_entity_type === 'category' ||
      row.linked_entity_type === 'collection'
        ? row.linked_entity_type
        : null,
    linkedEntityId: row.linked_entity_id,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    linkLabel: row.link_label,
    rating: row.rating,
    settings: parseItemSettingsJson(row.settings),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreHomeSectionItemInsertToRow(
  data: StoreHomeSectionItemInsert
): StoreHomeSectionItemRowInsert {
  return {
    section_id: data.sectionId,
    store_id: data.storeId,
    sort_order: data.sortOrder,
    is_active: data.isActive,
    linked_entity_type: data.linkedEntityType ?? null,
    linked_entity_id: data.linkedEntityId ?? null,
    title: data.title ?? null,
    subtitle: data.subtitle ?? null,
    body: data.body ?? null,
    image_url: data.imageUrl ?? null,
    link_url: data.linkUrl ?? null,
    link_label: data.linkLabel ?? null,
    rating: data.rating ?? null,
    settings: (data.settings ?? {}) as Json,
  };
}

export function mapStoreHomeSectionItemUpdateToRow(
  data: StoreHomeSectionItemUpdate
): StoreHomeSectionItemRowUpdate {
  const row: StoreHomeSectionItemRowUpdate = {};
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  if (data.linkedEntityType !== undefined) row.linked_entity_type = data.linkedEntityType ?? null;
  if (data.linkedEntityId !== undefined) row.linked_entity_id = data.linkedEntityId ?? null;
  if (data.title !== undefined) row.title = data.title ?? null;
  if (data.subtitle !== undefined) row.subtitle = data.subtitle ?? null;
  if (data.body !== undefined) row.body = data.body ?? null;
  if (data.imageUrl !== undefined) row.image_url = data.imageUrl ?? null;
  if (data.linkUrl !== undefined) row.link_url = data.linkUrl ?? null;
  if (data.linkLabel !== undefined) row.link_label = data.linkLabel ?? null;
  if (data.rating !== undefined) row.rating = data.rating ?? null;
  if (data.settings !== undefined) row.settings = (data.settings ?? {}) as Json;
  return row;
}

export function mapPublicStoreHomeSectionItemRowToPublicHomeSectionItem(
  row: PublicStoreHomeSectionItemRow
): PublicHomeSectionItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    sortOrder: row.sort_order,
    linkedEntityType:
      row.linked_entity_type === 'product' ||
      row.linked_entity_type === 'category' ||
      row.linked_entity_type === 'collection'
        ? row.linked_entity_type
        : null,
    linkedEntityId: row.linked_entity_id,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    linkLabel: row.link_label,
    rating: row.rating,
    settings: parseItemSettingsJson(row.settings),
  };
}

export function mapPublicStoreHomeSectionRowToPublicHomeSection(
  row: PublicStoreHomeSectionRow,
  items: PublicHomeSectionItem[]
): PublicHomeSection {
  const sectionType = isHomeSectionType(row.section_type) ? row.section_type : 'hero';
  return {
    id: row.id,
    storeId: row.store_id,
    sectionType,
    sortOrder: row.sort_order,
    heading: row.heading,
    subheading: row.subheading,
    content: parseHomeSectionContent(sectionType, row.content) as unknown as Record<string, unknown>,
    items,
  };
}

/** Converts an already-loaded, already-parsed admin StoreHomeSection +
 * its StoreHomeSectionItem[] into the PublicHomeSection shape the *public*
 * section renderers expect — used by the Diseño de inicio canvas so each
 * section card can render through the real HomeSectionRenderer (via
 * StorefrontSectionPreviewFrame) instead of a simplified admin-only
 * preview. Only active items are included, mirroring what
 * public_store_home_section_items would actually return once live. */
export function mapStoreHomeSectionToPublicPreviewSection(
  section: StoreHomeSection,
  items: StoreHomeSectionItem[]
): PublicHomeSection {
  return {
    id: section.id,
    storeId: section.storeId,
    sectionType: section.sectionType,
    sortOrder: section.sortOrder,
    heading: section.heading,
    subheading: section.subheading,
    content: section.content as unknown as Record<string, unknown>,
    items: items
      .filter((item) => item.isActive)
      .map((item) => ({
        id: item.id,
        sectionId: item.sectionId,
        sortOrder: item.sortOrder,
        linkedEntityType: item.linkedEntityType,
        linkedEntityId: item.linkedEntityId,
        title: item.title,
        subtitle: item.subtitle,
        body: item.body,
        imageUrl: item.imageUrl,
        linkUrl: item.linkUrl,
        linkLabel: item.linkLabel,
        rating: item.rating,
        settings: item.settings,
      })),
  };
}
