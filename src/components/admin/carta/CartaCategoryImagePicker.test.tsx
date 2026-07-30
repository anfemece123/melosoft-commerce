import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicStoreCategory } from '@/types/common.types';
import { CartaCategoryImagePicker } from './CartaCategoryImagePicker';

const beverages: PublicStoreCategory = {
  id: 'beverages',
  storeId: 'store',
  storeSlug: 'demo',
  name: 'Bebidas',
  slug: 'bebidas',
  description: null,
  parentId: null,
  imageUrl: null,
  color: null,
  sortOrder: 0,
  showInMenu: true,
};

const baseProps = {
  categories: [beverages],
  products: [],
  defaultMode: 'all' as const,
  selections: {},
  positions: {},
  sizes: {},
  onChange: () => undefined,
  onPositionsChange: () => undefined,
  onSizesChange: () => undefined,
};

describe('CartaCategoryImagePicker', () => {
  it('lets a category replace the general image mode', () => {
    const onModesChange = vi.fn();
    render(
      <CartaCategoryImagePicker
        {...baseProps}
        modes={{}}
        onModesChange={onModesChange}
      />
    );

    expect(screen.getByText('Hereda: Imagen por producto')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sin imágenes en Bebidas' }));

    expect(onModesChange).toHaveBeenCalledWith({ beverages: 'none' });
  });

  it('can return a category to the general configuration', () => {
    const onModesChange = vi.fn();
    render(
      <CartaCategoryImagePicker
        {...baseProps}
        modes={{ beverages: 'none' }}
        onModesChange={onModesChange}
      />
    );

    expect(screen.getByText('Configuración propia de esta categoría')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Usar general en Bebidas' }));

    expect(onModesChange).toHaveBeenCalledWith({});
  });

  it('lets the category image be positioned independently on the left or right', () => {
    const onPositionsChange = vi.fn();
    render(
      <CartaCategoryImagePicker
        {...baseProps}
        categories={[{ ...beverages, imageUrl: 'https://example.com/beverages.png' }]}
        defaultMode="first_per_category"
        modes={{}}
        onModesChange={() => undefined}
        onPositionsChange={onPositionsChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lateral izquierda' }));
    expect(onPositionsChange).toHaveBeenCalledWith({ beverages: 'beside_left' });

    fireEvent.click(screen.getByRole('button', { name: 'Lateral derecha' }));
    expect(onPositionsChange).toHaveBeenCalledWith({ beverages: 'beside_right' });
  });
});
