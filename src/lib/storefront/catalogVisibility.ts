import type { PublicProductPage, PublicStoreCategory, PublicStoreCollection, PublicStoreFacet } from '@/types/common.types';

interface CategoryContext {
  id: string;
  parentId: string | null;
}

/**
 * Facets relevant to a category context, with each facet's values pruned to
 * only those that have at least one matching product in `productsInScope`.
 * Global facets (appliesToAllCategories) always pass; category-scoped facets
 * only pass when assigned directly to `activeCategory`, or to its parent
 * with appliesToChildren=true. `productsInScope` should already be narrowed
 * to the category/collection being browsed by the caller.
 */
export function getContextualFacets(
  facets: PublicStoreFacet[],
  activeCategory: CategoryContext | null,
  productsInScope: PublicProductPage[]
): PublicStoreFacet[] {
  return facets
    .filter((facet) => {
      if (facet.appliesToAllCategories) return true;
      if (!activeCategory) return false;
      return facet.applicableCategories.some((assignment) => {
        if (assignment.categoryId === activeCategory.id) return true;
        if (assignment.appliesToChildren && activeCategory.parentId === assignment.categoryId) return true;
        return false;
      });
    })
    .map((facet) => ({
      ...facet,
      values: facet.values.filter((value) =>
        productsInScope.some((product) =>
          product.facetValues.some((fv) => fv.facetSlug === facet.slug && fv.valueSlug === value.slug)
        )
      ),
    }))
    .filter((facet) => facet.values.length > 0);
}

/** Removes root categories and subcategories that have zero products assigned. */
export function pruneEmptyCategoryTree(
  tree: PublicStoreCategory[],
  products: Pick<PublicProductPage, 'categoryId'>[]
): PublicStoreCategory[] {
  const idsWithProducts = new Set(
    products.filter((p) => p.categoryId).map((p) => p.categoryId as string)
  );
  return tree
    .map((root) => ({
      ...root,
      children: (root.children ?? []).filter((child) => idsWithProducts.has(child.id)),
    }))
    .filter((root) => idsWithProducts.has(root.id) || (root.children ?? []).length > 0);
}

/** Removes collections that have zero products assigned. */
export function pruneEmptyCollections(
  collections: PublicStoreCollection[],
  products: Pick<PublicProductPage, 'collections'>[]
): PublicStoreCollection[] {
  return collections.filter((collection) =>
    products.some((p) => p.collections.some((pc) => pc.slug === collection.slug))
  );
}
