import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeaderNavigationEditor } from './HeaderNavigationEditor';
import { DEFAULT_HEADER_SETTINGS } from '@/types/common.types';

vi.mock('@/features/categories/categoriesService', () => ({
  categoriesService: {
    getStoreCategories: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/features/collections/collectionsService', () => ({
  collectionsService: {
    getStoreCollections: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/features/facets/facetsService', () => ({
  facetsService: {
    getStoreFacets: vi.fn().mockResolvedValue([{
      id: 'gender',
      storeId: 'store-1',
      ownerId: 'owner-1',
      name: 'Género',
      slug: 'genero',
      inputType: 'single_select',
      showInProductForm: true,
      showInCatalogFilters: true,
      showInMegaMenu: false,
      appliesToAllCategories: true,
      applicableCategories: [],
      sortOrder: 0,
      isActive: true,
      values: [{
        id: 'women',
        storeId: 'store-1',
        facetId: 'gender',
        value: 'Mujer',
        slug: 'mujer',
        sortOrder: 0,
        isActive: true,
        createdAt: '2026-01-01',
      }],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }]),
  },
}));

describe('HeaderNavigationEditor', () => {
  it('offers attribute values as navigation targets', async () => {
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <HeaderNavigationEditor
          storeId="store-1"
          settings={{
            ...DEFAULT_HEADER_SETTINGS,
            menuMode: 'custom',
          }}
          onChange={onChange}
        />
      </MemoryRouter>
    );

    const targetSelect = await screen.findByLabelText('Destino del enlace');
    fireEvent.change(targetSelect, { target: { value: 'facet_value:women' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        navigationItems: [
          expect.objectContaining({
            type: 'facet_value',
            label: 'Mujer',
            targetId: 'women',
          }),
        ],
      }));
    });
  });
});
