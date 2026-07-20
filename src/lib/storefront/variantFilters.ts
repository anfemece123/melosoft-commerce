import type { PublicProductPage, PublicStoreFacet, PublicStoreFacetValue, PublicVariantOption } from '@/types/common.types';
import { isVariantAvailable } from '@/lib/products/productVariants.utils';

export interface FacetFilterLike {
  facetSlug: string;
  valueSlug: string;
}

const VARIANT_FACET_SLUG_PREFIX = 'v-';

/** lower + trim + strip diacritics — used to detect "Talla"/"talla"/"Size" as
 * the same filter name, and to merge a variant option into a real store
 * facet of the same concept (e.g. "Color" attribute + "Color" variant). */
export function normalizeFilterKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function toSlug(input: string): string {
  return normalizeFilterKey(input).replace(/\s+/g, '-');
}

/** facetSlug -> normalized concept name (e.g. "color"), built once from the
 * unified facet list returned by buildUnifiedPublicFacets. Every helper below
 * that needs to know "is this facet the same concept as one of THIS
 * product's variant options" takes this map rather than recomputing it. */
export function buildFacetConcepts(facets: PublicStoreFacet[]): Map<string, string> {
  const concepts = new Map<string, string>();
  for (const facet of facets) {
    concepts.set(facet.slug, normalizeFilterKey(facet.name));
  }
  return concepts;
}

/** The product's own variant option matching a facet's concept name, if it
 * has one — the crux of "is Color an attribute or a variant for THIS
 * specific product". A product can have neither, one, or (in principle)
 * several options normalizing to the same name; the first is used. */
function findVariantOptionForConcept(product: PublicProductPage, normalizedConceptName: string): PublicVariantOption | null {
  return product.variantOptions.find((option) => normalizeFilterKey(option.name) === normalizedConceptName) ?? null;
}

/**
 * True if `product` satisfies `facetSlug=valueSlug`. Resolves through the
 * product's OWN variant option of the same concept (checking its
 * active/available variants) when it has one, or through its plain
 * attribute `facetValues` otherwise.
 *
 * This is the single source of truth for "does this product have this
 * value" — every other helper below (contextual pruning, combo-aware
 * pruning, catalog filtering) is built on top of it, so a value is never
 * treated one way for display and another way for filtering.
 */
export function productSatisfiesFacetValue(
  product: PublicProductPage,
  facetSlug: string,
  valueSlug: string,
  concepts: Map<string, string>
): boolean {
  const conceptName = concepts.get(facetSlug);
  const variantOption = conceptName ? findVariantOptionForConcept(product, conceptName) : null;

  if (variantOption) {
    return product.variants.some(
      (variant) =>
        isVariantAvailable(variant) &&
        variant.optionValues.some((ov) => ov.optionId === variantOption.id && toSlug(ov.value) === valueSlug)
    );
  }

  return product.facetValues.some((fv) => fv.facetSlug === facetSlug && fv.valueSlug === valueSlug);
}

interface VariantConceptGroup {
  name: string;
  sortOrder: number;
  values: Map<string, { value: string; sources: Set<'attribute' | 'variant'> }>;
}

/** Collects, per normalized concept name, every value contributed by any
 * product's variant options (marked useAsPublicFilter, with at least one
 * active/available variant using it). */
function collectVariantConceptGroups(products: PublicProductPage[]): Map<string, VariantConceptGroup> {
  const groups = new Map<string, VariantConceptGroup>();

  for (const product of products) {
    for (const option of product.variantOptions) {
      if (!option.useAsPublicFilter) continue;
      const normalizedName = normalizeFilterKey(option.name);
      const group = groups.get(normalizedName) ?? { name: option.name, sortOrder: option.sortOrder, values: new Map() };
      groups.set(normalizedName, group);

      for (const value of option.values) {
        const hasAvailableVariant = product.variants.some(
          (variant) =>
            isVariantAvailable(variant) &&
            variant.optionValues.some((ov) => ov.optionId === option.id && ov.valueId === value.id)
        );
        if (!hasAvailableVariant) continue;

        const slug = toSlug(value.value);
        const existing = group.values.get(slug);
        if (existing) {
          existing.sources.add('variant');
        } else {
          group.values.set(slug, { value: value.value, sources: new Set(['variant']) });
        }
      }
    }
  }

  return groups;
}

