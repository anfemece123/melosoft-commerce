import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
