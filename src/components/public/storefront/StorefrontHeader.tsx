import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Menu, Search, ShoppingCart, X } from 'lucide-react';
import { PublicStoreLogo } from './PublicStoreLogo';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MegaMenuPanel } from './MegaMenuPanel';
import { StoreStatusBadge } from './StoreStatusBadge';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from './storefrontTheme';
import type { LocationOrderStatus } from '@/features/locations/locations.types';
import type { CatalogMeta, CatalogType, PublicHeaderSettings, PublicStoreCategory } from '@/types/common.types';
import { DEFAULT_HEADER_SETTINGS } from '@/types/common.types';
import {
  resolveHeaderSettings,
  LOGO_SIZE_MAP,
  MENU_TEXT_SIZE_MAP,
  MAX_VISIBLE_HEADER_ITEMS,
} from '@/lib/storefront/headerSettings';
import {
  buildHeaderNavigationItems,
  type ResolvedHeaderNavigationItem,
} from '@/lib/storefront/headerNavigation';
import { getContextualFacets } from '@/lib/storefront/catalogVisibility';
import { buildFacetConcepts } from '@/lib/storefront/variantFilters';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

function withOpacity(color: string, alpha: number) {
  if (!color.startsWith('#')) return color;
  const hex = color.slice(1);
  const normalized =
    hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex.slice(0, 6);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getSearchPlaceholder(catalogType: CatalogType | null): string {
  if (catalogType === 'menu') return 'Buscar en el menú…';
  if (catalogType === 'services' || catalogType === 'mixed') return 'Buscar en el catálogo…';
  return 'Buscar productos…';
}

function getCatalogPageLabel(catalogType: CatalogType | null): string {
  if (catalogType === 'menu') return 'Menú';
  if (catalogType === 'services' || catalogType === 'mixed') return 'Catálogo';
  return 'Productos';
}

function getViewAllLabel(catalogType: CatalogType | null): string {
  if (catalogType === 'menu') return 'Menú completo';
  if (catalogType === 'services' || catalogType === 'mixed') return 'Catálogo completo';
  return 'Todos los productos';
}

interface StorefrontHeaderProps {
  theme: StorefrontTheme;
  storeName: string;
  storeSlug: string;
  logoUrl: string | null;
  catalogType: CatalogType | null;
  hasHero?: boolean;
  showCart?: boolean;
  cartCount?: number;
  onCartOpen?: () => void;
  onRequestCloseCart?: () => void;
  headerSettings?: PublicHeaderSettings | null;
  categories?: PublicStoreCategory[];
  catalogMeta?: CatalogMeta | null;
  orderStatus?: LocationOrderStatus | null;
  scheduleLoading?: boolean;
}

export function StorefrontHeader({
  theme,
  storeName,
  storeSlug,
  logoUrl,
  catalogType,
  hasHero = true,
  showCart = false,
  cartCount = 0,
  onCartOpen,
  onRequestCloseCart,
  headerSettings,
  categories = [],
  catalogMeta,
  orderStatus = null,
  scheduleLoading = false,
}: StorefrontHeaderProps & { categories?: PublicStoreCategory[] }) {
  const settings = resolveHeaderSettings(headerSettings ?? DEFAULT_HEADER_SETTINGS);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [megaMenuItemId, setMegaMenuItemId] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const megaMenuOpenTimerRef = useRef<number | null>(null);
  const megaMenuCloseTimerRef = useRef<number | null>(null);

  const transparent = hasHero && settings.transparentOnHero;
  const shouldBeTransparent = transparent && !isScrolled;
  const blurred = transparent && isScrolled;

  const controlBg = withOpacity(theme.background, theme.mode === 'dark' ? 0.72 : 0.92);
  const controlBorder = withOpacity(theme.text, theme.mode === 'dark' ? 0.12 : 0.08);
  const navTextColor = theme.mode === 'dark' ? 'rgba(226,232,240,0.78)' : '#6b7280';
  const logoSizeClass = LOGO_SIZE_MAP[settings.logoSize];
  const menuTextClass = MENU_TEXT_SIZE_MAP[settings.menuTextSize];
  const searchPlaceholder = getSearchPlaceholder(catalogType);
  const catalogLabel = getCatalogPageLabel(catalogType);
  const viewAllLabel = getViewAllLabel(catalogType);

  const menuCategoryTree = useMemo(
    () => (catalogMeta?.categoryTree ?? categories)
      .filter((category) => category.showInMenu)
      .map((category) => ({
        ...category,
        children: (category.children ?? []).filter((child) => child.showInMenu),
      })),
    [catalogMeta?.categoryTree, categories],
  );
  const navigationCategoryTree = settings.menuMode === 'categories'
    ? menuCategoryTree
    : catalogMeta?.categoryTree ?? categories;

  const menuCollections = useMemo(
    () => (catalogMeta?.collections ?? []).filter((collection) => collection.showInMenu),
    [catalogMeta?.collections],
  );

  const navigationItems = buildHeaderNavigationItems({
    settings,
    storeSlug,
    catalogLabel,
    viewAllLabel,
    categoryTree: navigationCategoryTree,
    collections: catalogMeta?.collections ?? [],
    facets: catalogMeta?.facets ?? [],
  });
  const visibleNavigationItems = navigationItems.slice(0, MAX_VISIBLE_HEADER_ITEMS);
  const overflowNavigationItems = navigationItems.slice(MAX_VISIBLE_HEADER_ITEMS);
  const hasOverflow = overflowNavigationItems.length > 0;

  const activeMegaMenuItem = megaMenuItemId
    ? navigationItems.find((item) => item.id === megaMenuItemId) ?? null
    : null;
  const activeCategoryNode = activeMegaMenuItem?.rootCategorySlug
    ? navigationCategoryTree.find((category) => category.slug === activeMegaMenuItem.rootCategorySlug) ?? null
    : null;
  const megaSubcategories = activeCategoryNode?.children ?? [];

  const activeCategoryScopedProducts = useMemo(() => {
    if (!activeCategoryNode) return [];
    return (catalogMeta?.products ?? []).filter(
      (product) =>
        product.categorySlug === activeCategoryNode.slug ||
        product.categoryParentId === activeCategoryNode.id
    );
  }, [catalogMeta?.products, activeCategoryNode]);

  const megaMenuFacets = useMemo(
    () =>
      getContextualFacets(
        catalogMeta?.megaMenuFacets ?? [],
        activeCategoryNode,
        activeCategoryScopedProducts,
        buildFacetConcepts(catalogMeta?.megaMenuFacets ?? [])
      ),
    [catalogMeta?.megaMenuFacets, activeCategoryNode, activeCategoryScopedProducts]
  );

  const showMegaMenu = activeMegaMenuItem?.type === 'catalog'
    ? menuCategoryTree.length > 0 || menuCollections.length > 0
    : Boolean(activeCategoryNode && (
      megaSubcategories.length > 0 || megaMenuFacets.some((facet) => facet.values.length > 0)
    ));

  function clearMegaMenuTimers() {
    if (megaMenuOpenTimerRef.current !== null) {
      window.clearTimeout(megaMenuOpenTimerRef.current);
      megaMenuOpenTimerRef.current = null;
    }
    if (megaMenuCloseTimerRef.current !== null) {
      window.clearTimeout(megaMenuCloseTimerRef.current);
      megaMenuCloseTimerRef.current = null;
    }
  }

  function itemHasMegaMenu(item: ResolvedHeaderNavigationItem): boolean {
    if (item.type === 'catalog') return menuCategoryTree.length > 0 || menuCollections.length > 0;
    if (!item.rootCategorySlug) return false;
    const category = navigationCategoryTree.find((candidate) => candidate.slug === item.rootCategorySlug);
    if ((category?.children?.length ?? 0) > 0) return true;
    return (catalogMeta?.megaMenuFacets ?? []).some((facet) => {
      if (facet.values.length === 0) return false;
      if (facet.appliesToAllCategories) return true;
      return facet.applicableCategories.some((assignment) => assignment.categoryId === category?.id);
    });
  }

  function openMegaMenu(item: ResolvedHeaderNavigationItem, immediate = false) {
    clearMegaMenuTimers();
    if (!itemHasMegaMenu(item)) {
      setMegaMenuItemId(null);
      return;
    }
    if (immediate) {
      setMegaMenuItemId(item.id);
      return;
    }
    megaMenuOpenTimerRef.current = window.setTimeout(() => {
      setMegaMenuItemId(item.id);
      megaMenuOpenTimerRef.current = null;
    }, 90);
  }

  function keepMegaMenuOpen() {
    if (megaMenuCloseTimerRef.current !== null) {
      window.clearTimeout(megaMenuCloseTimerRef.current);
      megaMenuCloseTimerRef.current = null;
    }
  }

  function scheduleMegaMenuClose() {
    if (megaMenuOpenTimerRef.current !== null) {
      window.clearTimeout(megaMenuOpenTimerRef.current);
      megaMenuOpenTimerRef.current = null;
    }
    if (megaMenuCloseTimerRef.current !== null) window.clearTimeout(megaMenuCloseTimerRef.current);
    megaMenuCloseTimerRef.current = window.setTimeout(() => {
      setMegaMenuItemId(null);
      megaMenuCloseTimerRef.current = null;
    }, 180);
  }

  function closeMegaMenuImmediately() {
    clearMegaMenuTimers();
    setMegaMenuItemId(null);
  }

  function closeMenus() {
    clearMegaMenuTimers();
    setMobileNavOpen(false);
    setMegaMenuItemId(null);
    setMoreMenuOpen(false);
  }

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 12);
      if (window.scrollY > 12) {
        setMobileNavOpen(false);
        setMoreMenuOpen(false);
        setMegaMenuItemId(null);
      }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (megaMenuOpenTimerRef.current !== null) window.clearTimeout(megaMenuOpenTimerRef.current);
      if (megaMenuCloseTimerRef.current !== null) window.clearTimeout(megaMenuCloseTimerRef.current);
      megaMenuOpenTimerRef.current = null;
      megaMenuCloseTimerRef.current = null;
      setMegaMenuItemId(null);
      setMoreMenuOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (megaMenuOpenTimerRef.current !== null) window.clearTimeout(megaMenuOpenTimerRef.current);
      if (megaMenuCloseTimerRef.current !== null) window.clearTimeout(megaMenuCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!moreMenuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [moreMenuOpen]);

  const positionClass = transparent
    ? 'fixed inset-x-0 top-0 z-50 transition-colors duration-300'
    : settings.isSticky
    ? 'sticky top-0 z-50 transition-colors duration-300'
    : 'relative z-40';

  const headerStyle: React.CSSProperties = {
    backgroundColor: shouldBeTransparent ? 'transparent' : theme.background,
    borderBottom: shouldBeTransparent ? '1px solid transparent' : `1px solid ${theme.border}`,
    backdropFilter: blurred ? 'blur(20px)' : 'none',
    WebkitBackdropFilter: blurred ? 'blur(20px)' : 'none',
    boxShadow: shouldBeTransparent ? 'none' : `0 12px 30px ${theme.shadow}`,
  };

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    void navigate(buildStorefrontPath(storeSlug, q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog'));
  }

  // ── Shared sub-components ──────────────────────────────────

  function renderCartButton() {
    if (!showCart) return null;
    return (
      <button
        type="button"
        aria-label="Carrito de compras"
        onClick={() => {
          closeMenus();
          onCartOpen?.();
        }}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm md:h-12 md:w-12"
        style={{ borderColor: controlBorder, backgroundColor: controlBg, color: theme.text }}
      >
        <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
        {cartCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
            style={{ backgroundColor: theme.primary }}
          >
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </button>
    );
  }

  function renderHamburgerButton(desktopAt: 'lg' | 'xl' = 'lg') {
    const visibilityClass = desktopAt === 'xl' ? 'xl:hidden' : 'lg:hidden';
    return (
      <button
        type="button"
        aria-label={mobileNavOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
        aria-expanded={mobileNavOpen}
        aria-controls="storefront-mobile-navigation"
        onClick={() => {
          setMobileNavOpen((v) => !v);
          closeMegaMenuImmediately();
          setMoreMenuOpen(false);
          onRequestCloseCart?.();
        }}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm ${visibilityClass}`}
        style={{ borderColor: controlBorder, backgroundColor: controlBg, color: theme.text }}
      >
        {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
    );
  }

  // Desktop "Más" overflow dropdown
  function renderMoreDropdown() {
    if (!hasOverflow) return null;
    return (
      <div ref={moreMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setMoreMenuOpen((v) => !v)}
          onMouseEnter={closeMegaMenuImmediately}
          aria-expanded={moreMenuOpen}
          className={`${menuTextClass} inline-flex items-center gap-1 font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
          style={{ color: navTextColor }}
        >
          Más
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-150 ${moreMenuOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {moreMenuOpen && (
          <div
            className="absolute left-0 top-full z-30 mt-2 min-w-[180px] overflow-hidden rounded-xl border shadow-xl"
            style={{
              borderColor: controlBorder,
              backgroundColor: withOpacity(theme.background, theme.mode === 'dark' ? 0.96 : 0.98),
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: `0 12px 32px ${theme.shadow}`,
            }}
          >
            <div className="flex flex-col py-1.5">
              {overflowNavigationItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={closeMenus}
                  className="px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: theme.mode === 'dark' ? theme.text : '#374151' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderDesktopNav(desktopAt: 'lg' | 'xl' = 'lg') {
    const visibilityClass = desktopAt === 'xl' ? 'xl:flex' : 'lg:flex';
    return (
      <nav className={`hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 ${visibilityClass}`} aria-label="Navegación principal">
        {settings.showHomeLink && (
          <Link
            to={buildStorefrontPath(storeSlug)}
            className={`${menuTextClass} font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
            style={{ color: theme.primary }}
            onMouseEnter={closeMegaMenuImmediately}
            onClick={closeMenus}
          >
            Inicio
          </Link>
        )}

        {visibleNavigationItems.map((item) => {
          const hasMegaMenu = itemHasMegaMenu(item);
          const isOpen = megaMenuItemId === item.id && showMegaMenu;
          return (
            <Link
              key={item.id}
              to={item.href}
              className={`${menuTextClass} group relative inline-flex items-center gap-1.5 whitespace-nowrap py-2 font-semibold outline-none transition-colors`}
              style={{
                color: isOpen
                  ? theme.primary
                  : !settings.showHomeLink && item === visibleNavigationItems[0]
                    ? theme.primary
                    : navTextColor,
              }}
              onMouseEnter={() => openMegaMenu(item)}
              onFocus={() => openMegaMenu(item, true)}
              onClick={closeMenus}
              aria-expanded={hasMegaMenu ? isOpen : undefined}
              aria-controls={hasMegaMenu ? 'storefront-mega-menu' : undefined}
            >
              {item.label}
              {hasMegaMenu ? (
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              ) : null}
              <span
                className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 origin-center scale-x-0 rounded-full transition-transform group-hover:scale-x-100 group-focus-visible:scale-x-100"
                style={{ backgroundColor: theme.primary, transform: isOpen ? 'scaleX(1)' : undefined }}
                aria-hidden="true"
              />
            </Link>
          );
        })}
        {renderMoreDropdown()}
      </nav>
    );
  }

  // ── CLASSIC ────────────────────────────────────────────────────
  if (settings.style === 'classic') {
    return (
      <>
        <header className={positionClass} style={headerStyle}>
          <div onMouseEnter={keepMegaMenuOpen} onMouseLeave={scheduleMegaMenuClose}>
            <div className={`relative mx-auto ${STOREFRONT_CONTAINER_CLASS} px-4 py-4 md:px-6`}>
              <div className="flex items-center justify-between gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">

                {/* LEFT: brand */}
                <div className="min-w-0 flex-1 xl:flex-none">
                  {(settings.showLogo || settings.showStoreName) && (
                    <Link
                      to={buildStorefrontPath(storeSlug)}
                      className="flex min-w-0 items-center gap-3 md:gap-4"
                      onMouseEnter={closeMegaMenuImmediately}
                      onClick={closeMenus}
                    >
                      {settings.showLogo && (
                        <PublicStoreLogo
                          logoUrl={logoUrl}
                          storeName={storeName}
                          sizeClassName={logoSizeClass}
                          fallbackColor={theme.primary}
                          outerClassName="border shadow-sm shrink-0"
                          outerStyle={{
                            borderColor: controlBorder,
                            backgroundColor: controlBg,
                            boxShadow: `0 10px 24px ${theme.shadow}`,
                          }}
                        />
                      )}
                      {settings.showStoreName && (
                        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                          <span
                            data-storefront-brand-name
                            className="line-clamp-2 max-w-full break-words text-[18px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[22px] md:text-[26px] xl:block xl:truncate xl:leading-none"
                            style={{ color: theme.mode === 'dark' ? theme.text : '#1f2937' }}
                          >
                            {storeName}
                          </span>
                          {showCart && (
                            <StoreStatusBadge
                              theme={theme}
                              orderStatus={orderStatus}
                              scheduleLoading={scheduleLoading}
                              className="max-w-full px-2 text-[10px] sm:px-2.5 sm:text-[11px]"
                            />
                          )}
                        </div>
                      )}
                    </Link>
                  )}
                </div>

                {/* CENTER: nav */}
                {renderDesktopNav('xl')}

                {/* RIGHT: search + cart + hamburger */}
                <div className="relative flex items-center justify-end gap-2 md:gap-3">
                  <form
                    onSubmit={handleSearchSubmit}
                    className="relative hidden w-full min-w-[190px] max-w-[250px] xl:block"
                    onMouseEnter={closeMegaMenuImmediately}
                  >
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      className="h-10 w-full rounded-md border pl-4 pr-10 text-[12px] outline-none"
                      style={{ borderColor: controlBorder, backgroundColor: controlBg, color: theme.text }}
                    />
                    <button type="submit" aria-label="Buscar" className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Search className="h-4 w-4" style={{ color: theme.mutedText }} />
                    </button>
                  </form>
                  {renderCartButton()}
                  {renderHamburgerButton('xl')}
                </div>
              </div>

              {/* Mobile search */}
              <form onSubmit={handleSearchSubmit} className="mt-3 xl:hidden">
                <div className="relative w-full">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-10 w-full rounded-md border pl-4 pr-10 text-[12px] outline-none"
                    style={{ borderColor: controlBorder, backgroundColor: controlBg, color: theme.text }}
                  />
                  <button type="submit" aria-label="Buscar" className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Search className="h-4 w-4" style={{ color: theme.mutedText }} />
                  </button>
                </div>
              </form>
            </div>

            {/* MegaMenuPanel — full width below nav */}
            {showMegaMenu && (
              <MegaMenuPanel
                theme={theme}
                storeSlug={storeSlug}
                catalogLabel={catalogLabel}
                categoryTree={menuCategoryTree}
                collections={menuCollections}
                activeCategory={activeMegaMenuItem?.type === 'catalog' ? null : activeCategoryNode}
                megaMenuFacets={megaMenuFacets}
                onClose={closeMegaMenuImmediately}
              />
            )}
          </div>
        </header>

        <MobileNavDrawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          theme={theme}
          storeSlug={storeSlug}
          storeName={storeName}
          logoUrl={logoUrl}
          settings={settings}
          categoryTree={navigationCategoryTree}
          collections={menuCollections}
          navigationItems={navigationItems}
          showAutomaticCollections={settings.menuMode !== 'custom'}
        />
      </>
    );
  }

  // ── SEARCH ────────────────────────────────────────────────────
  return (
    <>
      <header
        className={positionClass}
        style={headerStyle}
        onMouseEnter={keepMegaMenuOpen}
        onMouseLeave={scheduleMegaMenuClose}
      >
        <div
          className={`mx-auto ${STOREFRONT_CONTAINER_CLASS} px-4 md:px-6`}
        >
          {/* Row 1 */}
          <div className="flex items-center gap-3 py-3">
            {(settings.showLogo || settings.showStoreName) && (
              <Link
                to={buildStorefrontPath(storeSlug)}
                className="flex shrink-0 items-center gap-2.5"
                onMouseEnter={closeMegaMenuImmediately}
                onClick={closeMenus}
              >
                {settings.showLogo && (
                  <PublicStoreLogo
                    logoUrl={logoUrl}
                    storeName={storeName}
                    sizeClassName={logoSizeClass}
                    fallbackColor={theme.primary}
                    outerClassName="border shadow-sm shrink-0"
                    outerStyle={{
                      borderColor: controlBorder,
                      backgroundColor: controlBg,
                      boxShadow: `0 6px 16px ${theme.shadow}`,
                    }}
                  />
                )}
                {settings.showStoreName && (
                  <div className="hidden min-w-0 flex-col items-start gap-1 md:flex">
                    <span
                      className="truncate text-base font-semibold leading-tight tracking-tight max-w-[160px]"
                      style={{ color: theme.mode === 'dark' ? theme.text : '#1f2937' }}
                    >
                      {storeName}
                    </span>
                    {showCart && (
                      <StoreStatusBadge theme={theme} orderStatus={orderStatus} scheduleLoading={scheduleLoading} />
                    )}
                  </div>
                )}
              </Link>
            )}

            {/* Search centered, desktop */}
            <form
              onSubmit={handleSearchSubmit}
              className="relative mx-auto hidden max-w-[480px] flex-1 lg:block"
              onMouseEnter={closeMegaMenuImmediately}
            >
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-xl border pl-4 pr-10 text-[13px] outline-none"
                style={{ borderColor: controlBorder, backgroundColor: controlBg, color: theme.text }}
              />
              <button type="submit" aria-label="Buscar" className="absolute right-3 top-1/2 -translate-y-1/2">
                <Search className="h-4 w-4" style={{ color: theme.mutedText }} />
              </button>
            </form>

            {/* Right */}
            <div className="relative ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
              {renderCartButton()}
              {renderHamburgerButton()}
            </div>
          </div>

          {/* Row 2: search mobile + nav desktop */}
          <div className="pb-2">
            <form onSubmit={handleSearchSubmit} className="relative mb-2 lg:hidden">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-xl border pl-4 pr-10 text-[13px] outline-none"
                style={{ borderColor: controlBorder, backgroundColor: controlBg, color: theme.text }}
              />
              <button type="submit" aria-label="Buscar" className="absolute right-3 top-1/2 -translate-y-1/2">
                <Search className="h-4 w-4" style={{ color: theme.mutedText }} />
              </button>
            </form>

            {/* Desktop nav centered */}
            {renderDesktopNav()}
          </div>

        </div>

        {/* Full-width desktop navigation panel. */}
        {showMegaMenu && (
          <MegaMenuPanel
            theme={theme}
            storeSlug={storeSlug}
            catalogLabel={catalogLabel}
            categoryTree={menuCategoryTree}
            collections={menuCollections}
            activeCategory={activeMegaMenuItem?.type === 'catalog' ? null : activeCategoryNode}
            megaMenuFacets={megaMenuFacets}
            onClose={closeMegaMenuImmediately}
          />
        )}
      </header>

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        theme={theme}
        storeSlug={storeSlug}
        storeName={storeName}
        logoUrl={logoUrl}
        settings={settings}
        categoryTree={navigationCategoryTree}
        collections={menuCollections}
        navigationItems={navigationItems}
        showAutomaticCollections={settings.menuMode !== 'custom'}
      />
    </>
  );
}
