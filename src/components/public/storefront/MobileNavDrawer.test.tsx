import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileNavDrawer } from './MobileNavDrawer';
import { buildStorefrontTheme } from './storefrontTheme';
import { DEFAULT_HEADER_SETTINGS } from '@/types/common.types';
import type { PublicStoreCategory, PublicStoreCollection } from '@/types/common.types';
import type { ResolvedHeaderNavigationItem } from '@/lib/storefront/headerNavigation';

const categoryTree: PublicStoreCategory[] = [{
  id: 'shoes',
  storeId: 'store-1',
  storeSlug: 'demo',
  name: 'Zapatos',
  slug: 'zapatos',
  description: null,
  parentId: null,
  imageUrl: null,
  color: null,
  sortOrder: 0,
  showInMenu: true,
  children: [{
    id: 'running',
    storeId: 'store-1',
    storeSlug: 'demo',
    name: 'Running',
    slug: 'running',
    description: null,
    parentId: 'shoes',
    imageUrl: null,
    color: null,
    sortOrder: 0,
    showInMenu: true,
  }],
}];

const navigationItems: ResolvedHeaderNavigationItem[] = [
  {
    id: 'women',
    type: 'facet_value',
    label: 'Mujer',
    href: '/s/demo/catalog?f_genero=mujer',
    targetId: 'women-value',
    rootCategorySlug: null,
  },
  {
    id: 'shoes',
    type: 'category',
    label: 'Calzado',
    href: '/s/demo/catalog?cat=zapatos',
    targetId: 'shoes',
    rootCategorySlug: 'zapatos',
  },
];

const collection: PublicStoreCollection = {
  id: 'season',
  storeId: 'store-1',
  storeSlug: 'demo',
  name: 'Temporada',
  slug: 'temporada',
  description: null,
  imageUrl: null,
  color: null,
  sortOrder: 0,
  showOnHome: false,
  showInMenu: true,
};

describe('MobileNavDrawer custom navigation', () => {
  it('renders attribute links and category descendants using catalog filter URLs', () => {
    render(
      <MemoryRouter>
        <MobileNavDrawer
          open
          onClose={vi.fn()}
          theme={buildStorefrontTheme({})}
          storeSlug="demo"
          storeName="Demo"
          logoUrl={null}
          settings={{
            ...DEFAULT_HEADER_SETTINGS,
            menuMode: 'custom',
            menuTextSize: 'lg',
          }}
          categoryTree={categoryTree}
          collections={[collection]}
          navigationItems={navigationItems}
          showAutomaticCollections={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /mujer/i }).getAttribute('href'))
      .toBe('/s/demo/catalog?f_genero=mujer');
    expect(screen.getByRole('link', { name: /calzado/i }).getAttribute('href'))
      .toBe('/s/demo/catalog?cat=zapatos');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar opciones de Calzado' }));
    expect(screen.getByRole('link', { name: 'Running' }).getAttribute('href'))
      .toBe('/s/demo/catalog?cat=zapatos&sub=running');
    expect(screen.queryByRole('link', { name: 'Temporada' })).toBeNull();
    expect(screen.getByRole('link', { name: /mujer/i }).className).toContain('text-[19px]');
    expect(screen.getByRole('link', { name: 'Running' }).className).toContain('text-[16px]');
  });

  it('shows catalog categories as an accessible mobile section', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <MobileNavDrawer
          open
          onClose={onClose}
          theme={buildStorefrontTheme({})}
          storeSlug="demo"
          storeName="Demo"
          logoUrl={null}
          settings={DEFAULT_HEADER_SETTINGS}
          categoryTree={categoryTree}
          collections={[]}
          navigationItems={[{
            id: 'catalog',
            type: 'catalog',
            label: 'Productos',
            href: '/s/demo/catalog',
            targetId: null,
            rootCategorySlug: null,
          }]}
          showAutomaticCollections
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Ocultar opciones de Productos' }).getAttribute('aria-expanded'))
      .toBe('true');
    expect(screen.getByRole('link', { name: 'Zapatos' }).getAttribute('href'))
      .toBe('/s/demo/catalog?cat=zapatos');
    expect(screen.getByRole('link', { name: 'Running' }).getAttribute('href'))
      .toBe('/s/demo/catalog?cat=zapatos&sub=running');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
