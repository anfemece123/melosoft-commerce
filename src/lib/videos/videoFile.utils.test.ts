import { describe, expect, it } from 'vitest';
import {
  formatVideoBytes,
  formatVideoDuration,
  getVideoCropRect,
  getVideoOutputSize,
  isProductVideoMimeType,
  PRODUCT_VIDEO_MAX_BYTES,
  validateProductVideoFile,
} from './videoFile.utils';

describe('product video constraints', () => {
  it('only accepts browser-friendly video formats', () => {
    expect(isProductVideoMimeType('video/mp4')).toBe(true);
    expect(isProductVideoMimeType('video/webm')).toBe(true);
    expect(isProductVideoMimeType('video/webm;codecs=vp9,opus')).toBe(true);
    expect(isProductVideoMimeType('video/quicktime')).toBe(false);
  });

  it('formats duration and file size for the admin UI', () => {
    expect(formatVideoDuration(12.4)).toBe('0:12');
    expect(formatVideoBytes(PRODUCT_VIDEO_MAX_BYTES)).toBe('20.0 MB');
  });

  it('rejects unsupported containers before attempting metadata inspection', async () => {
    const file = new File(['video'], 'clip.mov', { type: 'video/quicktime' });
    await expect(validateProductVideoFile(file)).rejects.toThrow(/MP4 o WebM/);
  });

  it('rejects oversized files before creating a browser preview', async () => {
    const file = new File([new Uint8Array(PRODUCT_VIDEO_MAX_BYTES + 1)], 'clip.mp4', { type: 'video/mp4' });
    await expect(validateProductVideoFile(file)).rejects.toThrow(/20\.0 MB/);
  });

  it('builds a movable 16:9 crop for portrait and landscape sources', () => {
    const portrait = getVideoCropRect(1080, 1920, 0.5, 0.8);
    expect(portrait.x).toBe(0);
    expect(portrait.y).toBeGreaterThan(0);
    expect(portrait.width / portrait.height).toBeCloseTo(1, 5);

    const landscape = getVideoCropRect(2560, 1080, 0.25, 0.5);
    expect(landscape.x).toBeGreaterThan(0);
    expect(landscape.width / landscape.height).toBeCloseTo(1, 5);
  });

  it('caps the processed video output without upscaling small sources', () => {
    expect(getVideoOutputSize({ width: 2000, height: 2000 })).toEqual({ width: 1200, height: 1200 });
    expect(getVideoOutputSize({ width: 900, height: 900 })).toEqual({ width: 900, height: 900 });
  });
});
