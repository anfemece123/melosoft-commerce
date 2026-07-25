import type {
  HeaderNavigationItemType,
  PublicHeaderSettings,
  PublicStoreCategory,
  PublicStoreCollection,
  PublicStoreFacet,
} from '@/types/common.types';
import { buildStorefrontPath } from './storefrontPaths';

export interface ResolvedHeaderNavigationItem {
  id: string;
  type: HeaderNavigationItemType;
  label: string;
  href: string;
  targetId: string | null;
  rootCategorySlug: string | null;
}

interface BuildHeaderNavigationItemsInput {
  settings: PublicHeaderSettings;
  storeSlug: string;
  catalogLabel: string;
  viewAllLabel: string;
  categoryTree: PublicStoreCategory[];
  collections: PublicStoreCollection[];
  facets: PublicStoreFacet[];
}

function catalogItem(
  storeSlug: string,
  label: string,
  id = 'catalog',
): ResolvedHeaderNavigationItem {
  return {
    id,
    type: 'catalog',
    label,
    href: buildStorefrontPath(storeSlug, '/catalog'),
    targetId: null,
    rootCategorySlug: null,
  };
}

function findCategory(
  categoryTree: PublicStoreCategory[],
  targetId: string,
): { category: PublicStoreCategory; parent: PublicStoreCategory | null } | null {
  for (const root of categoryTree) {
    if (root.id === targetId) return { category: root, parent: null };
    const child = (root.children ?? []).find((candidate) => candidate.id === targetId);
    if (child) return { category: child, parent: root };
  }
  return null;
}

export function buildHeaderNavigationItems({
  settings,
  storeSlug,
  catalogLabel,
  viewAllLabel,
  categoryTree,
  collections,
  facets,
}: BuildHeaderNavigationItemsInput): ResolvedHeaderNavigationItem[] {
  if (settings.menuMode === 'catalog_link') {
    return [catalogItem(storeSlug, catalogLabel)];
  }

  if (settings.menuMode === 'categories') {
    return [
      ...categoryTree.map((category) => ({
        id: `category-${category.id}`,
        type: 'category' as const,
        label: category.name,
        href: buildStorefrontPath(
          storeSlug,
          `/catalog?cat=${encodeURIComponent(category.slug)}`,
        ),
        targetId: category.id,
        rootCategorySlug: category.slug,
      })),
      catalogItem(storeSlug, viewAllLabel, 'catalog-all'),
    ];
  }

  const resolved = settings.navigationItems.flatMap<ResolvedHeaderNavigationItem>((item) => {
    if (item.type === 'catalog') {
      return [catalogItem(storeSlug, item.label, item.id)];
    }

    if (item.type === 'featured' || item.type === 'sale') {
      const parameter = item.type === 'featured' ? 'featured=1' : 'sale=1';
      return [{
        id: item.id,
        type: item.type,
        label: item.label,
        href: buildStorefrontPath(storeSlug, `/catalog?${parameter}`),
        targetId: null,
        rootCategorySlug: null,
      }];
    }

    if (!item.targetId) return [];

    if (item.type === 'category') {
      const match = findCategory(categoryTree, item.targetId);
      if (!match) return [];
      const query = match.parent
        ? `cat=${encodeURIComponent(match.parent.slug)}&sub=${encodeURIComponent(match.category.slug)}`
        : `cat=${encodeURIComponent(match.category.slug)}`;
      return [{
        id: item.id,
        type: item.type,
        label: item.label,
        href: buildStorefrontPath(storeSlug, `/catalog?${query}`),
        targetId: item.targetId,
        rootCategorySlug: match.parent ? null : match.category.slug,
      }];
    }

    if (item.type === 'collection') {
      const collection = collections.find((candidate) => candidate.id === item.targetId);
      if (!collection) return [];
      return [{
        id: item.id,
        type: item.type,
        label: item.label,
        href: buildStorefrontPath(
          storeSlug,
          `/catalog?collection=${encodeURIComponent(collection.slug)}`,
        ),
        targetId: item.targetId,
        rootCategorySlug: null,
      }];
    }

    const facet = facets.find((candidate) =>
      candidate.values.some((value) => value.id === item.targetId)
    );
    const value = facet?.values.find((candidate) => candidate.id === item.targetId);
    if (!facet || !value) return [];
    return [{
      id: item.id,
      type: item.type,
      label: item.label,
      href: buildStorefrontPath(
        storeSlug,
        `/catalog?f_${encodeURIComponent(facet.slug)}=${encodeURIComponent(value.slug)}`,
      ),
      targetId: item.targetId,
      rootCategorySlug: null,
    }];
  });

  // A deleted category/attribute should not leave a storefront without any
  // navigation. Invalid targets are omitted and the catalog remains reachable.
  return resolved.length > 0 ? resolved : [catalogItem(storeSlug, catalogLabel)];
}
