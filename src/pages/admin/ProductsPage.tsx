import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, Archive, ArchiveRestore, CheckCircle, ChevronLeft, ChevronRight, Download, Eye, EyeOff,
  LayoutGrid, List, Package, Plus, Search, SlidersHorizontal, Star, StarOff, UtensilsCrossed, X,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StockAdjustmentModal } from '@/components/admin/StockAdjustmentModal';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { AdminPanelTabs } from '@/components/admin/AdminPanelTabs';
import { ProductListFiltersSheet } from '@/components/admin/products/ProductListFiltersSheet';
import { ProductDetailSheet } from '@/components/admin/products/ProductDetailSheet';
import { ProductListViews } from '@/components/admin/products/ProductListViews';
import type { ProductListView } from '@/components/admin/products/ProductListViews';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentStore, selectCurrentCommerceSettings, selectCurrentBusinessLimits } from '@/features/stores/stores.selectors';
import { isWhatsappInquiryMode } from '@/features/stores/whatsappInquiryMode';
import { categoriesService } from '@/features/categories/categoriesService';
import { collectionsService } from '@/features/collections/collectionsService';
import { facetsService } from '@/features/facets/facetsService';
import { productsService } from '@/features/products/productsService';
import { domainsService } from '@/features/domains/domainsService';
import {
  EMPTY_ADMIN_PRODUCT_FILTERS,
  LOW_STOCK_THRESHOLD,
  PRODUCT_ISSUE_LABELS,
  PRODUCT_SORT_OPTIONS,
  UNCATEGORIZED,
  adminProductFiltersFromParams,
  adminProductFiltersToParams,
  buildProductSearchIndex,
  countActiveRefinements,
  filterAdminProducts,
  getProductIssues,
  matchesStatusTab,
  mergeUpdatedProduct,
  sortAdminProducts,
} from '@/features/products/adminProductList';
import type { AdminProductFilters, AdminProductListContext, ProductSortKey, ProductStatusTab } from '@/features/products/adminProductList';
import { buildProductsCsv } from '@/features/products/productsCsv';
import { isFragranceStore } from '@/lib/storefront/fragrancePyramid';
import { notify } from '@/lib/notifications';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Product, ProductUpdate } from '@/features/products/products.types';
import type { StoreFacet } from '@/features/facets/facets.types';
import type { PublicStoreCategory, PublicStoreCollection } from '@/types/common.types';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 150;
const VIEW_STORAGE_KEY = 'melosoft_admin_products_view';

const STATUS_TABS: { key: ProductStatusTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'draft', label: 'Borradores' },
  { key: 'unavailable', label: 'No disponibles' },
  { key: 'archived', label: 'Archivados' },
];

type BulkAction = 'publish' | 'available' | 'unavailable' | 'feature' | 'unfeature' | 'archive' | 'restore';

function readStoredView(): ProductListView {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

function storeView(view: ProductListView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Preference only — the list works without storage.
  }
}

