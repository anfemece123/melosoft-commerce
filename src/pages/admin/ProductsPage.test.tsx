import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Product } from '@/features/products/products.types';

function makeProduct(index: number, overrides: Partial<Product> = {}): Product {
  return {
    id: `p${index}`,
    storeId: 'store-1',
    ownerId: 'o',
    name: `Perfume ${String(index).padStart(2, '0')}`,
    slug: `perfume-${index}`,
    description: 'Una fragancia de prueba con descripción suficiente.',
    shortDescription: 'Corta',
    descriptionSections: [],
    productType: 'physical_product',
    regularPrice: 1000 * index,
    compareAtPrice: null,
    salePrice: null,
    costPrice: null,
    cartaPrice: null,
    showInCarta: false,
    showInEcommerce: true,
    stock: index,
    sku: `SKU-${index}`,
    trackInventory: true,
    isFeatured: false,
    isAvailable: true,
    preparationTimeMinutes: null,
    allowsSpecialInstructions: false,
    specialInstructionsLabel: null,
    specialInstructionsPlaceholder: null,
    specialInstructionsMaxLength: 180,
    sortOrder: index,
    status: 'active',
    mainImageUrl: `https://img/${index}.webp`,
    category: null,
    categoryId: 'cat-1',
    hasVariants: false,
    showVariantsAsCards: false,
    sizeChartId: null,
    collections: [],
    facetValues: [],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

const lattafa = { facetId: 'marca', facetName: 'Marca', facetSlug: 'marca', inputType: 'single_select' as const, valueId: 'v-lattafa', value: 'Lattafa', valueSlug: 'lattafa' };

const catalog: Product[] = [
  makeProduct(1, { name: 'Lattafa Asad', facetValues: [lattafa], status: 'draft' }),
  makeProduct(2, { name: 'Lattafa Yara', facetValues: [lattafa], mainImageUrl: null }),
  ...Array.from({ length: 58 }, (_, i) => makeProduct(i + 3)),
];

const updateProductsBulk = vi.fn(async (ids: string[], payload: Partial<Product>) =>
  catalog.filter((product) => ids.includes(product.id)).map((product) => ({ ...product, ...payload, facetValues: [] })));

vi.mock('@/app/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({
    stores: {
      current: { id: 'store-1', slug: 'velaire', currency: 'COP', businessSubcategory: 'lociones_perfumes' },
      currentCommerceSettings: { catalogType: 'physical_products' },
      currentLimits: { maxProducts: 350, planKey: 'pro', whatsappInquiryMode: false },
    },
  }),
}));

vi.mock('@/features/products/productsService', () => ({
  productsService: {
    getProductsByStore: vi.fn(async () => catalog),
    getProductImages: vi.fn(async () => []),
    updateProductsBulk: (ids: string[], payload: Partial<Product>) => updateProductsBulk(ids, payload),
    publishProducts: vi.fn(async () => []),
  },
}));
vi.mock('@/features/products/productVariantsService', () => ({ productVariantsService: { getProductVariants: vi.fn(async () => []) } }));
vi.mock('@/features/categories/categoriesService', () => ({
  categoriesService: { getStoreCategories: vi.fn(async () => [{ id: 'cat-1', name: 'Perfumería', slug: 'perfumeria', parentId: null }]) },
}));
vi.mock('@/features/collections/collectionsService', () => ({ collectionsService: { getStoreCollections: vi.fn(async () => []) } }));
vi.mock('@/features/facets/facetsService', () => ({
  facetsService: {
    getStoreFacets: vi.fn(async () => [{
      id: 'marca', name: 'Marca', slug: 'marca', isActive: true,
      values: [{ id: 'v-lattafa', value: 'Lattafa', slug: 'lattafa', isActive: true }],
    }]),
  },
}));
vi.mock('@/features/domains/domainsService', () => ({ domainsService: { getStorePublicUrl: (slug: string) => `https://${slug}.test` } }));
vi.mock('@/lib/notifications', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), fromError: vi.fn() } }));

function CurrentSearch() {
  return <p data-testid="search">{useLocation().search}</p>;
}

async function renderPage(url = '/admin/stores/store-1/products') {
  const { ProductsPage } = await import('./ProductsPage');
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/stores/:storeId/products" element={<><ProductsPage /><CurrentSearch /></>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText(/Mostrando/);
}

afterEach(() => {
  vi.useRealTimers();
  updateProductsBulk.mockClear();
});

describe('ProductsPage', () => {
  it('paginates, searches by brand and keeps the search in the URL', async () => {
    await renderPage();
    expect(screen.getByText(/Mostrando/).textContent).toContain('1–50 de 60');

    fireEvent.change(screen.getByLabelText('Buscar productos'), { target: { value: 'lattafa' } });
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?q=lattafa'));
    expect(screen.getByText(/Mostrando/).textContent).toContain('1–2 de 2');
  });

  it('reads filters from the URL (e.g. coming back from the edit page)', async () => {
    await renderPage('/admin/stores/store-1/products?img=without');
    expect(screen.getByText(/Mostrando/).textContent).toContain('de 1');
    expect(screen.getByRole('button', { name: /Quitar Sin imagen/ })).toBeTruthy();
  });

  it('opens the detail sheet and moves to the next product with the arrow key', async () => {
    await renderPage('/admin/stores/store-1/products?q=lattafa');
    fireEvent.click(screen.getByRole('row', { name: 'Ver detalle de Lattafa Asad' }));
    const dialog = await screen.findByRole('dialog', { name: 'Detalle de Lattafa Asad' });
    expect(within(dialog).getByText(/Producto 1 de 2/)).toBeTruthy();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(await screen.findByRole('dialog', { name: 'Detalle de Lattafa Yara' })).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText('Sin imagen', { selector: 'li' })).toBeTruthy();
  });

  it('applies a bulk action to the selection and keeps each product attributes', async () => {
    await renderPage('/admin/stores/store-1/products?q=lattafa');
    fireEvent.click(screen.getByLabelText('Seleccionar los productos de esta página'));
    expect(screen.getByText('2 seleccionados')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Destacar' }));
    });
    expect(updateProductsBulk).toHaveBeenCalledWith(['p1', 'p2'], { isFeatured: true });
    // Bulk update rows come back without attributes; the brand must survive.
    await waitFor(() => expect(screen.queryByText('2 seleccionados')).toBeNull());
    expect(screen.getByText(/Mostrando/).textContent).toContain('de 2');
  });
});
