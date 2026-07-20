export type ImageAssetKind =
  | 'store_logo'
  | 'store_favicon'
  | 'store_hero'
  | 'store_hero_badge'
  | 'store_hero_background'
  | 'product_image'
  | 'offer_hero'
  | 'home_section_image'
  | 'promo_banner_wide'
  | 'promo_banner_split';

export interface ImageAssetPreset {
  kind: ImageAssetKind;
  label: string;
  aspectRatio: number;
  minWidth: number;
  minHeight: number;
  recommendedWidth: number;
  recommendedHeight: number;
  maxBytes: number;
  shape: 'circle' | 'rounded';
}

export const IMAGE_ASSET_PRESETS: Record<ImageAssetKind, ImageAssetPreset> = {
  store_logo: {
    kind: 'store_logo',
    label: 'Logo',
    aspectRatio: 1,
    minWidth: 256,
    minHeight: 256,
    recommendedWidth: 800,
    recommendedHeight: 800,
    maxBytes: 6 * 1024 * 1024,
    shape: 'circle',
  },
  store_favicon: {
    kind: 'store_favicon',
    label: 'Icono de pestaña',
    aspectRatio: 1,
    minWidth: 64,
    minHeight: 64,
    recommendedWidth: 512,
    recommendedHeight: 512,
    maxBytes: 2 * 1024 * 1024,
    shape: 'rounded',
  },
  store_hero: {
    kind: 'store_hero',
    label: 'Imagen principal de portada',
    aspectRatio: 1,
    minWidth: 700,
    minHeight: 700,
    recommendedWidth: 1400,
    recommendedHeight: 1400,
    maxBytes: 8 * 1024 * 1024,
    shape: 'circle',
  },
  store_hero_badge: {
    kind: 'store_hero_badge',
    label: 'Sello de portada',
    aspectRatio: 1,
    minWidth: 240,
    minHeight: 240,
    recommendedWidth: 800,
    recommendedHeight: 800,
    maxBytes: 6 * 1024 * 1024,
    shape: 'circle',
  },
  store_hero_background: {
    kind: 'store_hero_background',
    label: 'Fondo de portada',
    aspectRatio: 16 / 9,
    minWidth: 1200,
    minHeight: 675,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    maxBytes: 10 * 1024 * 1024,
    shape: 'rounded',
  },
  product_image: {
    kind: 'product_image',
    label: 'Imagen de producto',
    aspectRatio: 1,
    minWidth: 700,
    minHeight: 700,
    recommendedWidth: 1200,
    recommendedHeight: 1200,
    maxBytes: 8 * 1024 * 1024,
    shape: 'rounded',
  },
  offer_hero: {
    kind: 'offer_hero',
    label: 'Imagen de oferta',
    aspectRatio: 16 / 9,
    minWidth: 1200,
    minHeight: 675,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    maxBytes: 10 * 1024 * 1024,
    shape: 'rounded',
  },
  home_section_image: {
    kind: 'home_section_image',
    label: 'Imagen de sección de inicio',
    aspectRatio: 16 / 9,
    minWidth: 1200,
    minHeight: 675,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    maxBytes: 8 * 1024 * 1024,
    shape: 'rounded',
  },
  promo_banner_wide: {
    kind: 'promo_banner_wide',
    label: 'Banner promocional panorámico',
    aspectRatio: 3,
    minWidth: 1200,
    minHeight: 400,
    recommendedWidth: 1800,
    recommendedHeight: 600,
    maxBytes: 8 * 1024 * 1024,
    shape: 'rounded',
  },
  promo_banner_split: {
    kind: 'promo_banner_split',
    label: 'Imagen para banner con texto lateral',
    aspectRatio: 4 / 3,
    minWidth: 1000,
    minHeight: 750,
    recommendedWidth: 1600,
    recommendedHeight: 1200,
    maxBytes: 8 * 1024 * 1024,
    shape: 'rounded',
  },
};

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 5 ? 0 : 1)} MB`;
}