/**
 * Builds the ONE public facet list the catalog renders. A real store facet
 * (e.g. "Color" used as a plain attribute on some products) and a variant
 * option of the same normalized name (e.g. "Color" used as a purchasable
 * option on other products) are MERGED into a single facet: one visual
 * filter, with the union of both sets of values, each tagged with which
 * source(s) it came from. A variant option that doesn't collide with any
 * real facet still gets its own synthetic v-prefixed facet, same as before.
 *
 * Nothing is ever discarded here — the old behavior (skip the variant option
 * entirely on a name collision) lost every variant-only value on collision;
 * this keeps them, merged in.
 */
export function buildUnifiedPublicFacets(
  products: PublicProductPage[],
  realFacets: PublicStoreFacet[]
): PublicStoreFacet[] {
  const realNormalizedNames = new Set(realFacets.map((f) => normalizeFilterKey(f.name)));
  const variantGroups = collectVariantConceptGroups(products);

  const mergedRealFacets = realFacets.map((facet): PublicStoreFacet => {
    const group = variantGroups.get(normalizeFilterKey(facet.name));
    if (!group) return facet;

    const valuesBySlug = new Map<string, PublicStoreFacetValue>();
    for (const value of facet.values) {
      valuesBySlug.set(value.slug, { ...value, sources: value.sources ?? ['attribute'] });
    }
    for (const [, entry] of group.values) {
      const slug = toSlug(entry.value);
      const existing = valuesBySlug.get(slug);
      if (existing) {
        existing.sources = Array.from(new Set([...(existing.sources ?? ['attribute']), ...entry.sources]));
      } else {
        valuesBySlug.set(slug, {
          id: `variant:${facet.id}:${slug}`,
          storeId: facet.storeId,
          facetId: facet.id,
          value: entry.value,
          slug,
          sortOrder: valuesBySlug.size,
          sources: Array.from(entry.sources),
        });
      }
    }

    const values = Array.from(valuesBySlug.values()).sort((a, b) => a.value.localeCompare(b.value));
    const hasAttribute = values.some((v) => v.sources?.includes('attribute'));
    const hasVariant = values.some((v) => v.sources?.includes('variant'));
    return {
      ...facet,
      values,
      source: hasAttribute && hasVariant ? 'mixed' : hasVariant ? 'variant' : 'attribute',
    };
  });

  const syntheticFacets: PublicStoreFacet[] = Array.from(variantGroups.entries())
    .filter(([normalizedName, group]) => !realNormalizedNames.has(normalizedName) && group.values.size > 0)
    .map(([normalizedName, group]) => ({
      id: `${VARIANT_FACET_SLUG_PREFIX}${normalizedName}`,
      storeId: '',
      storeSlug: '',
      name: group.name,
      slug: `${VARIANT_FACET_SLUG_PREFIX}${toSlug(group.name)}`,
      inputType: 'multi_select' as const,
      showInCatalogFilters: true,
      showInMegaMenu: false,
      appliesToAllCategories: true,
      applicableCategories: [],
      sortOrder: group.sortOrder,
      source: 'variant' as const,
      values: Array.from(group.values.entries())
        .map(([slug, entry], index) => ({
          id: `variant:${normalizedName}:${slug}`,
          storeId: '',
          facetId: `${VARIANT_FACET_SLUG_PREFIX}${normalizedName}`,
          value: entry.value,
          slug,
          sortOrder: index,
          sources: Array.from(entry.sources) as ('attribute' | 'variant')[],
        }))
        .sort((a, b) => a.value.localeCompare(b.value)),
    }));

  return [...mergedRealFacets, ...syntheticFacets];
}

