import type { PublicProductPage, PublicStoreCategory, PublicStoreCollection, PublicStoreFacet } from '@/types/common.types';
import { productSatisfiesFacetValue } from './variantFilters';

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
 *
 * `concepts` (from buildFacetConcepts, over the SAME unified facet list
 * passed in as `facets`) lets the value-existence check resolve merged
 * attribute+variant facets correctly: a value contributed only via a
 * product's variant option is checked against that product's variants, not
 * its (nonexistent) facetValues row.
 */
export function getContextualFacets(
  facets: PublicStoreFacet[],
  activeCategory: CategoryContext | null,
  productsInScope: PublicProductPage[],
  concepts: Map<string, string>
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
        productsInScope.some((product) => productSatisfiesFacetValue(product, facet.slug, value.slug, concepts))
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
