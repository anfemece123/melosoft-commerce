import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
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
import { getContextualFacets, pruneEmptyCategoryTree, pruneEmptyCollections } from '@/lib/storefront/catalogVisibility';
import type { PublicProductPage, PublicStoreCategory, PublicStoreCollection, PublicStoreFacet } from '@/types/common.types';
import { formatCurrency } from '@/utils/formatCurrency';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { StorefrontActionButton } from '@/components/public/storefront/StorefrontActionButton';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';
import { StorefrontRatingStars } from '@/components/public/storefront/StorefrontRatingStars';
import { StorefrontPageLoader } from '@/components/public/storefront/StorefrontPageLoader';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { usePublicRouteReady } from '@/components/layout/PublicRouteReadyContext';
import { useCart, isOutOfStock } from '@/lib/cart/cartContext';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { notify } from '@/lib/notifications';
import {
  hasActiveDiscount,
  getActivePrice,
  calculateDiscountPercentage,
} from '@/lib/pricing/pricing.utils';
import {
  getCatalogLabel,
  getProductCardCtaLabel,
  canUseWebOrders,
  type PublicCommerceConfig,
} from '@/lib/commerce/commerceConfig.utils';
import { writePublicScrollPosition } from '@/lib/storefront/publicScrollRestoration';

// ── Root component ─────────────────────────────────────────────

