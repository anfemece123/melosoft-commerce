import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Package, UtensilsCrossed, Search, AlertCircle, SlidersHorizontal, X } from 'lucide-react';
import { StorefrontBreadcrumbs } from '@/components/public/storefront/StorefrontBreadcrumbs';
import { CatalogFilterSidebar } from '@/components/public/catalog/CatalogFilterSidebar';
import { CatalogFilterDrawer } from '@/components/public/catalog/CatalogFilterDrawer';
import { SORT_OPTIONS, filtersFromUrl, filtersToUrl } from '@/components/public/catalog/catalogFilter.types';
import type { CatalogFilters, SortKey } from '@/components/public/catalog/catalogFilter.types';
import { productsService } from '@/features/products/productsService';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';
import { categoriesService, buildCategoryTree } from '@/features/categories/categoriesService';
import { collectionsService } from '@/features/collections/collectionsService';
import { facetsService } from '@/features/facets/facetsService';
import { getContextualFacets } from '@/lib/storefront/catalogVisibility';
import {
  buildUnifiedPublicFacets,
  buildFacetConcepts,
  pruneFacetValuesByCombination,
} from '@/lib/storefront/variantFilters';
import { buildCatalogItems, catalogItemMatchesFilters } from '@/lib/storefront/catalogItems';
import type { PublicProductPage, PublicStoreCategory, PublicStoreCollection, PublicStoreFacet } from '@/types/common.types';
import { formatCurrency } from '@/utils/formatCurrency';
import { StorefrontProductCard } from '@/components/public/storefront/StorefrontProductCard';
import { StorefrontPageLoader } from '@/components/public/storefront/StorefrontPageLoader';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { usePublicRouteReady } from '@/components/layout/PublicRouteReadyContext';
import { useCart } from '@/lib/cart/cartContext';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { notify } from '@/lib/notifications';
import { getActivePrice } from '@/lib/pricing/pricing.utils';
import {
  getCatalogLabel,
  getProductCardCtaLabel,
  canUseWebOrders,
  type PublicCommerceConfig,
} from '@/lib/commerce/commerceConfig.utils';
import { writePublicScrollPosition } from '@/lib/storefront/publicScrollRestoration';
import { useResolvedStoreSlug } from '@/lib/storefront/storefrontDomainContext';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

// ── Root component ─────────────────────────────────────────────

const CATALOG_PAGE_SIZE = 24;
const MIN_FILTER_RESULTS_BEFORE_PREFETCH = 18;
// Deliberately wider than the shared STOREFRONT_CONTAINER_CLASS (used by
// home/PDP/header/footer) — the catalog's sidebar+grid layout benefits
// from more room than a plain content section, and this is the one page
// asked to feel less boxed-in without widening every other page too.
const CATALOG_CONTAINER_CLASS = 'max-w-screen-2xl';

export function StoreCatalogPage() {
  const { storeSlug: routeStoreSlug } = useParams<{ storeSlug: string }>();
  const storeSlug = useResolvedStoreSlug(routeStoreSlug);
  if (!storeSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <h1 className="text-xl font-bold text-gray-800">Tienda no encontrada</h1>
      </div>
    );
  }
  return <CatalogContent storeSlug={storeSlug} />;
}

// ── Filter chip ───────────────────────────────────────────────

