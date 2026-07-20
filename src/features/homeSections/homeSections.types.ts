import type { HomeSectionType } from '@/types/common.types';
import type { PromoSectionSize, PromoContentSize, PromoButtonSize, PromoContentWidth, PromoSectionSpacing } from './promoBanner.types';
import type { CatalogNavMode, CatalogNavStyle, CatalogNavAlign, CatalogNavVisibleCount } from './catalogNav.types';
import type {
  ImageTextLayout,
  ImageTextImagePosition,
  ImageTextAspect,
  ImageTextRounded,
  ImageTextOverlay,
  ImageTextContentPosition,
  ImageTextTitleSize,
  ImageTextSubtitleSize,
  ImageTextButtonSize,
  ImageTextButtonStyle,
  ImageTextColorMode,
  ImageTextTextAlign,
  ImageTextContentWidth,
  ImageTextSpacing,
  ImageTextContentBg,
  ImageTextBgOpacity,
  ImageTextSectionBg,
  ImageTextSectionSize,
} from './imageTextSection.types';
import type { BenefitsLayout, BenefitsItemSize, BenefitsStyle } from './benefitSection.types';

export interface StoreHomeSection {
  id: string;
  storeId: string;
  sectionType: HomeSectionType;
  sortOrder: number;
  isActive: boolean;
  heading: string | null;
  subheading: string | null;
  content: HomeSectionContent;
  createdAt: string;
  updatedAt: string;
}

export type StoreHomeSectionInsert = Omit<StoreHomeSection, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type StoreHomeSectionUpdate = Partial<
  Omit<StoreHomeSectionInsert, 'storeId' | 'sectionType'>
>;