function downloadFile(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ProductsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentLimits = useAppSelector(selectCurrentBusinessLimits);
  const currentCommerceSettings = useAppSelector(selectCurrentCommerceSettings);
  const store = useAppSelector(selectCurrentStore);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [collections, setCollections] = useState<PublicStoreCollection[]>([]);
  const [facets, setFacets] = useState<StoreFacet[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ProductListView>(readStoredView);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmArchiveProduct, setConfirmArchiveProduct] = useState<Product | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);
  const [confirmBulkArchive, setConfirmBulkArchive] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState<BulkAction | null>(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<Product | null>(null);
  const [confirmPublishDrafts, setConfirmPublishDrafts] = useState(false);
  const [publishingDrafts, setPublishingDrafts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filters = useMemo(() => adminProductFiltersFromParams(searchParams), [searchParams]);
  const page = Math.max(1, Number(searchParams.get('p')) || 1);

  // Search box: instant typing, URL (and filtering) updated after a pause.
  const [searchDraft, setSearchDraft] = useState(filters.query);
  const [syncedQuery, setSyncedQuery] = useState(filters.query);
  if (filters.query !== syncedQuery) {
    setSyncedQuery(filters.query);
    setSearchDraft(filters.query);
  }

  const isMenu = currentCommerceSettings?.catalogType === 'menu';
  const inquiryMode = isWhatsappInquiryMode(currentLimits);
  const fragranceStore = isFragranceStore(store?.businessSubcategory);
  const entityLabel = isMenu ? 'platos' : 'productos';
  const newLabel = isMenu ? 'Nuevo plato' : 'Nuevo producto';
  const currency = store?.currency ?? 'COP';

  const nonArchived = products.filter((p) => p.status !== 'archived');
  const atLimit = currentLimits ? nonArchived.length >= currentLimits.maxProducts : false;

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    async function load(id: string) {
      try {
        const [productsData, categoriesData, collectionsData, facetsData] = await Promise.all([
          productsService.getProductsByStore(id),
          categoriesService.getStoreCategories(id),
          collectionsService.getStoreCollections(id).catch(() => []),
          facetsService.getStoreFacets(id).catch(() => []),
        ]);
        if (cancelled) return;
        setProducts(productsData);
        setCategories(categoriesData);
        setCollections(collectionsData);
        setFacets(facetsData.filter((facet) => facet.isActive && facet.values.some((value) => value.isActive)));
      } catch (err) {
        if (!cancelled) notify.fromError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load(storeId);
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  // ── Derived data (memoized: recomputed only when its inputs change) ──
  const categoryLabelById = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    return new Map(categories.map((category) => {
      const parent = category.parentId ? byId.get(category.parentId) : null;
      return [category.id, parent ? `${parent.name} › ${category.name}` : category.name];
    }));
  }, [categories]);

  const listContext = useMemo<AdminProductListContext>(() => ({
    categoryParentById: new Map(categories.map((category) => [category.id, category.parentId])),
    categoryNameById: new Map(categories.map((category) => [category.id, category.name])),
    facetIdByValueId: new Map(facets.flatMap((facet) => facet.values.map((value) => [value.id, facet.id] as const))),
    requirePrice: !inquiryMode,
  }), [categories, facets, inquiryMode]);

  const searchIndex = useMemo(() => buildProductSearchIndex(products, listContext), [products, listContext]);

  // Filtering runs on a deferred copy so typing and clicks stay instant
  // even on large catalogs.
  const deferredFilters = useDeferredValue(filters);
  const refined = useMemo(
    () => filterAdminProducts(products, deferredFilters, listContext, searchIndex),
    [products, deferredFilters, listContext, searchIndex],
  );
  const visible = useMemo(
    () => sortAdminProducts(refined.filter((product) => matchesStatusTab(product, deferredFilters.status)), deferredFilters.sort),
    [refined, deferredFilters.status, deferredFilters.sort],
  );

  const tabCounts = useMemo(() => {
    const counts = new Map<ProductStatusTab, number>();
    for (const tab of STATUS_TABS) counts.set(tab.key, refined.filter((product) => matchesStatusTab(product, tab.key)).length);
    return counts;
  }, [refined]);

  const optionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
    for (const product of products) {
      if (!matchesStatusTab(product, filters.status)) continue;
      if (product.categoryId) {
        bump(product.categoryId);
        const parent = listContext.categoryParentById.get(product.categoryId);
        if (parent) bump(parent);
      } else {
        bump(UNCATEGORIZED);
      }
      for (const collection of product.collections) bump(collection.id);
      for (const value of product.facetValues) bump(value.valueId);
      for (const issue of getProductIssues(product, { requirePrice: !inquiryMode })) bump(issue);
    }
    return counts;
  }, [products, filters.status, listContext, inquiryMode]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const refinementCount = countActiveRefinements(filters);
  const draftProducts = products.filter((p) => p.status === 'draft');

  const visibleIds = useMemo(() => new Set(visible.map((product) => product.id)), [visible]);
  const selectedVisible = useMemo(
    () => visible.filter((product) => selectedIds.has(product.id)),
    [visible, selectedIds],
  );
  const pageSelectedCount = pageItems.filter((product) => selectedIds.has(product.id)).length;
  const pageSelection = pageSelectedCount === 0 ? 'none' : pageSelectedCount === pageItems.length ? 'all' : 'some';

  // ── URL-backed filter updates ──
  const updateFilters = useCallback((next: AdminProductFilters, options: { keepPage?: boolean } = {}) => {
    const params = adminProductFiltersToParams(next);
    if (options.keepPage && page > 1) params.set('p', String(page));
    setSearchParams(params, { replace: true });
  }, [page, setSearchParams]);

  useEffect(() => {
    if (searchDraft === filters.query) return;
    const timer = window.setTimeout(() => updateFilters({ ...filters, query: searchDraft }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters, updateFilters]);

  function goToPage(next: number) {
    const params = adminProductFiltersToParams(filters);
    if (next > 1) params.set('p', String(next));
    setSearchParams(params, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // "/" focuses the search, as in most admin tools.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Mutations ──
  function applyUpdated(updated: Product[]) {
    const byId = new Map(updated.map((product) => [product.id, product]));
    setProducts((prev) => prev.map((product) => {
      const next = byId.get(product.id);
      return next ? mergeUpdatedProduct(product, next) : product;
    }));
  }

  async function runSingle(product: Product, action: () => Promise<Product>, message: string) {
    setActionLoading(product.id);
    try {
      applyUpdated([await action()]);
      notify.success(message);
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  const detailActions = {
    onPublish: (product: Product) => void runSingle(product, () => productsService.publishProduct(product.id), `"${product.name}" publicado.`),
    onToggleAvailability: (product: Product) => void runSingle(
      product,
      () => productsService.toggleAvailability(product.id, !product.isAvailable),
      product.isAvailable
        ? (isMenu ? `"${product.name}" marcado como agotado por el momento.` : `"${product.name}" marcado como no disponible.`)
        : `"${product.name}" marcado como disponible.`,
    ),
    onToggleFeatured: (product: Product) => void runSingle(
      product,
      () => productsService.updateProduct(product.id, { isFeatured: !product.isFeatured }),
      product.isFeatured ? `"${product.name}" ya no es destacado.` : `"${product.name}" ahora es destacado.`,
    ),
    onAdjustStock: (product: Product) => setAdjustingStockProduct(product),
    onArchive: (product: Product) => setConfirmArchiveProduct(product),
    onRestore: (product: Product) => void runSingle(
      product,
      () => productsService.updateProduct(product.id, { status: 'draft' }),
      `"${product.name}" restaurado como borrador.`,
    ),
    onDelete: (product: Product) => setConfirmDeleteProduct(product),
  };

  async function handleArchiveConfirmed(product: Product) {
    setConfirmArchiveProduct(null);
    await runSingle(product, () => productsService.archiveProduct(product.id), `"${product.name}" archivado.`);
  }

  async function handleDeleteConfirmed(product: Product) {
    setActionLoading(product.id);
    setConfirmDeleteProduct(null);
    try {
      await productsService.deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
      if (detailId === product.id) setDetailId(null);
      if (adjustingStockProduct?.id === product.id) setAdjustingStockProduct(null);
      notify.success(`"${product.name}" eliminado permanentemente.`);
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePublishAllDrafts() {
    setPublishingDrafts(true);
    try {
      const published = await productsService.publishProducts(draftProducts.map((p) => p.id));
      applyUpdated(published);
      notify.success(`${published.length} ${published.length === 1 ? 'producto publicado' : 'productos publicados'}.`);
    } catch (err) {
      notify.fromError(err, 'No se pudieron publicar los borradores.');
    } finally {
      setPublishingDrafts(false);
      setConfirmPublishDrafts(false);
    }
  }

  const bulkLabels: Record<BulkAction, string> = {
    publish: 'publicados',
    available: 'marcados como disponibles',
    unavailable: isMenu ? 'marcados como agotados' : 'marcados como no disponibles',
    feature: 'destacados',
    unfeature: 'quitados de destacados',
    archive: 'archivados',
    restore: 'restaurados como borrador',
  };

  async function runBulk(action: BulkAction) {
    const targets = selectedVisible;
    if (targets.length === 0) return;
    const ids = targets.map((product) => product.id);
    const payloads: Record<Exclude<BulkAction, 'publish'>, ProductUpdate> = {
      available: { isAvailable: true },
      unavailable: { isAvailable: false },
      feature: { isFeatured: true },
      unfeature: { isFeatured: false },
      archive: { status: 'archived' },
      restore: { status: 'draft' },
    };
    setBulkLoading(action);
    try {
      const updated = action === 'publish'
        ? await productsService.publishProducts(ids)
        : await productsService.updateProductsBulk(ids, payloads[action]);
      applyUpdated(updated);
      setSelectedIds(new Set());
      notify.success(`${updated.length} ${updated.length === 1 ? 'producto' : 'productos'} ${bulkLabels[action]}.`);
    } catch (err) {
      notify.fromError(err, 'No se pudo aplicar la acción a los productos seleccionados.');
    } finally {
      setBulkLoading(null);
      setConfirmBulkArchive(false);
    }
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageSelection === 'all') pageItems.forEach((product) => next.delete(product.id));
      else pageItems.forEach((product) => next.add(product.id));
      return next;
    });
  }

  const openDetail = useCallback((product: Product) => setDetailId(product.id), []);

  function exportCsv() {
    const csv = buildProductsCsv(visible, {
      categoryLabelById,
      publicBaseUrl: store?.slug ? domainsService.getStorePublicUrl(store.slug) : null,
    });
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `productos-${store?.slug ?? 'tienda'}-${date}.csv`, 'text/csv;charset=utf-8');
    notify.success(`${visible.length} ${entityLabel} exportados.`);
  }

  // ── Detail navigation over the current (filtered + sorted) list ──
  const detailProduct = detailId ? products.find((product) => product.id === detailId) ?? null : null;
  const detailIndex = detailId ? visible.findIndex((product) => product.id === detailId) : -1;
  const previousProduct = detailIndex > 0 ? visible[detailIndex - 1] : null;
  const nextProduct = detailIndex >= 0 && detailIndex < visible.length - 1 ? visible[detailIndex + 1] : null;

  // ── Active filter chips ──
  const facetValueLabel = new Map(facets.flatMap((facet) => facet.values.map((value) => [value.id, `${facet.name}: ${value.value}`] as const)));
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.categoryIds.map((id) => ({
      key: `cat-${id}`,
      label: id === UNCATEGORIZED ? 'Sin categoría' : categoryLabelById.get(id) ?? 'Categoría',
      remove: () => updateFilters({ ...filters, categoryIds: filters.categoryIds.filter((item) => item !== id) }),
    })),
    ...filters.facetValueIds.map((id) => ({
      key: `attr-${id}`,
      label: facetValueLabel.get(id) ?? 'Atributo',
      remove: () => updateFilters({ ...filters, facetValueIds: filters.facetValueIds.filter((item) => item !== id) }),
    })),
    ...filters.collectionIds.map((id) => ({
      key: `col-${id}`,
      label: `Colección: ${collections.find((collection) => collection.id === id)?.name ?? '—'}`,
      remove: () => updateFilters({ ...filters, collectionIds: filters.collectionIds.filter((item) => item !== id) }),
    })),
    ...filters.issues.map((issue) => ({
      key: `issue-${issue}`,
      label: PRODUCT_ISSUE_LABELS[issue],
      remove: () => updateFilters({ ...filters, issues: filters.issues.filter((item) => item !== issue) }),
    })),
    ...(filters.stock ? [{
      key: 'stock',
      label: {
        in_stock: 'Con stock',
        low_stock: `Stock bajo (≤ ${LOW_STOCK_THRESHOLD})`,
        out_of_stock: 'Agotados',
        untracked: 'Sin control de inventario',
      }[filters.stock],
      remove: () => updateFilters({ ...filters, stock: '' }),
    }] : []),
    ...(filters.image ? [{
      key: 'image',
      label: filters.image === 'with' ? 'Con imagen' : 'Sin imagen',
      remove: () => updateFilters({ ...filters, image: '' }),
    }] : []),
    ...(filters.priceMin !== null ? [{
      key: 'pmin',
      label: `Desde ${formatCurrency(filters.priceMin, 'es-CO', currency)}`,
      remove: () => updateFilters({ ...filters, priceMin: null }),
    }] : []),
    ...(filters.priceMax !== null ? [{
      key: 'pmax',
      label: `Hasta ${formatCurrency(filters.priceMax, 'es-CO', currency)}`,
      remove: () => updateFilters({ ...filters, priceMax: null }),
    }] : []),
    ...(filters.featured ? [{ key: 'dest', label: 'Destacados', remove: () => updateFilters({ ...filters, featured: false }) }] : []),
    ...(filters.onSale ? [{ key: 'oferta', label: 'Con descuento', remove: () => updateFilters({ ...filters, onSale: false }) }] : []),
    ...(filters.withVariants ? [{ key: 'var', label: 'Con variantes', remove: () => updateFilters({ ...filters, withVariants: false }) }] : []),
  ];

  const emptyIcon = isMenu ? <UtensilsCrossed className="h-5 w-5" /> : <Package className="h-5 w-5" />;
  const anyNarrowing = refinementCount > 0 || Boolean(filters.query.trim()) || filters.status !== 'all';
  const firstShown = visible.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * PAGE_SIZE, visible.length);

  const bulkButtons: { action: BulkAction; label: string; icon: React.ReactNode; show: boolean }[] = [
    { action: 'publish', label: 'Publicar', icon: <CheckCircle className="h-3.5 w-3.5" />, show: selectedVisible.some((p) => p.status === 'draft') },
    { action: 'available', label: 'Disponible', icon: <Eye className="h-3.5 w-3.5" />, show: selectedVisible.some((p) => p.status === 'active' && !p.isAvailable) },
    { action: 'unavailable', label: isMenu ? 'Agotado' : 'No disponible', icon: <EyeOff className="h-3.5 w-3.5" />, show: selectedVisible.some((p) => p.status === 'active' && p.isAvailable) },
    { action: 'feature', label: 'Destacar', icon: <Star className="h-3.5 w-3.5" />, show: selectedVisible.some((p) => !p.isFeatured) },
    { action: 'unfeature', label: 'Quitar destacado', icon: <StarOff className="h-3.5 w-3.5" />, show: selectedVisible.some((p) => p.isFeatured) },
    { action: 'restore', label: 'Restaurar', icon: <ArchiveRestore className="h-3.5 w-3.5" />, show: selectedVisible.some((p) => p.status === 'archived') },
  ];

  return (
    <div className="pb-24">
      {/* Top actions */}
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {atLimit && currentLimits && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-600">
            Límite del plan ({currentLimits.maxProducts})
          </span>
        )}
        <Button variant="outline" onClick={exportCsv} disabled={loading || visible.length === 0} leftIcon={<Download className="h-4 w-4" />}>
          Exportar
        </Button>
        <Link to={`/admin/stores/${storeId}/products/new`}>
          <Button leftIcon={<Plus className="h-4 w-4" />} disabled={atLimit}>{newLabel}</Button>
        </Link>
      </div>

      {draftProducts.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            Tienes <strong>{draftProducts.length}</strong> {entityLabel} en borrador que no se ven en la tienda.
          </p>
          <Button size="sm" onClick={() => setConfirmPublishDrafts(true)} leftIcon={<CheckCircle className="h-3.5 w-3.5" />}>
            Publicar todos los borradores
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex h-10 w-full min-w-0 shrink-0 items-center rounded-xl sm:w-auto sm:flex-1 border border-gray-300 bg-white focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && searchDraft) {
                event.preventDefault();
                setSearchDraft('');
              }
            }}
            placeholder={`Buscar por nombre, SKU, marca, categoría…`}
            aria-label={`Buscar ${entityLabel}`}
            className="h-full w-full min-w-0 rounded-xl bg-transparent pl-9 pr-16 text-sm text-gray-900 outline-none placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchDraft ? (
            <button type="button" onClick={() => setSearchDraft('')} aria-label="Borrar búsqueda" className="absolute right-2.5 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 hidden rounded border border-gray-200 bg-gray-50 px-1.5 text-[11px] font-medium text-gray-400 sm:block">/</kbd>
          )}
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={`flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors ${
              refinementCount > 0 ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {refinementCount > 0 && (
              <span className="rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">{refinementCount}</span>
            )}
          </button>

          <select
            value={filters.sort}
            onChange={(event) => updateFilters({ ...filters, sort: event.target.value as ProductSortKey }, { keepPage: false })}
            aria-label="Ordenar"
            className="h-10 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-sm sm:flex-none text-gray-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {PRODUCT_SORT_OPTIONS
              .filter((option) => !(inquiryMode && (option.value === 'price_asc' || option.value === 'price_desc')))
              .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>

          <div className="flex h-10 shrink-0 items-center rounded-xl border border-gray-300 bg-white p-0.5" role="group" aria-label="Vista">
            {([['list', List, 'Lista'], ['grid', LayoutGrid, 'Cuadrícula']] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setView(key);
                  storeView(key);
                }}
                aria-pressed={view === key}
                aria-label={label}
                title={label}
                className={`flex h-full w-9 items-center justify-center rounded-lg transition-colors ${view === key ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status tabs (counts reflect search + filters) */}
      <AdminPanelTabs
        items={STATUS_TABS.map(({ key, label }) => {
          const count = tabCounts.get(key) ?? 0;
          return {
            key,
            label,
            active: filters.status === key,
            onClick: () => updateFilters({ ...filters, status: key }),
            badge: (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${filters.status === key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            ),
          };
        })}
      />

      {/* Active refinements */}
      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 py-1 pl-2.5 pr-1 text-xs font-medium text-indigo-700">
              {chip.label}
              <button type="button" onClick={chip.remove} aria-label={`Quitar ${chip.label}`} className="rounded-full p-0.5 hover:bg-indigo-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => updateFilters({ ...EMPTY_ADMIN_PRODUCT_FILTERS, query: filters.query, status: filters.status, sort: filters.sort })}
            className="ml-1 text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-800"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {loading ? (
        <PanelLoadingState label={`Cargando ${entityLabel}…`} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={`Sin ${entityLabel}`}
          description={`Agrega el primer ${isMenu ? 'plato' : 'producto'} al catálogo.`}
          action={!atLimit ? (
            <Link to={`/admin/stores/${storeId}/products/new`}>
              <Button leftIcon={<Plus className="h-4 w-4" />}>{newLabel}</Button>
            </Link>
          ) : undefined}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title="Sin resultados"
          description={anyNarrowing ? 'Ningún producto coincide con la búsqueda y los filtros actuales.' : `No hay ${entityLabel} en esta vista.`}
          action={anyNarrowing ? (
            <Button variant="outline" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}>
              Quitar búsqueda y filtros
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>
              Mostrando <strong className="text-gray-700">{firstShown}–{lastShown}</strong> de{' '}
              <strong className="text-gray-700">{visible.length}</strong> {entityLabel}
            </span>
            {view === 'grid' && (
              <button type="button" onClick={toggleSelectPage} className="font-medium text-indigo-600 hover:text-indigo-700">
                {pageSelection === 'all' ? 'Quitar selección de la página' : 'Seleccionar la página'}
              </button>
            )}
          </div>

          <ProductListViews
            view={view}
            products={pageItems}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectPage={toggleSelectPage}
            pageSelection={pageSelection}
            onOpen={openDetail}
            categoryLabelById={categoryLabelById}
            currency={currency}
            isMenu={isMenu}
            inquiryMode={inquiryMode}
            storeId={storeId ?? ''}
          />

          {pageCount > 1 && (
            <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Paginación">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)} leftIcon={<ChevronLeft className="h-4 w-4" />}>
                Anterior
              </Button>
              <span className="text-sm text-gray-600">
                Página <strong>{currentPage}</strong> de {pageCount}
              </span>
              <Button variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => goToPage(currentPage + 1)}>
                <span className="inline-flex items-center gap-1">Siguiente <ChevronRight className="h-4 w-4" /></span>
              </Button>
            </nav>
          )}
        </>
      )}

      {currentLimits && !loading && (
        <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
          {nonArchived.length >= currentLimits.maxProducts
            ? <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            : <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
          {nonArchived.length} de {currentLimits.maxProducts} {entityLabel} usados en el plan {currentLimits.planKey.toUpperCase()}
        </div>
      )}

      {/* Bulk actions */}
      {selectedVisible.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="region" aria-label="Acciones sobre la selección">
          <div className="flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur [&>*]:shrink-0">
            <span className="whitespace-nowrap px-1 text-sm font-semibold text-gray-900">
              {selectedVisible.length} {selectedVisible.length === 1 ? 'seleccionado' : 'seleccionados'}
            </span>
            {selectedVisible.length < visible.length && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set(visibleIds))}
                className="whitespace-nowrap text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Seleccionar los {visible.length}
              </button>
            )}
            <span className="hidden h-5 w-px bg-gray-200 sm:block" aria-hidden="true" />
            {bulkButtons.filter((button) => button.show).map((button) => (
              <Button
                key={button.action}
                size="sm"
                variant="outline"
                isLoading={bulkLoading === button.action}
                disabled={bulkLoading !== null}
                onClick={() => void runBulk(button.action)}
                leftIcon={button.icon}
                className="whitespace-nowrap"
              >
                {button.label}
              </Button>
            ))}
            {selectedVisible.some((p) => p.status !== 'archived') && (
              <Button
                size="sm"
                variant="ghost"
                disabled={bulkLoading !== null}
                onClick={() => setConfirmBulkArchive(true)}
                leftIcon={<Archive className="h-3.5 w-3.5" />}
                className="whitespace-nowrap"
              >
                Archivar
              </Button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Quitar selección"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <ProductListFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={(next) => updateFilters(next)}
        categories={categories}
        collections={collections}
        facets={facets}
        optionCounts={optionCounts}
        resultCount={visible.length}
        inquiryMode={inquiryMode}
      />

      <ProductDetailSheet
        product={detailProduct}
        open={detailProduct !== null}
        onClose={() => setDetailId(null)}
        position={detailIndex >= 0 ? { index: detailIndex, total: visible.length } : null}
        onPrevious={previousProduct ? () => setDetailId(previousProduct.id) : undefined}
        onNext={nextProduct ? () => setDetailId(nextProduct.id) : undefined}
        storeSlug={store?.slug ?? null}
        currency={currency}
        isMenu={isMenu}
        inquiryMode={inquiryMode}
        fragranceStore={fragranceStore}
        categories={categories}
        busy={detailProduct !== null && actionLoading === detailProduct.id}
        actions={detailActions}
      />

      <ConfirmDialog
        open={confirmPublishDrafts}
        title="Publicar borradores"
        message={`Se publicarán ${draftProducts.length} ${entityLabel} y quedarán visibles en la tienda pública. Revisa que tengan nombre, imagen y precio correctos (salvo en catálogo con consulta por WhatsApp, donde el precio no se muestra).`}
        confirmLabel="Publicar todos"
        variant="warning"
        isLoading={publishingDrafts}
        onConfirm={() => void handlePublishAllDrafts()}
        onCancel={() => setConfirmPublishDrafts(false)}
      />

      <ConfirmDialog
        open={confirmBulkArchive}
        title="Archivar productos"
        message={`¿Archivar ${selectedVisible.length} ${selectedVisible.length === 1 ? 'producto' : 'productos'}? Dejarán de verse en la tienda. Puedes restaurarlos desde la pestaña Archivados.`}
        confirmLabel="Archivar"
        variant="warning"
        isLoading={bulkLoading === 'archive'}
        onConfirm={() => void runBulk('archive')}
        onCancel={() => setConfirmBulkArchive(false)}
      />

      <ConfirmDialog
        open={confirmArchiveProduct !== null}
        title="Archivar producto"
        message={`¿Archivar "${confirmArchiveProduct?.name}"? El producto dejará de ser visible. Puedes restaurarlo más adelante.`}
        confirmLabel="Archivar"
        variant="warning"
        onConfirm={() => {
          if (confirmArchiveProduct) void handleArchiveConfirmed(confirmArchiveProduct);
        }}
        onCancel={() => setConfirmArchiveProduct(null)}
      />

      <ConfirmDialog
        open={confirmDeleteProduct !== null}
        title="Eliminar producto"
        message={`¿Eliminar "${confirmDeleteProduct?.name}" por completo? Esta acción borra el producto, sus imágenes, ofertas asociadas y checkouts pendientes sin pedido. No se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteProduct) void handleDeleteConfirmed(confirmDeleteProduct);
        }}
        onCancel={() => setConfirmDeleteProduct(null)}
      />

      {adjustingStockProduct && storeId && (
        <StockAdjustmentModal
          open={adjustingStockProduct !== null}
          storeId={storeId}
          productId={adjustingStockProduct.id}
          productName={adjustingStockProduct.name}
          currentStock={adjustingStockProduct.stock}
          onClose={() => setAdjustingStockProduct(null)}
          onStockUpdated={(productId, newStock) =>
            setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p)))}
          restaurantMode={isMenu}
        />
      )}
    </div>
  );
}