function FilterChip({
  label,
  onRemove,
  primaryColor,
}: {
  label: string;
  onRemove: () => void;
  primaryColor: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{ borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}12` }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 transition-opacity hover:opacity-70"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ── Main content ───────────────────────────────────────────────

function CatalogContent({ storeSlug }: { storeSlug: string }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { branding: storeBranding } = usePublicStoreBranding();
  const { setRouteReady } = usePublicRouteReady();
  const { addItem } = useCart();
  const { selectedLocation } = useSelectedLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const nextOffsetRef = useRef(0);
  const requestVersionRef = useRef(0);

  // Derive all state from URL
  const filters = filtersFromUrl(searchParams);
  const sort = (searchParams.get('sort') ?? 'relevance') as SortKey;

  const [localSearch, setLocalSearch] = useState(filters.query);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [products, setProducts] = useState<PublicProductPage[]>([]);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [collections, setCollections] = useState<PublicStoreCollection[]>([]);
  const [facets, setFacets] = useState<PublicStoreFacet[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [unavailableProductIds, setUnavailableProductIds] = useState<Set<string>>(new Set());
  const [totalProductCount, setTotalProductCount] = useState(0);
  const [serverPriceRange, setServerPriceRange] = useState({ min: 0, max: 0 });
  const selectedCategoryIdForQuery = useMemo(
    () => categories.find((category) => category.slug === filters.categorySlug)?.id ?? null,
    [categories, filters.categorySlug]
  );

  // Sync local search box when URL query changes externally
  useEffect(() => {
    setLocalSearch(filters.query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('q')]);

  const hasMoreProducts = products.length < totalProductCount;

  const loadNextProductsPage = useCallback(async (reset = false) => {
    if (!reset && (contentLoading || loadingMore || !hasMoreProducts)) return;

    const requestVersion = reset ? requestVersionRef.current + 1 : requestVersionRef.current;
    if (reset) {
      requestVersionRef.current = requestVersion;
      nextOffsetRef.current = 0;
      setProducts([]);
      setTotalProductCount(0);
      setContentLoading(true);
      setError(null);
      setLoadMoreError(null);
    } else {
      setLoadingMore(true);
      setLoadMoreError(null);
    }

    try {
      const offset = reset ? 0 : nextOffsetRef.current;
      const { products: pageProducts, totalCount } = await productsService.searchPublicCatalogPage({
        storeSlug,
        categorySlug: filters.categorySlug,
        categoryParentId: selectedCategoryIdForQuery,
        subcategorySlug: filters.subcategorySlug,
        collectionSlug: filters.collectionSlug,
        query: filters.query,
        onlyFeatured: filters.onlyFeatured,
        onlyOnSale: filters.onlyOnSale,
        sortKey: sort,
        offset,
        limit: CATALOG_PAGE_SIZE,
      });

      if (requestVersionRef.current !== requestVersion) return;

      nextOffsetRef.current = offset + pageProducts.length;
      setTotalProductCount(totalCount);
      setProducts((current) => {
        if (reset) return pageProducts;
        const seen = new Set(current.map((product) => product.productId));
        const merged = [...current];
        for (const product of pageProducts) {
          if (seen.has(product.productId)) continue;
          seen.add(product.productId);
          merged.push(product);
        }
        return merged;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando productos';
      if (reset) setError(message);
      else setLoadMoreError(message);
    } finally {
      if (reset) setContentLoading(false);
      else setLoadingMore(false);
    }
  }, [
    contentLoading,
    filters.categorySlug,
    filters.collectionSlug,
    filters.onlyFeatured,
    filters.onlyOnSale,
    filters.query,
    filters.subcategorySlug,
    hasMoreProducts,
    loadingMore,
    selectedCategoryIdForQuery,
    sort,
    storeSlug,
  ]);

  useEffect(() => {
    void loadNextProductsPage(true);
  // Reset paging when store or server-side catalog query inputs change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    storeSlug,
    filters.categorySlug,
    filters.subcategorySlug,
    filters.collectionSlug,
    filters.query,
    filters.onlyFeatured,
    filters.onlyOnSale,
    sort,
    selectedCategoryIdForQuery,
  ]);

  useEffect(() => {
    let cancelled = false;
    productsService.getPublicCatalogPriceBounds({
      storeSlug,
      categorySlug: filters.categorySlug,
      categoryParentId: selectedCategoryIdForQuery,
      subcategorySlug: filters.subcategorySlug,
      collectionSlug: filters.collectionSlug,
      query: filters.query,
      onlyFeatured: filters.onlyFeatured,
      onlyOnSale: filters.onlyOnSale,
    }).then((bounds) => {
      if (!cancelled) setServerPriceRange(bounds);
    }).catch(() => {
      if (!cancelled) setServerPriceRange({ min: 0, max: 0 });
    });
    return () => { cancelled = true; };
  }, [
    storeSlug,
    filters.categorySlug,
    filters.subcategorySlug,
    filters.collectionSlug,
    filters.query,
    filters.onlyFeatured,
    filters.onlyOnSale,
    selectedCategoryIdForQuery,
  ]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      categoriesService.getPublicCategories(storeSlug),
      collectionsService.getPublicCollections(storeSlug),
      facetsService.getPublicFacets(storeSlug),
    ]).then(([cats, cols, fcts]) => {
      if (cancelled) return;
      setCategories(cats);
      setCollections(cols);
      setFacets(fcts);
    }).catch(() => { /* non-critical */ });
    return () => { cancelled = true; };
  }, [storeSlug]);

  useEffect(() => {
    setRouteReady(!contentLoading);
  }, [contentLoading, setRouteReady]);

  useEffect(() => {
    if (!storeBranding?.storeId || !selectedLocation) {
      setUnavailableProductIds(new Set());
      return;
    }
    productAvailabilityService
      .getUnavailableProductIds(storeBranding.storeId, selectedLocation.locationId)
      .then((ids) => setUnavailableProductIds(ids))
      .catch(() => setUnavailableProductIds(new Set()));
  }, [selectedLocation, storeBranding?.storeId]);

  const store = storeBranding;
  const theme = buildStorefrontTheme({
    mode: store?.themeMode,
    primaryColor: store?.primaryColor,
    secondaryColor: store?.secondaryColor,
    accentColor: store?.accentColor,
    backgroundColor: store?.backgroundColor,
    textColor: store?.textColor,
    buttonRadius: store?.buttonRadius,
  });

  const commerceConfig: PublicCommerceConfig = {
    catalogType: store?.catalogType ?? null,
    commerceMode: store?.commerceMode ?? null,
    allowsPickup: store?.allowsPickup ?? null,
    allowsLocalDelivery: store?.allowsLocalDelivery ?? null,
    allowsNationalShipping: store?.allowsNationalShipping ?? null,
    whatsappCheckoutEnabled: store?.whatsappCheckoutEnabled ?? null,
    webOrderEnabled: store?.webOrderEnabled ?? null,
    cashOnDeliveryEnabled: store?.cashOnDeliveryEnabled ?? null,
    onlineCheckoutEnabled: store?.onlineCheckoutEnabled ?? null,
    localDeliveryNotes: store?.localDeliveryNotes ?? null,
    shippingNotes: store?.shippingNotes ?? null,
  };

  const catalogLabel = getCatalogLabel(commerceConfig);
  const productCardCtaLabel = getProductCardCtaLabel(commerceConfig);
  const showCartButton = canUseWebOrders(commerceConfig);
  const isMenu = store?.catalogType === 'menu';
  const currency = store?.currency ?? 'COP';

  // ── Derived data ─────────────────────────────────────────────
  // Unified facet list: real store facets, with any product variant option
  // of the same normalized name (e.g. "Color" used as a purchasable option
  // on some products) MERGED into the matching facet's values instead of
  // being dropped on collision — a variant option with no colliding real
  // facet still gets its own synthetic facet, same as before. `products`
  // itself never needs synthetic facetValues injected anymore — matching
  // reads each product's variantOptions/variants directly (see
  // productSatisfiesFacetValue/productMatchesFilters).
  const allFacets = useMemo(() => buildUnifiedPublicFacets(products, facets), [products, facets]);
  const facetConcepts = useMemo(() => buildFacetConcepts(allFacets), [allFacets]);

  // Full (unpruned) root tree — the source of truth for resolving the
  // currently selected category/subcategory from the URL, so that deep
  // linking into a category with zero current products still filters
  // correctly to an empty result instead of silently showing everything.
  const fullCategoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const categoryTree = fullCategoryTree;
  const nonEmptyCollections = collections;
  const priceRange = serverPriceRange;

  const selectedCategoryNode = useMemo(
    () => fullCategoryTree.find((c) => c.slug === filters.categorySlug) ?? null,
    [fullCategoryTree, filters.categorySlug]
  );

  const selectedSubcategoryNode = useMemo(() => {
    if (!filters.subcategorySlug || !selectedCategoryNode) return null;
    return (selectedCategoryNode.children ?? []).find((c) => c.slug === filters.subcategorySlug) ?? null;
  }, [selectedCategoryNode, filters.subcategorySlug]);

  // The category context used to resolve which facets are relevant: the
  // subcategory when one is selected, otherwise the parent category.
  const activeCategoryNode = selectedSubcategoryNode ?? selectedCategoryNode;

  // Subcategory *options* shown in the filter UI — pruned to non-empty only.
  const sidebarSubcategories = useMemo<PublicStoreCategory[]>(() => {
    return selectedCategoryNode?.children ?? [];
  }, [selectedCategoryNode]);

  // Products already narrowed by category/collection (but not by facet
  // selections themselves) — used only to prune facet values that have no
  // matching product in the current context.
  const productsInFilterScope = useMemo(() => {
    let list = products;
    if (filters.subcategorySlug) {
      list = list.filter((p) => p.categorySlug === filters.subcategorySlug);
    } else if (filters.categorySlug && selectedCategoryNode) {
      list = list.filter(
        (p) => p.categorySlug === filters.categorySlug || p.categoryParentId === selectedCategoryNode.id
      );
    }
    if (filters.collectionSlug) {
      list = list.filter((p) => p.collections.some((c) => c.slug === filters.collectionSlug));
    }
    return list;
  }, [products, filters.subcategorySlug, filters.categorySlug, filters.collectionSlug, selectedCategoryNode]);

  // Facets visible for the current category context: global facets always,
  // facets assigned directly to the active category, or inherited from its
  // parent when appliesToChildren=true — pruned to non-empty values only.
  // Facets with any variant-sourced value (merged attribute+variant facets,
  // and pure synthetic ones) get a second, combo-aware pass: once e.g.
  // Talla=40 is selected, Color only keeps values that actually co-occur
  // with 40 — not every color that exists on any size. Pure attribute
  // facets are untouched by this second pass, same as before.
  const visibleFacets = useMemo(() => {
    const contextual = getContextualFacets(allFacets, activeCategoryNode, productsInFilterScope, facetConcepts);
    return pruneFacetValuesByCombination(contextual, productsInFilterScope, filters.facets, facetConcepts);
  }, [allFacets, activeCategoryNode, productsInFilterScope, filters.facets, facetConcepts]);

  // ── Apply filters + sort ─────────────────────────────────────
  const filteredAndSorted = useMemo(() => {
    let list = [...products];

    if (filters.subcategorySlug) {
      list = list.filter((p) => p.categorySlug === filters.subcategorySlug);
    } else if (filters.categorySlug && selectedCategoryNode) {
      list = list.filter(
        (p) =>
          p.categorySlug === filters.categorySlug ||
          p.categoryParentId === selectedCategoryNode.id
      );
    }

    if (filters.collectionSlug) {
      list = list.filter((p) => p.collections.some((collection) => collection.slug === filters.collectionSlug));
    }

    if (filters.onlyFeatured) {
      list = list.filter((p) => p.isFeatured);
    }
    if (filters.onlyOnSale) {
      list = list.filter((p) => p.salePrice !== null && p.salePrice < p.regularPrice);
    }
    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.categoryName ?? '').toLowerCase().includes(q)
      );
    }

    // From here on, work at the catalog-item (card) level, not the product
    // level — a product with showVariantsAsCards splits into one item per
    // visual value (Color/Modelo), each with its OWN price/availability and
    // its OWN filter match (see catalogItemMatchesFilters). Every other
    // product still yields exactly one item, so nothing changes for them.
    let items = buildCatalogItems(list);

    if (filters.facets.length > 0) {
      items = items.filter((item) => catalogItemMatchesFilters(item, filters.facets, facetConcepts));
    }

    if (filters.priceMin !== null) {
      items = items.filter((item) => item.maxPrice >= (filters.priceMin as number));
    }
    if (filters.priceMax !== null) {
      items = items.filter((item) => item.minPrice <= (filters.priceMax as number));
    }

    switch (sort) {
      case 'price_asc':
        items.sort((a, b) => a.minPrice - b.minPrice);
        break;
      case 'price_desc':
        items.sort((a, b) => b.maxPrice - a.maxPrice);
        break;
      case 'name_asc':
        items.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      case 'featured':
        items.sort((a, b) => (b.product.isFeatured ? 1 : 0) - (a.product.isFeatured ? 1 : 0));
        break;
    }

    return items;
  }, [products, filters, selectedCategoryNode, sort, facetConcepts]);

  // ── Helpers ──────────────────────────────────────────────────
  function setFilters(f: CatalogFilters) {
    setSearchParams(filtersToUrl(f, sort), { replace: true });
  }

  function setSort(s: SortKey) {
    setSearchParams(filtersToUrl(filters, s), { replace: true });
  }

  function clearAllFilters() {
    setLocalSearch('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFilters({ ...filters, query: localSearch.trim() });
  }

  function handleAddProductToCart(event: MouseEvent<HTMLElement>, product: PublicProductPage) {
    event.preventDefault();
    event.stopPropagation();
    if (unavailableProductIds.has(product.productId)) return;
    const added = addItem({
      productId: product.productId,
      storeId: storeBranding?.storeId ?? '',
      productSlug: product.productSlug,
      productName: product.productName,
      productType: product.productType,
      imageUrl: product.mainImageUrl,
      unitPrice: getActivePrice(product.regularPrice, product.salePrice),
      customizationNotes: null,
      customizations: [],
      stock: product.stock,
      trackInventory: product.trackInventory,
      isAvailable: product.isAvailable,
    });
    if (!added) {
      notify.warning(
        product.productType === 'menu_item'
          ? `"${product.productName}" está agotado por el momento.`
          : `"${product.productName}" no tiene stock disponible.`
      );
      return;
    }
    notify.cartSuccess(`"${product.productName}" agregado al pedido`);
  }

  function persistCurrentScrollPosition() {
    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    writePublicScrollPosition(routeKey, window.scrollY);
  }

  const hasAnyFilter =
    !!filters.categorySlug ||
    !!filters.subcategorySlug ||
    !!filters.collectionSlug ||
    filters.facets.length > 0 ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.onlyFeatured ||
    filters.onlyOnSale;

  const hasActiveSearch = !!filters.query;
  const shouldAutoPrefetchForFilters = (hasAnyFilter || hasActiveSearch) && filteredAndSorted.length < MIN_FILTER_RESULTS_BEFORE_PREFETCH;

  useEffect(() => {
    if (!shouldAutoPrefetchForFilters || contentLoading || loadingMore || !hasMoreProducts) return;
    void loadNextProductsPage();
  }, [shouldAutoPrefetchForFilters, contentLoading, loadingMore, hasMoreProducts, loadNextProductsPage]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || contentLoading || loadingMore || !hasMoreProducts) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        void loadNextProductsPage();
      },
      { rootMargin: '900px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [contentLoading, loadingMore, hasMoreProducts, loadNextProductsPage]);

  const emptyState = filters.collectionSlug
    ? {
        title: 'No hay productos en esta colección',
        subtitle: 'Vuelve pronto o revisa el catálogo completo.',
      }
    : filters.categorySlug
    ? {
        title: 'No hay productos en esta categoría',
        subtitle: 'Explora otras categorías del catálogo.',
      }
    : hasAnyFilter || hasActiveSearch
    ? {
        title: 'No encontramos productos con estos filtros',
        subtitle: 'Prueba quitando algún filtro o revisando otra categoría.',
      }
    : isMenu
    ? {
        title: 'El menú está vacío por el momento',
        subtitle: 'Este negocio todavía no ha publicado platos.',
      }
    : {
        title: 'No hay productos disponibles',
        subtitle: 'Esta tienda todavía no tiene productos publicados.',
      };

  // ── Render ───────────────────────────────────────────────────
  if (contentLoading && !store) {
    return <StorefrontPageLoader branding={storeBranding} label="Cargando catálogo…" />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const bgColor = store?.backgroundColor ?? '#ffffff';

  return (
    <div
      id="storefront-overview"
      style={{ backgroundColor: bgColor, color: theme.text, minHeight: '100vh', ...theme.cssVars }}
    >
      <div className={`${CATALOG_CONTAINER_CLASS} mx-auto px-4 py-6 sm:px-6 md:py-8 lg:px-8`}>
        {/* Breadcrumbs */}
        <StorefrontBreadcrumbs
          theme={theme}
          className="mb-4"
          items={[
            { label: 'Inicio', href: buildStorefrontPath(storeSlug) },
            ...(filters.categorySlug && selectedCategoryNode
              ? [
                  { label: catalogLabel, href: buildStorefrontPath(storeSlug, '/catalog') },
                  selectedSubcategoryNode
                    ? { label: selectedCategoryNode.name, href: buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(selectedCategoryNode.slug)}`) }
                    : { label: selectedCategoryNode.name },
                  ...(selectedSubcategoryNode ? [{ label: selectedSubcategoryNode.name }] : []),
                ]
              : [{ label: catalogLabel }]),
          ]}
        />

        {/* Page header */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {isMenu
                ? <UtensilsCrossed className="w-5 h-5 shrink-0" style={{ color: theme.primary }} />
                : <Package className="w-5 h-5 shrink-0" style={{ color: theme.primary }} />}
              <h1 className="text-xl font-bold" style={{ color: theme.text }}>
                {selectedSubcategoryNode?.name ?? selectedCategoryNode?.name ?? catalogLabel}
              </h1>
            </div>
            {store?.storeName && (
              <p className="mt-0.5 text-sm" style={{ color: theme.mutedText }}>
                {store.storeName}
                {!contentLoading && (
                  <span className="ml-1">
                    · {hasAnyFilter || hasActiveSearch
                      ? `${filteredAndSorted.length}${hasMoreProducts ? '+' : ''} resultado${filteredAndSorted.length !== 1 ? 's' : ''}`
                      : `${totalProductCount} resultado${totalProductCount !== 1 ? 's' : ''}`}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Sort — desktop */}
          <div className="hidden lg:block">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 cursor-pointer rounded-lg border px-3 text-sm outline-none"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.surfaceAlt,
                color: theme.text,
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile: search + filter + sort */}
        <div className="mb-4 flex items-center gap-2 lg:hidden">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={isMenu ? 'Buscar en el menú…' : 'Buscar productos…'}
              className="h-10 w-full rounded-xl border pl-4 pr-10 text-sm outline-none"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.surfaceAlt,
                color: theme.text,
              }}
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <Search className="h-4 w-4" style={{ color: theme.mutedText }} />
            </button>
          </form>

          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              borderColor: hasAnyFilter ? theme.primary : theme.border,
              color: hasAnyFilter ? theme.primary : theme.text,
              backgroundColor: hasAnyFilter ? `${theme.primary}10` : theme.surfaceAlt,
            }}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtrar
            {hasAnyFilter && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: theme.primary }}
              />
            )}
          </button>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 shrink-0 cursor-pointer rounded-xl border px-2 text-xs outline-none"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.surfaceAlt,
              color: theme.text,
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Active filter chips */}
        {(hasAnyFilter || hasActiveSearch) && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {filters.query && (
              <FilterChip
                label={`"${filters.query}"`}
                primaryColor={theme.primary}
                onRemove={() => {
                  setLocalSearch('');
                  setFilters({ ...filters, query: '' });
                }}
              />
            )}
            {filters.categorySlug && (
              <FilterChip
                label={selectedCategoryNode?.name ?? filters.categorySlug}
                primaryColor={theme.primary}
                onRemove={() => setFilters({ ...filters, categorySlug: '', subcategorySlug: '' })}
              />
            )}
            {filters.subcategorySlug && (
              <FilterChip
                label={
                  categories.find((c) => c.slug === filters.subcategorySlug)?.name ??
                  filters.subcategorySlug
                }
                primaryColor={theme.primary}
                onRemove={() => setFilters({ ...filters, subcategorySlug: '' })}
              />
            )}
            {filters.collectionSlug && (
              <FilterChip
                label={collections.find((c) => c.slug === filters.collectionSlug)?.name ?? filters.collectionSlug}
                primaryColor={theme.primary}
                onRemove={() => setFilters({ ...filters, collectionSlug: '' })}
              />
            )}
            {filters.facets.map((ff) => {
              const facet = allFacets.find((f) => f.slug === ff.facetSlug);
              const val = facet?.values.find((v) => v.slug === ff.valueSlug);
              const label = facet && val ? `${facet.name}: ${val.value}` : ff.valueSlug;
              return (
                <FilterChip
                  key={`${ff.facetSlug}-${ff.valueSlug}`}
                  label={label}
                  primaryColor={theme.primary}
                  onRemove={() =>
                    setFilters({
                      ...filters,
                      facets: filters.facets.filter(
                        (f) => !(f.facetSlug === ff.facetSlug && f.valueSlug === ff.valueSlug)
                      ),
                    })
                  }
                />
              );
            })}
            {filters.priceMin !== null && (
              <FilterChip
                label={`Desde ${formatCurrency(filters.priceMin, 'es-CO', currency)}`}
                primaryColor={theme.primary}
                onRemove={() => setFilters({ ...filters, priceMin: null })}
              />
            )}
            {filters.priceMax !== null && (
              <FilterChip
                label={`Hasta ${formatCurrency(filters.priceMax, 'es-CO', currency)}`}
                primaryColor={theme.primary}
                onRemove={() => setFilters({ ...filters, priceMax: null })}
              />
            )}
            {filters.onlyFeatured && (
              <FilterChip
                label="Destacados"
                primaryColor={theme.primary}
                onRemove={() => setFilters({ ...filters, onlyFeatured: false })}
              />
            )}
            {filters.onlyOnSale && (
              <FilterChip
                label="En oferta"
                primaryColor={theme.primary}
                onRemove={() => setFilters({ ...filters, onlyOnSale: false })}
              />
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-1 text-xs font-medium underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: theme.mutedText }}
            >
              Limpiar todo
            </button>
          </div>
        )}

        {/* Main layout: sidebar + grid */}
        <div className="flex gap-6">
          {/* Desktop sidebar — sticky so filters stay visible while the
              product grid scrolls. `sticky` (not `fixed`) inside this same
              flex row means it naturally un-sticks once the row's own
              bottom is reached, so it can never overlap the footer. The
              top offset is a safe estimate for the header's height (both
              header style variants render as a single content row) —
              nudge `lg:top-24`/`lg:max-h-[calc(100vh-6rem)]` together if a
              particular store's header is taller than usual. */}
          <div className="hidden shrink-0 lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
            {/* Desktop search */}
            <form onSubmit={handleSearchSubmit} className="relative mb-4 w-56">
              <input
                ref={searchInputRef}
                type="search"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={isMenu ? 'Buscar en el menú…' : 'Buscar productos…'}
                className="h-10 w-full rounded-xl border pl-4 pr-10 text-sm outline-none"
                style={{
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceAlt,
                  color: theme.text,
                }}
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <Search className="h-4 w-4" style={{ color: theme.mutedText }} />
              </button>
            </form>

            <CatalogFilterSidebar
              theme={theme}
              filters={filters}
              onChange={setFilters}
              categories={categoryTree}
              subcategories={sidebarSubcategories}
              collections={nonEmptyCollections}
              facets={visibleFacets}
              priceRange={priceRange}
              currency={currency}
            />
          </div>

          {/* Product grid */}
          <div className="min-w-0 flex-1">
            {contentLoading ? (
              <div className="grid grid-cols-2 gap-4 animate-pulse sm:grid-cols-3 lg:gap-6 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl"
                    style={{ backgroundColor: theme.surfaceAlt }}
                  >
                    <div
                      className="aspect-square"
                      style={{ backgroundColor: theme.border }}
                    />
                    <div className="space-y-2 p-3">
                      <div className="h-3 rounded" style={{ backgroundColor: theme.border }} />
                      <div
                        className="h-3 w-2/3 rounded"
                        style={{ backgroundColor: theme.border }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredAndSorted.length === 0 ? (
              <div
                className="rounded-xl border border-dashed py-16 text-center"
                style={{ borderColor: theme.border }}
              >
                <p className="text-sm font-medium" style={{ color: theme.text }}>{emptyState.title}</p>
                <p className="mt-1 text-xs" style={{ color: theme.mutedText }}>{emptyState.subtitle}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6 xl:grid-cols-4">
                  {filteredAndSorted.map((item) => {
                    const product = item.product;
                    const isUnavailable = unavailableProductIds.has(product.productId) || item.isOutOfStock;
                    const categoryLabel = product.categoryParentId
                      ? `${categories.find((cat) => cat.id === product.categoryParentId)?.name ?? 'Categoría'} > ${product.categoryName}`
                      : product.categoryName;
                    return (
                      <StorefrontProductCard
                        key={item.id}
                        item={item}
                        theme={theme}
                        storeSlug={storeSlug}
                        currency={currency}
                        isMenu={isMenu}
                        isUnavailable={isUnavailable}
                        showCartButton={showCartButton}
                        productCardCtaLabel={productCardCtaLabel}
                        categoryLabel={categoryLabel}
                        size="large"
                        linkState={{ fromStorefront: true, fromPath: `${location.pathname}${location.search}${location.hash}` }}
                        onLinkClick={persistCurrentScrollPosition}
                        onAddToCart={handleAddProductToCart}
                      />
                    );
                  })}
                </div>

                {loadingMore && (
                  <div className="mt-6 grid grid-cols-2 gap-4 animate-pulse sm:grid-cols-3 lg:gap-6 xl:grid-cols-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={`loading-more-${i}`}
                        className="overflow-hidden rounded-xl"
                        style={{ backgroundColor: theme.surfaceAlt }}
                      >
                        <div className="aspect-square" style={{ backgroundColor: theme.border }} />
                        <div className="space-y-2 p-3">
                          <div className="h-3 rounded" style={{ backgroundColor: theme.border }} />
                          <div className="h-3 w-2/3 rounded" style={{ backgroundColor: theme.border }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {loadMoreError && (
                  <div className="mt-6 rounded-xl border border-dashed px-4 py-4 text-center" style={{ borderColor: theme.border }}>
                    <p className="text-sm" style={{ color: theme.mutedText }}>{loadMoreError}</p>
                    <button
                      type="button"
                      onClick={() => void loadNextProductsPage()}
                      className="mt-2 text-sm font-medium underline underline-offset-2"
                      style={{ color: theme.primary }}
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {hasMoreProducts && !loadMoreError && (
                  <div ref={loadMoreSentinelRef} className="h-10 w-full" aria-hidden="true" />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <CatalogFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        theme={theme}
        filters={filters}
        onChange={setFilters}
        categories={categoryTree}
        subcategories={sidebarSubcategories}
        collections={nonEmptyCollections}
        facets={visibleFacets}
        priceRange={priceRange}
        currency={currency}
        resultCount={hasAnyFilter || hasActiveSearch ? filteredAndSorted.length : totalProductCount}
      />

    </div>
  );
}
