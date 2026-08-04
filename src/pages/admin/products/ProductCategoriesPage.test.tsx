import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PublicStoreCategory } from '@/types/common.types';

const { getStoreCategoriesMock } = vi.hoisted(() => ({
  getStoreCategoriesMock: vi.fn(),
}));

vi.mock('@/features/categories/categoriesService', () => ({
  categoriesService: {
    getStoreCategories: getStoreCategoriesMock,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    setCategoryImage: vi.fn(),
    clearCategoryImage: vi.fn(),
  },
}));

import { ProductCategoriesPage } from './ProductCategoriesPage';

const categories: PublicStoreCategory[] = [
  {
    id: 'root-category',
    storeId: 'store-1',
    storeSlug: 'demo',
    name: 'Comidas',
    slug: 'comidas',
    description: null,
    parentId: null,
    imageUrl: null,
    color: null,
    sortOrder: 0,
    showInMenu: true,
  },
  {
    id: 'child-category',
    storeId: 'store-1',
    storeSlug: 'demo',
    name: 'Hamburguesas',
    slug: 'hamburguesas',
    description: null,
    parentId: 'root-category',
    imageUrl: null,
    color: null,
    sortOrder: 1,
    showInMenu: true,
  },
];

describe('ProductCategoriesPage editing placement', () => {
  it('renders the editor immediately below the selected category or subcategory', async () => {
    getStoreCategoriesMock.mockResolvedValue(categories);
    render(
      <MemoryRouter initialEntries={['/admin/stores/store-1/products/categories']}>
        <Routes>
          <Route path="/admin/stores/:storeId/products/categories" element={<ProductCategoriesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const rootEditButton = await screen.findByRole('button', { name: 'Editar Comidas' });
    const rootRow = rootEditButton.parentElement;
    fireEvent.click(rootEditButton);
    const rootEditorHeading = screen.getByRole('heading', { name: 'Editando: Comidas' });

    expect(rootRow?.nextElementSibling?.contains(rootEditorHeading)).toBe(true);

    const childEditButton = screen.getByRole('button', { name: 'Editar Hamburguesas' });
    const childRow = childEditButton.parentElement;
    fireEvent.click(childEditButton);
    const childEditorHeading = screen.getByRole('heading', { name: 'Editando: Hamburguesas' });

    expect(childRow?.nextElementSibling?.contains(childEditorHeading)).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Editando: Comidas' })).toBeNull();
  });
});
