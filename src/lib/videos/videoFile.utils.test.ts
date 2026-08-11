import { describe, expect, it } from 'vitest';
import {
  formatVideoBytes,
  formatVideoDuration,
  isProductVideoMimeType,
  PRODUCT_VIDEO_MAX_BYTES,
  validateProductVideoFile,
} from './videoFile.utils';

describe('product video constraints', () => {
  it('only accepts browser-friendly video formats', () => {
    expect(isProductVideoMimeType('video/mp4')).toBe(true);
    expect(isProductVideoMimeType('video/webm')).toBe(true);
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
});
