export interface FacetFilter {
  facetSlug: string;
  valueSlug: string;
}

export interface CatalogFilters {
  categorySlug: string;
  subcategorySlug: string;
  collectionSlug: string;
  facets: FacetFilter[];
  priceMin: number | null;
  priceMax: number | null;
  onlyFeatured: boolean;
  onlyOnSale: boolean;
  query: string;
}

export const EMPTY_FILTERS: CatalogFilters = {
  categorySlug: '',
  subcategorySlug: '',
  collectionSlug: '',
  facets: [],
  priceMin: null,
  priceMax: null,
  onlyFeatured: false,
  onlyOnSale: false,
  query: '',
};

export type SortKey = 'relevance' | 'price_asc' | 'price_desc' | 'name_asc' | 'newest' | 'featured';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'relevance', label: 'Relevancia' },
  { key: 'featured', label: 'Destacados' },
  { key: 'newest', label: 'Más nuevos' },
  { key: 'price_asc', label: 'Precio: menor a mayor' },
  { key: 'price_desc', label: 'Precio: mayor a menor' },
  { key: 'name_asc', label: 'Nombre A→Z' },
];

export function filtersFromUrl(params: URLSearchParams): CatalogFilters {
  const priceMinRaw = params.get('priceMin');
  const priceMaxRaw = params.get('priceMax');

  const facets: FacetFilter[] = [];
  params.forEach((value, key) => {
    if (key.startsWith('f_')) {
      const facetSlug = key.slice(2);
      const valueSlugs = value.split(',').filter(Boolean);
      for (const valueSlug of valueSlugs) {
        facets.push({ facetSlug, valueSlug });
      }
    }
  });

  return {
    categorySlug: params.get('cat') ?? '',
    subcategorySlug: params.get('sub') ?? '',
    collectionSlug: params.get('collection') ?? '',
    facets,
    priceMin: priceMinRaw !== null ? Number(priceMinRaw) : null,
    priceMax: priceMaxRaw !== null ? Number(priceMaxRaw) : null,
    onlyFeatured: params.get('featured') === '1',
    onlyOnSale: params.get('sale') === '1',
    query: params.get('q') ?? '',
  };
}

export function filtersToUrl(f: CatalogFilters, sort: SortKey): URLSearchParams {
  const params = new URLSearchParams();
  if (f.query) params.set('q', f.query);
  if (f.categorySlug) params.set('cat', f.categorySlug);
  if (f.subcategorySlug) params.set('sub', f.subcategorySlug);
  if (f.collectionSlug) params.set('collection', f.collectionSlug);

  const facetGroups = new Map<string, string[]>();
  for (const { facetSlug, valueSlug } of f.facets) {
    const group = facetGroups.get(facetSlug) ?? [];
    group.push(valueSlug);
    facetGroups.set(facetSlug, group);
  }
  facetGroups.forEach((valueSlugs, facetSlug) => {
    params.set(`f_${facetSlug}`, valueSlugs.join(','));
  });

  if (f.priceMin !== null) params.set('priceMin', String(f.priceMin));
  if (f.priceMax !== null) params.set('priceMax', String(f.priceMax));
  if (f.onlyFeatured) params.set('featured', '1');
  if (f.onlyOnSale) params.set('sale', '1');
  if (sort !== 'relevance') params.set('sort', sort);
  return params;
}
