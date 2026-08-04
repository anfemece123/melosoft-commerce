import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { getCategoryImageCandidatesMock, validateImageFileMock } = vi.hoisted(() => ({
  getCategoryImageCandidatesMock: vi.fn(),
  validateImageFileMock: vi.fn(),
}));

vi.mock('@/features/products/productsService', () => ({
  productsService: {
    getCategoryImageCandidates: getCategoryImageCandidatesMock,
  },
}));

vi.mock('@/lib/images/imageFile.utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/images/imageFile.utils')>();
  return {
    ...original,
    validateImageFile: validateImageFileMock,
  };
});

vi.mock('./ImageCropDialog', () => ({
  ImageCropDialog: ({ onConfirm }: { onConfirm: (file: File) => void }) => (
    <button type="button" onClick={() => onConfirm(new File(['optimized'], 'category.webp', { type: 'image/webp' }))}>
      Confirmar recorte
    </button>
  ),
}));

import { ProductImagePickerDialog } from './ProductImagePickerDialog';

describe('ProductImagePickerDialog', () => {
  beforeEach(() => {
    getCategoryImageCandidatesMock.mockReset();
    validateImageFileMock.mockReset();
  });

  it('loads a compact paginated category image list and supports searching', async () => {
    getCategoryImageCandidatesMock.mockResolvedValue({
      items: [
        {
          productId: 'product-1',
          name: 'Hamburguesa clásica',
          imageUrl: 'https://example.com/burger.webp',
          categoryId: 'child-category',
          status: 'active',
        },
        {
          productId: 'product-2',
          name: 'Hamburguesa especial',
          imageUrl: 'https://example.com/special.webp',
          categoryId: 'root-category',
          status: 'draft',
        },
      ],
      total: 2,
    });
    const onClose = vi.fn();

    render(
      <ProductImagePickerDialog
        storeId="store-1"
        categoryIds={['root-category', 'child-category']}
        categoryNameById={{
          'root-category': 'Comidas',
          'child-category': 'Hamburguesas',
        }}
        categoryName="Comidas"
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Usar imagen de Hamburguesa clásica' })).toBeTruthy();
    expect(screen.getByText('1–2 de 2')).toBeTruthy();
    expect(getCategoryImageCandidatesMock).toHaveBeenCalledWith(
      'store-1',
      ['child-category', 'root-category'],
      { page: 0, pageSize: 16, search: '' },
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar producto' }), {
      target: { value: 'especial' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(getCategoryImageCandidatesMock).toHaveBeenLastCalledWith(
        'store-1',
        ['child-category', 'root-category'],
        { page: 0, pageSize: 16, search: 'especial' },
      );
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('downloads only the selected source and sends it through the crop flow', async () => {
    getCategoryImageCandidatesMock.mockResolvedValue({
      items: [{
        productId: 'product-1',
        name: 'Hamburguesa clásica',
        imageUrl: 'https://example.com/burger.webp',
        categoryId: 'category-1',
        status: 'active',
      }],
      total: 1,
    });
    const sourceFile = new File(['source'], 'burger.webp', { type: 'image/webp' });
    validateImageFileMock.mockResolvedValue({
      id: 'loaded-1',
      file: sourceFile,
      previewUrl: 'blob:source',
      width: 900,
      height: 900,
      qualityWarning: null,
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['source'], { type: 'image/webp' }),
      headers: new Headers({ 'content-type': 'image/webp' }),
    } as Response);
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <ProductImagePickerDialog
        storeId="store-1"
        categoryIds={['category-1']}
        categoryNameById={{ 'category-1': 'Comidas' }}
        categoryName="Comidas"
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Usar imagen de Hamburguesa clásica' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar recorte' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/burger.webp', { credentials: 'omit' });
    expect(validateImageFileMock).toHaveBeenCalledWith(expect.any(File), 'catalog_taxonomy_image');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'category.webp' }));
    expect(onClose).toHaveBeenCalledOnce();

    fetchMock.mockRestore();
  });
});
