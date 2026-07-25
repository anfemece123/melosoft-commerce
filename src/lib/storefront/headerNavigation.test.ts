import { describe, expect, it } from 'vitest';
import type {
  PublicHeaderSettings,
  PublicStoreCategory,
  PublicStoreCollection,
  PublicStoreFacet,
} from '@/types/common.types';
import { DEFAULT_HEADER_SETTINGS } from '@/types/common.types';
import { buildHeaderNavigationItems } from './headerNavigation';
import { resolveHeaderSettings } from './headerSettings';

const rootCategory: PublicStoreCategory = {
  id: 'category-shoes',
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
    id: 'category-running',
    storeId: 'store-1',
    storeSlug: 'demo',
    name: 'Running',
    slug: 'running',
    description: null,
    parentId: 'category-shoes',
    imageUrl: null,
    color: null,
    sortOrder: 0,
    showInMenu: true,
  }],
};

const collection: PublicStoreCollection = {
  id: 'collection-new',
  storeId: 'store-1',
  storeSlug: 'demo',
  name: 'Nueva temporada',
  slug: 'nueva-temporada',
  description: null,
  imageUrl: null,
  color: null,
  sortOrder: 0,
  showOnHome: true,
  showInMenu: true,
};

const genderFacet: PublicStoreFacet = {
  id: 'facet-gender',
  storeId: 'store-1',
  storeSlug: 'demo',
  name: 'Género',
  slug: 'genero',
  inputType: 'single_select',
  showInCatalogFilters: true,
  showInMegaMenu: true,
  appliesToAllCategories: true,
  applicableCategories: [],
  sortOrder: 0,
  values: [{
    id: 'value-women',
    storeId: 'store-1',
    facetId: 'facet-gender',
    value: 'Mujer',
    slug: 'mujer',
    sortOrder: 0,
  }],
};

function build(settings: PublicHeaderSettings) {
  return buildHeaderNavigationItems({
    settings,
    storeSlug: 'demo',
    catalogLabel: 'Productos',
    viewAllLabel: 'Todos los productos',
    categoryTree: [rootCategory],
    collections: [collection],
    facets: [genderFacet],
  });
}

describe('header navigation settings', () => {
  it('keeps legacy header settings backwards compatible', () => {
    expect(resolveHeaderSettings({ menuMode: 'categories' })).toMatchObject({
      menuMode: 'categories',
      navigationItems: [],
    });
  });

  it('sanitizes custom items and rejects targets without an id', () => {
    const settings = resolveHeaderSettings({
      menuMode: 'custom',
      navigationItems: [
        { id: 'women', type: 'facet_value', label: '  Mujer  ', targetId: 'value-women' },
        { id: 'broken', type: 'category', label: 'Sin destino', targetId: null },
      ],
    });

    expect(settings.navigationItems).toEqual([
      { id: 'women', type: 'facet_value', label: 'Mujer', targetId: 'value-women' },
    ]);
  });

  it('resolves categories, subcategories, collections and attributes by stable id', () => {
    const settings: PublicHeaderSettings = {
      ...DEFAULT_HEADER_SETTINGS,
      menuMode: 'custom',
      navigationItems: [
        { id: 'shoes', type: 'category', label: 'Calzado', targetId: 'category-shoes' },
        { id: 'running', type: 'category', label: 'Running', targetId: 'category-running' },
        { id: 'new', type: 'collection', label: 'Novedades', targetId: 'collection-new' },
        { id: 'women', type: 'facet_value', label: 'Mujer', targetId: 'value-women' },
        { id: 'sale', type: 'sale', label: 'Ofertas', targetId: null },
      ],
    };

    expect(build(settings).map(({ label, href, rootCategorySlug }) => ({
      label,
      href,
      rootCategorySlug,
    }))).toEqual([
      { label: 'Calzado', href: '/s/demo/catalog?cat=zapatos', rootCategorySlug: 'zapatos' },
      { label: 'Running', href: '/s/demo/catalog?cat=zapatos&sub=running', rootCategorySlug: null },
      { label: 'Novedades', href: '/s/demo/catalog?collection=nueva-temporada', rootCategorySlug: null },
      { label: 'Mujer', href: '/s/demo/catalog?f_genero=mujer', rootCategorySlug: null },
      { label: 'Ofertas', href: '/s/demo/catalog?sale=1', rootCategorySlug: null },
    ]);
  });

  it('falls back to the catalog when every saved target was deleted', () => {
    const settings: PublicHeaderSettings = {
      ...DEFAULT_HEADER_SETTINGS,
      menuMode: 'custom',
      navigationItems: [
        { id: 'deleted', type: 'facet_value', label: 'Eliminado', targetId: 'missing' },
      ],
    };

    expect(build(settings)).toEqual([
      expect.objectContaining({ label: 'Productos', href: '/s/demo/catalog' }),
    ]);
  });
});
