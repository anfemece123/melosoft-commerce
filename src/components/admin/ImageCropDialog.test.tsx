import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageCropDialog } from './ImageCropDialog';
import { IMAGE_ASSET_PRESETS } from '@/lib/images/imageAssetPresets';
import type { LoadedImageFile } from '@/lib/images/imageFile.utils';

const file: LoadedImageFile = {
  id: 'image-1',
  file: new File(['image'], 'logo.png', { type: 'image/png' }),
  previewUrl: 'data:image/png;base64,AA==',
  width: 800,
  height: 800,
  qualityWarning: null,
};

describe('ImageCropDialog', () => {
  it('renders above a parent modal and owns Escape', () => {
    const onCancel = vi.fn();

    render(
      <ImageCropDialog
        open
        file={file}
        preset={IMAGE_ASSET_PRESETS.store_logo}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    const layer = screen.getByRole('dialog').closest('[data-dialog-layer="nested"]');
    expect(layer?.className).toContain('z-[200]');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
