export type ImageAssetKind =
  | 'store_logo'
  | 'store_favicon'
  | 'header_icon'
  | 'store_hero'
  | 'store_hero_badge'
  | 'store_hero_background'
  | 'carta_cover'
  | 'product_image'
  | 'review_image'
  | 'catalog_taxonomy_image'
  | 'offer_hero'
  | 'home_section_image'
  | 'promo_banner_wide'
  | 'promo_banner_split';

export interface ImageAssetPreset {
  kind: ImageAssetKind;
  label: string;
  aspectRatio: number;
  /** Quality recommendation shown to the user; it is not a hard gate. */
  minWidth: number;
  minHeight: number;
  /** Smallest crop that remains usable for this placement. */
  minimumCropWidth: number;
  minimumCropHeight: number;
  recommendedWidth: number;
  recommendedHeight: number;
  /** Maximum size accepted from the user's device before local processing. */
  maxBytes: number;
  /** Maximum target for the optimized file that is actually uploaded. */
  maxOutputBytes: number;
  shape: 'circle' | 'rounded';
}

export const IMAGE_ASSET_PRESETS: Record<ImageAssetKind, ImageAssetPreset> = {
  store_logo: {
    kind: 'store_logo',
    label: 'Logo',
    aspectRatio: 1,
    minWidth: 256,
    minHeight: 256,
    minimumCropWidth: 128,
    minimumCropHeight: 128,
    recommendedWidth: 800,
    recommendedHeight: 800,
    maxBytes: 10 * 1024 * 1024,
    maxOutputBytes: 400 * 1024,
    shape: 'circle',
  },
  store_favicon: {
    kind: 'store_favicon',
    label: 'Icono de pestaña',
    aspectRatio: 1,
    minWidth: 64,
    minHeight: 64,
    minimumCropWidth: 48,
    minimumCropHeight: 48,
    recommendedWidth: 512,
    recommendedHeight: 512,
    maxBytes: 5 * 1024 * 1024,
    maxOutputBytes: 160 * 1024,
    shape: 'rounded',
  },
  header_icon: {
    kind: 'header_icon',
    label: 'Icono de navegación',
    aspectRatio: 1,
    minWidth: 96,
    minHeight: 96,
    minimumCropWidth: 48,
    minimumCropHeight: 48,
    recommendedWidth: 128,
    recommendedHeight: 128,
    maxBytes: 5 * 1024 * 1024,
    maxOutputBytes: 160 * 1024,
    shape: 'rounded',
  },
  store_hero: {
    kind: 'store_hero',
    label: 'Imagen principal de portada',
    aspectRatio: 1,
    minWidth: 700,
    minHeight: 700,
    minimumCropWidth: 240,
    minimumCropHeight: 240,
    recommendedWidth: 1400,
    recommendedHeight: 1400,
    maxBytes: 12 * 1024 * 1024,
    maxOutputBytes: 800 * 1024,
    shape: 'circle',
  },
  store_hero_badge: {
    kind: 'store_hero_badge',
    label: 'Sello de portada',
    aspectRatio: 1,
    minWidth: 240,
    minHeight: 240,
    minimumCropWidth: 96,
    minimumCropHeight: 96,
    recommendedWidth: 800,
    recommendedHeight: 800,
    maxBytes: 8 * 1024 * 1024,
    maxOutputBytes: 350 * 1024,
    shape: 'circle',
  },
  store_hero_background: {
    kind: 'store_hero_background',
    label: 'Fondo de portada',
    aspectRatio: 16 / 9,
    minWidth: 1200,
    minHeight: 675,
    minimumCropWidth: 480,
    minimumCropHeight: 270,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    maxBytes: 15 * 1024 * 1024,
    maxOutputBytes: 1200 * 1024,
    shape: 'rounded',
  },
  carta_cover: {
    kind: 'carta_cover',
    label: 'Imagen de portada de la carta',
    aspectRatio: 16 / 9,
    minWidth: 1200,
    minHeight: 675,
    minimumCropWidth: 480,
    minimumCropHeight: 270,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    maxBytes: 15 * 1024 * 1024,
    maxOutputBytes: 1200 * 1024,
    shape: 'rounded',
  },
  product_image: {
    kind: 'product_image',
    label: 'Imagen de producto',
    aspectRatio: 1,
    minWidth: 700,
    minHeight: 700,
    minimumCropWidth: 240,
    minimumCropHeight: 240,
    recommendedWidth: 1200,
    recommendedHeight: 1200,
    maxBytes: 12 * 1024 * 1024,
    maxOutputBytes: 650 * 1024,
    shape: 'rounded',
  },
  review_image: {
    kind: 'review_image',
    label: 'Foto de reseña',
    aspectRatio: 1,
    minWidth: 640,
    minHeight: 640,
    minimumCropWidth: 160,
    minimumCropHeight: 160,
    recommendedWidth: 1600,
    recommendedHeight: 1600,
    maxBytes: 10 * 1024 * 1024,
    maxOutputBytes: 900 * 1024,
    shape: 'rounded',
  },
  catalog_taxonomy_image: {
    kind: 'catalog_taxonomy_image',
    label: 'Imagen de navegación del catálogo',
    aspectRatio: 1,
    minWidth: 500,
    minHeight: 500,
    minimumCropWidth: 180,
    minimumCropHeight: 180,
    recommendedWidth: 900,
    recommendedHeight: 900,
    maxBytes: 10 * 1024 * 1024,
    maxOutputBytes: 450 * 1024,
    shape: 'rounded',
  },
  offer_hero: {
    kind: 'offer_hero',
    label: 'Imagen de oferta',
    aspectRatio: 16 / 9,
    minWidth: 1200,
    minHeight: 675,
    minimumCropWidth: 480,
    minimumCropHeight: 270,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    maxBytes: 15 * 1024 * 1024,
    maxOutputBytes: 1200 * 1024,
    shape: 'rounded',
  },
  home_section_image: {
    kind: 'home_section_image',
    label: 'Imagen de sección de inicio',
    aspectRatio: 16 / 9,
    minWidth: 1200,
    minHeight: 675,
    minimumCropWidth: 480,
    minimumCropHeight: 270,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    maxBytes: 12 * 1024 * 1024,
    maxOutputBytes: 1000 * 1024,
    shape: 'rounded',
  },
  promo_banner_wide: {
    kind: 'promo_banner_wide',
    label: 'Banner promocional panorámico',
    aspectRatio: 3,
    minWidth: 1200,
    minHeight: 400,
    minimumCropWidth: 600,
    minimumCropHeight: 200,
    recommendedWidth: 1800,
    recommendedHeight: 600,
    maxBytes: 12 * 1024 * 1024,
    maxOutputBytes: 1000 * 1024,
    shape: 'rounded',
  },
  promo_banner_split: {
    kind: 'promo_banner_split',
    label: 'Imagen para banner con texto lateral',
    aspectRatio: 4 / 3,
    minWidth: 1000,
    minHeight: 750,
    minimumCropWidth: 400,
    minimumCropHeight: 300,
    recommendedWidth: 1600,
    recommendedHeight: 1200,
    maxBytes: 12 * 1024 * 1024,
    maxOutputBytes: 900 * 1024,
    shape: 'rounded',
  },
};

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 5 ? 0 : 1)} MB`;
}
