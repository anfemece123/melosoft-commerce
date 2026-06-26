export type ImageAssetKind =
  | 'store_logo'
  | 'store_hero'
  | 'store_hero_badge'
  | 'store_hero_background'
  | 'product_image'
  | 'offer_hero';

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
};

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 5 ? 0 : 1)} MB`;
}
