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
  it('marks the transparent hero header so the mobile overlay can remain readable', () => {
    render(
      <MemoryRouter initialEntries={['/s/demo']}>
        <StorefrontHeader
          theme={buildStorefrontTheme({})}
          storeName="Demo"
          storeSlug="demo"
          logoUrl={null}
          catalogType="physical_products"
          hasHero
          headerSettings={{ ...DEFAULT_HEADER_SETTINGS, transparentOnHero: true }}
        />
      </MemoryRouter>,
    );

    const header = document.querySelector('[data-storefront-header="true"]');
    expect(header?.getAttribute('data-transparent')).toBe('true');
  });

  it('allows a long store name to wrap on mobile without displacing the closed status', () => {
    const longStoreName = 'Restaurante Tradición y Sabores de Nuestra Tierra';

    render(
      <MemoryRouter initialEntries={['/s/restaurante-demo']}>
        <StorefrontHeader
          theme={buildStorefrontTheme({})}
          storeName={longStoreName}
          storeSlug="restaurante-demo"
          logoUrl={null}
          catalogType="menu"
          showCart
          orderStatus={{
            isAcceptingOrders: false,
            statusCode: 'closed',
            timezone: 'America/Bogota',
            localDate: '2026-08-04',
            localTime: '22:00:00',
            pausedUntil: null,
            pauseReason: null,
          }}
          scheduleLoading={false}
          headerSettings={DEFAULT_HEADER_SETTINGS}
        />
      </MemoryRouter>,
    );

    const brandName = screen.getByText(longStoreName);
    expect(brandName.hasAttribute('data-storefront-brand-name')).toBe(true);
    expect(brandName.classList).toContain('line-clamp-2');
    expect(brandName.classList).toContain('break-words');
    expect(brandName.classList).not.toContain('truncate');
    expect(screen.getByText('Cerrado ahora')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Carrito de compras' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir menú de navegación' })).not.toBeNull();
  });

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

  it('marks the active category experience instead of keeping Inicio highlighted', () => {
    const padelCategory = {
      id: 'padel',
      storeId: 'store-1',
      storeSlug: 'demo',
      name: 'Pádel',
      slug: 'padel',
      description: null,
      parentId: null,
      imageUrl: null,
      color: null,
      sortOrder: 0,
      showInMenu: true,
      children: [],
    };

    render(
      <MemoryRouter initialEntries={['/s/demo/catalog?cat=padel']}>
        <StorefrontHeader
          theme={buildStorefrontTheme({})}
          storeName="Modo"
          storeSlug="demo"
          logoUrl={null}
          catalogType="physical_products"
          headerSettings={{
            ...DEFAULT_HEADER_SETTINGS,
            menuMode: 'custom',
            navigationItems: [{
              id: 'padel-mode',
              type: 'category',
              label: 'Modo Pádel',
              targetId: 'padel',
            }],
          }}
          categories={[padelCategory]}
          catalogMeta={{ ...catalogMeta, categories: [padelCategory], categoryTree: [padelCategory] }}
        />
      </MemoryRouter>,
    );

    const modeLink = screen.getByRole('link', { name: 'Modo Pádel' });
    expect(modeLink.getAttribute('aria-current')).toBe('page');
    expect(modeLink.className).toContain('font-semibold');
    expect(screen.getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBeNull();
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
