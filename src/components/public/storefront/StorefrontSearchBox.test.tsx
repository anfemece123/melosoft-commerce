import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StorefrontSearchBox } from './StorefrontSearchBox';
import { buildStorefrontTheme } from './storefrontTheme';
import { productSearchService } from '@/features/productSearch/productSearchService';
import type { ProductSearchSuggestions } from '@/features/productSearch/productSearch.types';

const suggestions: ProductSearchSuggestions = {
  total: 46,
  terms: [{
    kind: 'facet',
    groupLabel: 'Marca',
    label: 'Lattafa',
    facetSlug: 'marca',
    valueSlug: 'lattafa',
    categorySlug: null,
    parentCategorySlug: null,
    productCount: 46,
  }],
  products: [{
    productId: 'p1',
    productSlug: 'lattafa-asad',
    productName: 'Lattafa Asad',
    mainImageUrl: 'https://cdn.test/asad.webp',
    categoryName: 'Perfumeria',
    brand: 'Lattafa',
    regularPrice: 180000,
    salePrice: null,
    minPrice: 180000,
    maxPrice: 180000,
    hasVariants: false,
    isAvailable: true,
    stock: 3,
    trackInventory: true,
  }],
};

function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderSearchBox() {
  return render(
    <MemoryRouter initialEntries={['/s/velaire']}>
      <StorefrontSearchBox
        theme={buildStorefrontTheme({})}
        storeSlug="velaire"
        placeholder="Buscar productos"
        inputClassName=""
        inputStyle={{}}
      />
      <Routes>
        <Route path="*" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function typeAndWait(input: HTMLElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('StorefrontSearchBox', () => {
  it('shows live suggestions with image, brand shortcut and total', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(productSearchService, 'getSuggestions').mockResolvedValue(suggestions);
    renderSearchBox();

    await typeAndWait(screen.getByRole('combobox'), 'Lattafa');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toBe('lattafa');
    const options = screen.getAllByRole('option').map((option) => ({ text: option.textContent, img: option.querySelector('img')?.getAttribute('src') ?? null }));
    expect(options).toEqual([
      { text: 'MarcaLattafa46 productos', img: null },
      { text: expect.stringMatching(/^Lattafa AsadLattafa · Perfumeria\$\s180\.000$/), img: 'https://cdn.test/asad.webp' },
      { text: 'Ver los 46 resultados', img: null },
    ]);
  });

  it('debounces typing into a single request', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(productSearchService, 'getSuggestions').mockResolvedValue(suggestions);
    renderSearchBox();
    const input = screen.getByRole('combobox');

    fireEvent.focus(input);
    for (const partial of ['la', 'lat', 'latt', 'latta']) {
      fireEvent.change(input, { target: { value: partial } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toBe('latta');
  });

  it('navigates with the keyboard to the highlighted option', async () => {
    vi.useFakeTimers();
    vi.spyOn(productSearchService, 'getSuggestions').mockResolvedValue(suggestions);
    renderSearchBox();
    const input = screen.getByRole('combobox');

    await typeAndWait(input, 'asad lattafa');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(screen.getByTestId('location').textContent).toBe('/s/velaire/p/lattafa-asad');
  });
});