export function StoreCatalogPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
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
  const [error, setError] = useState<string | null>(null);
  const [unavailableProductIds, setUnavailableProductIds] = useState<Set<string>>(new Set());

  // Sync local search box when URL query changes externally
  useEffect(() => {
    setLocalSearch(filters.query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('q')]);

  useEffect(() => {
    let cancelled = false;
    setContentLoading(true);
    setError(null);

    productsService.getPublicProductsByStoreSlug(storeSlug)
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando productos');
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false);
      });

    return () => { cancelled = true; };
  }, [storeSlug]);

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
  // Full (unpruned) root tree — the source of truth for resolving the
  // currently selected category/subcategory from the URL, so that deep
  // linking into a category with zero current products still filters
  // correctly to an empty result instead of silently showing everything.
  const fullCategoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // When a collection is selected, narrow category options to only those
  // with products in that collection (keeps the "Categoría" filter relevant
  // to what's actually being browsed).
  const collectionScopedProducts = useMemo(() => {
    if (!filters.collectionSlug) return products;
    return products.filter((p) => p.collections.some((c) => c.slug === filters.collectionSlug));
  }, [products, filters.collectionSlug]);

  // Root-only tree, pruned of categories/subcategories with zero products —
  // used only for the *selectable* "Categoría"/"Subcategoría" filter options
  // (the flat `categories` state still holds every level, used elsewhere to
  // resolve a slug to its display name).
  const categoryTree = useMemo(
    () => pruneEmptyCategoryTree(fullCategoryTree, collectionScopedProducts),
    [fullCategoryTree, collectionScopedProducts]
  );

  const nonEmptyCollections = useMemo(
    () => pruneEmptyCollections(collections, products),
    [collections, products]
  );

  const priceRange = useMemo(() => {
    let minPrice = Infinity;
    let maxPrice = 0;
    for (const p of products) {
      const price = getActivePrice(p.regularPrice, p.salePrice);
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
    }
    return { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice };
  }, [products]);

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
    const prunedParent = categoryTree.find((c) => c.slug === filters.categorySlug);
    return prunedParent?.children ?? [];
  }, [categoryTree, filters.categorySlug]);

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
  const visibleFacets = useMemo(
    () => getContextualFacets(facets, activeCategoryNode, productsInFilterScope),
    [facets, activeCategoryNode, productsInFilterScope]
  );

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

    if (filters.facets.length > 0) {
      list = list.filter((p) =>
        filters.facets.every((ff) =>
          p.facetValues.some(
            (fv) => fv.facetSlug === ff.facetSlug && fv.valueSlug === ff.valueSlug
          )
        )
      );
    }

    if (filters.priceMin !== null) {
      list = list.filter(
        (p) => getActivePrice(p.regularPrice, p.salePrice) >= (filters.priceMin as number)
      );
    }
    if (filters.priceMax !== null) {
      list = list.filter(
        (p) => getActivePrice(p.regularPrice, p.salePrice) <= (filters.priceMax as number)
      );
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

    switch (sort) {
      case 'price_asc':
        list.sort(
          (a, b) =>
            getActivePrice(a.regularPrice, a.salePrice) -
            getActivePrice(b.regularPrice, b.salePrice)
        );
        break;
      case 'price_desc':
        list.sort(
          (a, b) =>
            getActivePrice(b.regularPrice, b.salePrice) -
            getActivePrice(a.regularPrice, a.salePrice)
        );
        break;
      case 'name_asc':
        list.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case 'featured':
        list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
    }

    return list;
  }, [products, filters, selectedCategoryNode, sort]);

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
      imageUrl: product.mainImageUrl,
      unitPrice: getActivePrice(product.regularPrice, product.salePrice),
      customizationNotes: null,
      stock: product.stock,
      trackInventory: product.trackInventory,
      isAvailable: product.isAvailable,
    });
    if (!added) {
      notify.warning(`"${product.productName}" no tiene stock disponible.`);
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
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {/* Breadcrumbs */}
        <StorefrontBreadcrumbs
          theme={theme}
          className="mb-4"
          items={[
            { label: 'Inicio', href: `/s/${storeSlug}` },
            ...(filters.categorySlug && selectedCategoryNode
              ? [
                  { label: catalogLabel, href: `/s/${storeSlug}/catalog` },
                  selectedSubcategoryNode
                    ? { label: selectedCategoryNode.name, href: `/s/${storeSlug}/catalog?cat=${encodeURIComponent(selectedCategoryNode.slug)}` }
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
                    · {filteredAndSorted.length} resultado{filteredAndSorted.length !== 1 ? 's' : ''}
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
              const facet = facets.find((f) => f.slug === ff.facetSlug);
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
          {/* Desktop sidebar */}
          <div className="hidden lg:block">
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
              <div className="grid grid-cols-2 gap-4 animate-pulse md:grid-cols-3">
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
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {filteredAndSorted.map((product) => {
                  const outOfStock = isOutOfStock(product);
                  const isUnavailable = unavailableProductIds.has(product.productId) || outOfStock;
                  return (
                    <Link
                      key={product.productId}
                      to={`/s/${storeSlug}/p/${product.productSlug}`}
                      state={{
                        fromStorefront: true,
                        fromPath: `${location.pathname}${location.search}${location.hash}`,
                      }}
                      onClick={persistCurrentScrollPosition}
                      className={`flex h-full flex-col overflow-hidden transition-opacity hover:opacity-95 ${isUnavailable ? 'opacity-60' : ''}`}
                    >
                      <div className="relative">
                        <StorefrontMediaFrame
                          src={product.mainImageUrl}
                          alt={product.productName}
                          aspectClassName="aspect-square"
                          fallback={
                            <div className="flex h-full w-full items-center justify-center">
                              {isMenu
                                ? <UtensilsCrossed className="w-8 h-8 text-gray-300" />
                                : <Package className="w-8 h-8 text-gray-300" />}
                            </div>
                          }
                        />
                        {isUnavailable && (
                          <div className="absolute inset-0 flex items-end pb-2 px-2">
                            <span className="text-xs font-medium bg-black/60 text-white rounded-full px-2 py-0.5">
                              No disponible
                            </span>
                          </div>
                        )}
                        {!isUnavailable &&
                          hasActiveDiscount(product.regularPrice, product.salePrice) && (
                            <div className="absolute left-3 top-3">
                              <DiscountBadge
                                percentage={calculateDiscountPercentage(
                                  product.regularPrice,
                                  product.salePrice!
                                )}
                                size="md"
                                className="px-3 py-1.5 text-sm shadow-lg"
                              />
                            </div>
                          )}
                      </div>

                      <div className="flex flex-1 flex-col p-3">
                        <div className="min-h-4">
                          {product.categoryName && (
                            <span
                              className="text-xs font-medium"
                              style={{ color: theme.primary }}
                            >
                              {product.categoryParentId
                                ? `${categories.find((item) => item.id === product.categoryParentId)?.name ?? 'Categoría'} > ${product.categoryName}`
                                : product.categoryName}
                            </span>
                          )}
                        </div>
                        <p
                          className="mt-0.5 min-h-[2.5rem] line-clamp-2 text-sm font-semibold leading-5"
                          style={{ color: theme.text }}
                        >
                          {product.productName}
                        </p>
                        <div className="min-h-[1rem] -mt-0.5">
                          <StorefrontRatingStars
                            theme={theme}
                            rating={5}
                            count={product.isFeatured ? 24 : 12}
                          />
                        </div>
                        <div className="mt-1.5 min-h-[2rem]">
                          {hasActiveDiscount(product.regularPrice, product.salePrice) ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="text-base font-bold"
                                style={{ color: theme.text }}
                              >
                                {formatCurrency(
                                  getActivePrice(product.regularPrice, product.salePrice),
                                  'es-CO',
                                  currency
                                )}
                              </span>
                              <span
                                className="text-xs line-through"
                                style={{ color: theme.mutedText }}
                              >
                                {formatCurrency(product.regularPrice, 'es-CO', currency)}
                              </span>
                            </div>
                          ) : (
                            <span
                              className="text-base font-bold"
                              style={{ color: theme.text }}
                            >
                              {formatCurrency(product.regularPrice, 'es-CO', currency)}
                            </span>
                          )}
                        </div>

                        {isUnavailable ? (
                          <div
                            className="mt-3 flex h-10 items-center justify-center rounded-lg border text-xs font-medium"
                            style={{ borderColor: theme.border, color: theme.mutedText }}
                          >
                            {outOfStock ? 'Sin stock disponible' : 'No disponible en esta sede'}
                          </div>
                        ) : showCartButton ? (
                          <StorefrontActionButton
                            as="button"
                            type="button"
                            theme={theme}
                            variant="outline"
                            fullWidth
                            className="mt-3 h-10 text-sm font-semibold"
                            onClick={(event) => handleAddProductToCart(event, product)}
                          >
                            {productCardCtaLabel}
                          </StorefrontActionButton>
                        ) : (
                          <StorefrontActionButton
                            as="div"
                            theme={theme}
                            variant="outline"
                            fullWidth
                            className="mt-3 h-10 text-sm font-semibold"
                          >
                            {productCardCtaLabel}
                          </StorefrontActionButton>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
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
        resultCount={filteredAndSorted.length}
      />

    </div>
  );
}