/**
 * True only if `product` satisfies every selected filter — values on the
 * SAME facet are OR'd (checking two colors broadens results, same as a
 * normal checkbox filter), different facets are AND'd.
 *
 * The critical rule: for THIS product, a facet resolves either as
 * variant-scoped (the product has its own variant option of that concept —
 * e.g. Color is a purchasable option on this specific product) or as
 * attribute-scoped (no such variant option — Color, if present at all here,
 * is a plain per-product tag). ALL variant-scoped facets in the selection
 * must be satisfied by a SINGLE active/available variant (exact
 * combination, e.g. Color=Negro + Talla=M must be the same variant).
 * Attribute-scoped facets apply to the product as a whole and combine
 * freely with variant-scoped ones — e.g. a shoe with Color as a plain
 * attribute and Talla as its only variant option: Color=Naranja (attribute,
 * whole product) AND Talla=40 (variant) don't need to "be the same variant"
 * since Color never varied by variant in the first place.
 */
export function productMatchesFilters(
  product: PublicProductPage,
  selectedFilters: FacetFilterLike[],
  concepts: Map<string, string>
): boolean {
  if (selectedFilters.length === 0) return true;

  const groups = new Map<string, Set<string>>();
  for (const ff of selectedFilters) {
    const group = groups.get(ff.facetSlug) ?? new Set<string>();
    group.add(ff.valueSlug);
    groups.set(ff.facetSlug, group);
  }

  const variantScopedGroups: { option: PublicVariantOption; valueSlugs: Set<string> }[] = [];
  for (const [facetSlug, valueSlugs] of groups) {
    const conceptName = concepts.get(facetSlug);
    const variantOption = conceptName ? findVariantOptionForConcept(product, conceptName) : null;

    if (variantOption) {
      variantScopedGroups.push({ option: variantOption, valueSlugs });
      continue;
    }

    const satisfiesAttribute = Array.from(valueSlugs).some((valueSlug) =>
      product.facetValues.some((fv) => fv.facetSlug === facetSlug && fv.valueSlug === valueSlug)
    );
    if (!satisfiesAttribute) return false;
  }

  if (variantScopedGroups.length === 0) return true;

  return product.variants.some((variant) => {
    if (!isVariantAvailable(variant)) return false;
    return variantScopedGroups.every(({ option, valueSlugs }) =>
      variant.optionValues.some((ov) => ov.optionId === option.id && valueSlugs.has(toSlug(ov.value)))
    );
  });
}

/**
 * Makes the sidebar/drawer combo-aware: for a facet that has at least one
 * variant-sourced value (a merged facet or a pure synthetic one), a value
 * only stays visible if some product still satisfies it TOGETHER WITH
 * whatever is already selected on the OTHER combo-aware facets — via the
 * same `productMatchesFilters` used for the actual catalog filtering, so
 * pruning and filtering can never disagree.
 *
 * Facets with zero variant-sourced values (pure attribute facets like
 * Marca/Genero) are left untouched and never act as combo context either —
 * they've always worked independently of each other, and that isn't
 * changed here.
 */
export function pruneFacetValuesByCombination(
  facets: PublicStoreFacet[],
  products: PublicProductPage[],
  selectedFilters: FacetFilterLike[],
  concepts: Map<string, string>
): PublicStoreFacet[] {
  const comboAwareSlugs = new Set(
    facets.filter((f) => f.values.some((v) => v.sources?.includes('variant'))).map((f) => f.slug)
  );
  if (comboAwareSlugs.size === 0) return facets;

  const comboAwareSelections = selectedFilters.filter((ff) => comboAwareSlugs.has(ff.facetSlug));
  if (comboAwareSelections.length === 0) return facets;

  return facets.map((facet) => {
    if (!comboAwareSlugs.has(facet.slug)) return facet;

    const otherSelections = comboAwareSelections.filter((ff) => ff.facetSlug !== facet.slug);

    return {
      ...facet,
      values: facet.values.filter((value) =>
        products.some((product) =>
          productMatchesFilters(product, [...otherSelections, { facetSlug: facet.slug, valueSlug: value.slug }], concepts)
        )
      ),
    };
  });
}
