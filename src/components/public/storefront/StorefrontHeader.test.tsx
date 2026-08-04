import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StorefrontHeader } from './StorefrontHeader';
import { buildStorefrontTheme } from './storefrontTheme';
import { DEFAULT_HEADER_SETTINGS } from '@/types/common.types';
import type { CatalogMeta } from '@/types/common.types';

const catalogMeta: CatalogMeta = {
  categories: [],
  categoryTree: [],
  collections: [],
  facets: [{
    id: 'gender',
    storeId: 'store-1',
    storeSlug: 'demo',
    name: 'Género',
    slug: 'genero',
    inputType: 'single_select',
    showInCatalogFilters: true,
    showInMegaMenu: false,
    appliesToAllCategories: true,
    applicableCategories: [],
    sortOrder: 0,
    values: [{
      id: 'women',
      storeId: 'store-1',
      facetId: 'gender',
      value: 'Mujer',
      slug: 'mujer',
      sortOrder: 0,
    }],
  }],
  megaMenuFacets: [],
  products: [],
  priceRange: { min: 0, max: 0 },
};

describe('StorefrontHeader custom navigation', () => {
  it('renders a top-level attribute value as a catalog filter link', () => {
    render(
      <MemoryRouter initialEntries={['/s/demo']}>
        <StorefrontHeader
          theme={buildStorefrontTheme({})}
          storeName="Demo"
          storeSlug="demo"
          logoUrl={null}
          catalogType="physical_products"
          headerSettings={{
            ...DEFAULT_HEADER_SETTINGS,
            menuMode: 'custom',
            navigationItems: [{
              id: 'women-link',
              type: 'facet_value',
              label: 'Para mujer',
              targetId: 'women',
            }],
          }}
          categories={[]}
          catalogMeta={catalogMeta}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Para mujer' }).getAttribute('href'))
      .toBe('/s/demo/catalog?f_genero=mujer');
  });

  it('opens the complete category navigation from the main catalog link', () => {
    const categoryTree = [{
      id: 'food',
      storeId: 'store-1',
      storeSlug: 'demo',
      name: 'Comidas',
      slug: 'comidas',
      description: 'Platos principales',
      parentId: null,
      imageUrl: 'https://example.com/food.webp',
      color: null,
      sortOrder: 0,
      showInMenu: true,
      children: [{
        id: 'burgers',
        storeId: 'store-1',
        storeSlug: 'demo',
        name: 'Hamburguesas',
        slug: 'hamburguesas',
        description: null,
        parentId: 'food',
        imageUrl: 'https://example.com/burgers.webp',
        color: null,
        sortOrder: 0,
        showInMenu: true,
      }],
    }];

    render(
      <MemoryRouter initialEntries={['/s/demo']}>
        <StorefrontHeader
          theme={buildStorefrontTheme({})}
          storeName="Demo"
          storeSlug="demo"
          logoUrl={null}
          catalogType="menu"
          headerSettings={{ ...DEFAULT_HEADER_SETTINGS, showHomeLink: false }}
          categories={categoryTree}
          catalogMeta={{ ...catalogMeta, categories: categoryTree, categoryTree }}
        />
      </MemoryRouter>,
    );

    fireEvent.focus(screen.getByRole('link', { name: /menú/i }));

    const megaMenu = screen.getByRole('region', { name: 'Explorar Menú' });
    expect(megaMenu.getAttribute('data-layout')).toBe('overlay');
    expect(megaMenu.className).toContain('absolute');
    expect(megaMenu.className).toContain('top-full');
    expect(megaMenu.className).not.toContain('border-t');
    expect(megaMenu.textContent).not.toContain('Categorías de');
    expect(megaMenu.querySelector('img[src="https://example.com/food.webp"]')).not.toBeNull();
    expect(megaMenu.querySelector('img[src="https://example.com/burgers.webp"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: /comidas/i }).getAttribute('href'))
      .toBe('/s/demo/catalog?cat=comidas');
    expect(screen.getByRole('link', { name: 'Hamburguesas' }).getAttribute('href'))
      .toBe('/s/demo/catalog?cat=comidas&sub=hamburguesas');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Explorar Menú' })).toBeNull();
  });
});
