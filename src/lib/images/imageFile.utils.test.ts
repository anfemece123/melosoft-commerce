import { describe, expect, it } from 'vitest';
import { IMAGE_ASSET_PRESETS } from './imageAssetPresets';
import {
  assertImageReadyForUpload,
  getAdaptiveOutputSize,
  getLargestCropSize,
} from './imageFile.utils';

describe('image crop geometry', () => {
  it('accepts a portrait source and finds the largest square product crop', () => {
    expect(getLargestCropSize(900, 1600, 1)).toEqual({ width: 900, height: 900 });
  });

  it('finds a usable 16:9 crop inside a portrait cover image', () => {
    expect(getLargestCropSize(900, 1600, 16 / 9)).toEqual({
      width: 900,
      height: 506.25,
    });
  });

  it('never enlarges a smaller product image', () => {
    expect(getAdaptiveOutputSize(
      { width: 640, height: 640 },
      IMAGE_ASSET_PRESETS.product_image,
    )).toEqual({ width: 640, height: 640 });
  });

  it('caps a large crop at the preset output resolution', () => {
    expect(getAdaptiveOutputSize(
      { width: 3000, height: 3000 },
      IMAGE_ASSET_PRESETS.product_image,
    )).toEqual({ width: 1200, height: 1200 });
  });
});

describe('optimized upload guard', () => {
  it('accepts a processed product image within the storage budget', () => {
    const file = new File([new Uint8Array(200 * 1024)], 'product.webp', { type: 'image/webp' });
    expect(() => assertImageReadyForUpload(file, 'product_image')).not.toThrow();
  });

  it('rejects a file that bypasses the product storage budget', () => {
    const file = new File([new Uint8Array(700 * 1024)], 'product.webp', { type: 'image/webp' });
    expect(() => assertImageReadyForUpload(file, 'product_image')).toThrow('peso optimizado');
  });
});