export interface StoreHomeSectionItem {
  id: string;
  sectionId: string;
  storeId: string;
  sortOrder: number;
  isActive: boolean;
  linkedEntityType: 'product' | 'category' | 'collection' | null;
  linkedEntityId: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  rating: number | null;
  /** Type-specific per-item visual settings (currently only used by
   * promo_banners — see promoBanner.types.ts). */
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type StoreHomeSectionItemInsert = Omit<
  StoreHomeSectionItem,
  'id' | 'createdAt' | 'updatedAt'
> & { id?: string };

export type StoreHomeSectionItemUpdate = Partial<
  Omit<StoreHomeSectionItemInsert, 'sectionId' | 'storeId'>
>;

// Discriminated union decoded from/encoded into `content` jsonb, keyed by
// section_type. 'hero' is kept only for backward-compat/defensive decoding
// of any pre-existing row (see homeSections.mapper.ts) — it is no longer
// offered anywhere in the admin UI. The hero/cover is owned entirely by
// stores.hero_enabled + store_hero_slides (StoreSettingsPage), never by
// the Home Builder.
export type CatalogProductsOrder = 'recent' | 'featured' | 'name_asc' | 'price_asc';

export const CATALOG_PRODUCTS_MIN_ITEMS = 4;
export const CATALOG_PRODUCTS_MAX_ITEMS = 24;
export const CATALOG_PRODUCTS_DEFAULT_ITEMS = 8;

export function clampCatalogProductsMaxItems(value: number): number {
  if (!Number.isFinite(value)) return CATALOG_PRODUCTS_DEFAULT_ITEMS;
  return Math.min(CATALOG_PRODUCTS_MAX_ITEMS, Math.max(CATALOG_PRODUCTS_MIN_ITEMS, Math.round(value)));
}

export type HomeSectionContent =
  | { sectionType: 'hero' }
  // `style` (cards/full_image/compact) existed here before per-banner
  // layout/background settings (promoBanner.types.ts) — each banner now
  // picks its own visual treatment, so the section only needs the grid
  // arrangement (how many banners per row) plus four independent uniform
  // size axes applied to every banner (see promoBanner.types.ts): shell
  // size, content (typography) size, button size and content width.
  | {
      sectionType: 'promo_banners';
      // Capped at 2 — see promoBannerCountForLayout's doc comment.
      layout: 'grid_1' | 'grid_2';
      sectionSize: PromoSectionSize;
      contentSize: PromoContentSize;
      buttonSize: PromoButtonSize;
      contentWidth: PromoContentWidth;
      spacing: PromoSectionSpacing;
    }
  | {
      sectionType: 'featured_products';
      selectionMode: 'manual' | 'auto';
      maxItems: number;
      columnsDesktop: number;
      showViewAllButton: boolean;
      viewAllLabel: string;
      layout: 'grid' | 'carousel';
    }
  | {
      sectionType: 'featured_categories';
      selectionMode: 'manual' | 'auto';
      maxItems: number;
    }
  | { sectionType: 'testimonials'; layout: 'grid' | 'carousel' }
  | {
      sectionType: 'image_text';
      imageUrl: string | null;
      linkUrl: string | null;
      linkLabel: string | null;
      eyebrow: string | null;
      layout: ImageTextLayout;
      imagePosition: ImageTextImagePosition;
      aspect: ImageTextAspect;
      rounded: ImageTextRounded;
      // Legibility scrim — only meaningful for layout 'background'.
      overlay: ImageTextOverlay;
      // 9-grid placement — only meaningful for layout 'background'/'card_overlay'.
      contentPosition: ImageTextContentPosition;
      titleSize: ImageTextTitleSize;
      subtitleSize: ImageTextSubtitleSize;
      buttonSize: ImageTextButtonSize;
      titleColorMode: ImageTextColorMode;
      customTitleColor: string | null;
      subtitleColorMode: ImageTextColorMode;
      customSubtitleColor: string | null;
      buttonColorMode: ImageTextColorMode;
      customButtonColor: string | null;
      buttonStyle: ImageTextButtonStyle;
      textAlign: ImageTextTextAlign;
      contentWidth: ImageTextContentWidth;
      spacing: ImageTextSpacing;
      contentBg: ImageTextContentBg;
      customContentBgColor: string | null;
      contentBgOpacity: ImageTextBgOpacity;
      contentBgBlur: boolean;
      sectionBg: ImageTextSectionBg;
      customSectionBgColor: string | null;
      sectionSize: ImageTextSectionSize;
    }
  | { sectionType: 'featured_collections' } // not offered yet — architecture only
  | { sectionType: 'menu_highlights' } // not offered yet — architecture only
  | {
      sectionType: 'benefits';
      layout: BenefitsLayout;
      itemSize: BenefitsItemSize;
      style: BenefitsStyle;
      // carousel only
      showArrows: boolean;
      showDots: boolean;
      // band/logos only
      autoScroll: boolean;
    }
  | { sectionType: 'gallery'; layout: 'grid' | 'carousel' }
  | {
      sectionType: 'catalog_products';
      maxItems: number;
      order: CatalogProductsOrder;
      layout: 'grid' | 'carousel';
      columnsDesktop: number;
      visibleMobile: number;
      showViewAllButton: boolean;
      viewAllLabel: string;
      // Category-tabs navigation shown above the grid/carousel — off by
      // default so every section saved before this shipped renders
      // identically until the owner opts in from the wizard.
      showCategoryNav: boolean;
      categoryNavMode: CatalogNavMode;
      manualCategoryIds: string[];
      // null = "Todo" (the always-present default tab).
      defaultCategoryId: string | null;
      navStyle: CatalogNavStyle;
      navAlign: CatalogNavAlign;
      maxVisibleCategories: CatalogNavVisibleCount;
    };

export const HOME_SECTION_TYPE_LABELS: Record<HomeSectionType, string> = {
  hero: 'Portada / Hero',
  promo_banners: 'Banners promocionales',
  featured_products: 'Productos destacados',
  featured_categories: 'Categorías destacadas',
  testimonials: 'Testimonios',
  image_text: 'Imagen con texto',
  featured_collections: 'Colecciones destacadas',
  menu_highlights: 'Destacados del menú',
  benefits: 'Beneficios',
  gallery: 'Galería de imágenes',
  catalog_products: 'Catálogo de productos',
};

export const HOME_SECTION_TYPE_DESCRIPTIONS: Record<HomeSectionType, string> = {
  hero: 'La portada principal de la tienda (se edita desde Configuración).',
  promo_banners: 'Muestra promociones, campañas o descuentos con imagen y enlace.',
  featured_products: 'Muestra productos seleccionados a mano o automáticamente en el inicio.',
  featured_categories: 'Accesos directos a las categorías de tu catálogo.',
  testimonials: 'Reseñas o comentarios de tus clientes.',
  image_text: 'Un bloque de imagen junto a un texto y un botón opcional.',
  featured_collections: 'Colecciones destacadas de tu catálogo.',
  menu_highlights: 'Platos o productos destacados del menú.',
  benefits: 'Beneficios, marcas, aliados, métodos de pago o sellos de confianza — con grid, carrusel o banda de logos.',
  gallery: 'Una galería visual de imágenes.',
  catalog_products: 'Muestra una selección de productos de tu catálogo con enlace al catálogo completo.',
};

// Which types are actually offered in "Agregar sección" right now. 'hero'
// is intentionally excluded — the cover/hero is configured from Store
// Settings, never created as a Home Builder section (see decision in the
// UX-fix pass). 'featured_collections'/'menu_highlights' remain
// architecture-only (valid section_type, mapper and renderer registry
// already know about them) until their own editor+renderer ship — turning
// one on later is additive, never a migration.
export const AVAILABLE_SECTION_TYPES: HomeSectionType[] = [
  'promo_banners',
  'featured_products',
  'catalog_products',
  'featured_categories',
  'testimonials',
  'image_text',
  'benefits',
  'gallery',
];

export const PENDING_SECTION_TYPES: HomeSectionType[] = ['featured_collections', 'menu_highlights'];

export function defaultHomeSectionContent(sectionType: HomeSectionType): HomeSectionContent {
  switch (sectionType) {
    case 'promo_banners':
      return {
        sectionType,
        layout: 'grid_2',
        sectionSize: 'normal',
        contentSize: 'normal',
        buttonSize: 'normal',
        contentWidth: 'medium',
        spacing: 'normal',
      };
    case 'featured_products':
      return {
        sectionType,
        selectionMode: 'auto',
        maxItems: 8,
        columnsDesktop: 4,
        showViewAllButton: true,
        viewAllLabel: 'Ver catálogo',
        layout: 'carousel',
      };
    case 'featured_categories':
      return { sectionType, selectionMode: 'auto', maxItems: 6 };
    case 'testimonials':
      return { sectionType, layout: 'grid' };
    case 'image_text':
      return {
        sectionType,
        imageUrl: null,
        linkUrl: null,
        linkLabel: null,
        eyebrow: null,
        layout: 'side_by_side',
        imagePosition: 'left',
        aspect: 'landscape',
        rounded: 'xl',
        overlay: 'medium',
        contentPosition: 'center',
        titleSize: 'md',
        subtitleSize: 'md',
        buttonSize: 'md',
        titleColorMode: 'theme_text',
        customTitleColor: null,
        subtitleColorMode: 'theme_muted',
        customSubtitleColor: null,
        buttonColorMode: 'theme_primary',
        customButtonColor: null,
        buttonStyle: 'solid',
        textAlign: 'left',
        contentWidth: 'medium',
        spacing: 'normal',
        contentBg: 'none',
        customContentBgColor: null,
        contentBgOpacity: 'solid',
        contentBgBlur: false,
        sectionBg: 'none',
        customSectionBgColor: null,
        sectionSize: 'normal',
      };
    case 'gallery':
      return { sectionType, layout: 'grid' };
    case 'catalog_products':
      return {
        sectionType,
        maxItems: CATALOG_PRODUCTS_DEFAULT_ITEMS,
        order: 'recent',
        layout: 'carousel',
        columnsDesktop: 4,
        visibleMobile: 1,
        showViewAllButton: true,
        viewAllLabel: 'Ver catálogo completo',
        showCategoryNav: false,
        categoryNavMode: 'all',
        manualCategoryIds: [],
        defaultCategoryId: null,
        navStyle: 'pills',
        navAlign: 'left',
        maxVisibleCategories: 6,
      };
    case 'benefits':
      return {
        sectionType,
        layout: 'grid',
        itemSize: 'normal',
        style: 'minimal',
        showArrows: true,
        showDots: true,
        autoScroll: false,
      };
    case 'hero':
    case 'featured_collections':
    case 'menu_highlights':
      return { sectionType };
  }
}

export function defaultHomeSectionHeading(sectionType: HomeSectionType): string | null {
  switch (sectionType) {
    case 'promo_banners':
      return 'Promociones';
    case 'featured_products':
      return 'Productos destacados';
    case 'featured_categories':
      return 'Categorías destacadas';
    case 'testimonials':
      return 'Lo que dicen nuestros clientes';
    case 'benefits':
      return 'Por qué comprar con nosotros';
    case 'gallery':
      return 'Galería';
    case 'catalog_products':
      return 'Explora nuestro catálogo';
    case 'image_text':
    default:
      return null;
  }
}

/** Default subheading is not modeled by defaultHomeSectionHeading (which
 * only covers the single `heading` field) — catalog_products is the first
 * section type whose default copy needs both, since its wizard ships a
 * ready-to-use subheading out of the box instead of leaving it empty like
 * every other type. */
export function defaultHomeSectionSubheading(sectionType: HomeSectionType): string | null {
  return sectionType === 'catalog_products' ? 'Encuentra productos seleccionados para ti' : null;
}

/** Which section types manage a repeatable list of items (banners,
 * testimonials, benefits, gallery images) vs. a single-instance config
 * (featured products/categories store their picks as items too, but the
 * wizard treats them as a "selection" step, not a free-form item list). */
export function sectionUsesFreeformItems(sectionType: HomeSectionType): boolean {
  return sectionType === 'promo_banners' || sectionType === 'testimonials' || sectionType === 'benefits' || sectionType === 'gallery';
}

export function sectionUsesEntityPicker(sectionType: HomeSectionType): boolean {
  return sectionType === 'featured_products' || sectionType === 'featured_categories';
}
