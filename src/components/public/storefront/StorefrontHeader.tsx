import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Menu, Search, ShoppingCart, X } from 'lucide-react';
import { PublicStoreLogo } from './PublicStoreLogo';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MegaMenuPanel } from './MegaMenuPanel';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from './storefrontTheme';
import type { CatalogMeta, CatalogType, PublicHeaderSettings, PublicStoreCategory } from '@/types/common.types';
import { DEFAULT_HEADER_SETTINGS } from '@/types/common.types';
import {
  resolveHeaderSettings,
  LOGO_SIZE_MAP,
  MENU_TEXT_SIZE_MAP,
  MAX_VISIBLE_HEADER_CATEGORIES,
} from '@/lib/storefront/headerSettings';
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
  slogan: string | null;
  catalogType: CatalogType | null;
  hasHero?: boolean;
  showCart?: boolean;
  cartCount?: number;
  onCartOpen?: () => void;
  onRequestCloseCart?: () => void;
  headerSettings?: PublicHeaderSettings | null;
  categories?: PublicStoreCategory[];
  catalogMeta?: CatalogMeta | null;
}

export function StorefrontHeader({
  theme,
  storeName,
  storeSlug,
  logoUrl,
  slogan: _slogan,
  catalogType,
  hasHero = true,
  showCart = false,
  cartCount = 0,
  onCartOpen,
  onRequestCloseCart,
  headerSettings,
  categories = [],
  catalogMeta,
}: StorefrontHeaderProps & { categories?: PublicStoreCategory[] }) {
  const settings = resolveHeaderSettings(headerSettings ?? DEFAULT_HEADER_SETTINGS);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [megaMenuCategory, setMegaMenuCategory] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

  const inCategoriesMode = settings.menuMode === 'categories' && categories.length > 0;
  const visibleCats = inCategoriesMode ? categories.slice(0, MAX_VISIBLE_HEADER_CATEGORIES) : [];
  const overflowCats = inCategoriesMode ? categories.slice(MAX_VISIBLE_HEADER_CATEGORIES) : [];
  const hasOverflow = overflowCats.length > 0;

  // Mega menu: find active category in tree by slug
  const activeCategoryNode = megaMenuCategory
    ? (catalogMeta?.categoryTree ?? []).find((c) => c.slug === megaMenuCategory) ?? null
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

  const menuCollections = useMemo(
    () => (catalogMeta?.collections ?? []).filter((c) => c.showInMenu),
    [catalogMeta?.collections]
  );

  const showMegaMenu =
    megaMenuCategory !== null &&
    (megaSubcategories.length > 0 || megaMenuFacets.some((f) => f.values.length > 0));

  function closeMenus() {
    setMobileNavOpen(false);
    setMegaMenuCategory(null);
    setMoreMenuOpen(false);
  }

  function handleCategoryMouseEnter(slug: string) {
    const node = (catalogMeta?.categoryTree ?? []).find((c) => c.slug === slug);
    const facets = catalogMeta?.megaMenuFacets ?? [];
    if ((node?.children?.length ?? 0) > 0 || facets.some((f) => f.values.length > 0)) {
      setMegaMenuCategory(slug);
    } else {
      setMegaMenuCategory(null);
    }
  }

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 12);
      if (window.scrollY > 12) {
        setMobileNavOpen(false);
        setMoreMenuOpen(false);
        setMegaMenuCategory(null);
      }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  // Defensive cleanup: any open header menu must close on route change,
  // since StorefrontHeader stays mounted across nested public route navigations.
  useEffect(() => {
    setMobileNavOpen(false);
    setMegaMenuCategory(null);
    setMoreMenuOpen(false);
  }, [location.pathname]);

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

  function CartButton() {
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

  function HamburgerButton() {
    return (
      <button
        type="button"
        aria-label={mobileNavOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
        onClick={() => {
          setMobileNavOpen((v) => !v);
          setMegaMenuCategory(null);
          setMoreMenuOpen(false);
          onRequestCloseCart?.();
        }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm lg:hidden"
        style={{ borderColor: controlBorder, backgroundColor: controlBg, color: theme.text }}
      >
        {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
    );
  }

  // Desktop "Más" overflow dropdown
  function MoreDropdown() {
    if (!inCategoriesMode || !hasOverflow) return null;
    return (
      <div ref={moreMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setMoreMenuOpen((v) => !v)}
          onMouseEnter={() => setMegaMenuCategory(null)}
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
              {overflowCats.map((cat) => (
                <Link
                  key={cat.id}
                  to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(cat.slug)}`)}
                  onClick={() => setMoreMenuOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: theme.mode === 'dark' ? theme.text : '#374151' }}
                >
                  {cat.name}
                </Link>
              ))}
              <div className="mx-3 my-1" style={{ borderTop: `1px solid ${controlBorder}` }} />
              <Link
                to={buildStorefrontPath(storeSlug, '/catalog')}
                onClick={() => setMoreMenuOpen(false)}
                className="px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: theme.primary }}
              >
                {viewAllLabel}
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  function DesktopNav() {
    return (
      <nav className="hidden flex-wrap items-center justify-center gap-6 lg:flex">
        {settings.showHomeLink && (
          <Link
            to={buildStorefrontPath(storeSlug)}
            className={`${menuTextClass} font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
            style={{ color: theme.primary }}
            onMouseEnter={() => setMegaMenuCategory(null)}
            onClick={closeMenus}
          >
            Inicio
          </Link>
        )}

        {inCategoriesMode ? (
          <>
            {visibleCats.map((cat) => (
              <Link
                key={cat.id}
                to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(cat.slug)}`)}
                className={`${menuTextClass} font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
                style={{ color: megaMenuCategory === cat.slug ? theme.primary : navTextColor }}
                onMouseEnter={() => handleCategoryMouseEnter(cat.slug)}
                onClick={() => setMegaMenuCategory(null)}
              >
                {cat.name}
              </Link>
            ))}

            <MoreDropdown />

            {!hasOverflow && (
              <Link
                to={buildStorefrontPath(storeSlug, '/catalog')}
                className={`${menuTextClass} font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
                style={{ color: navTextColor }}
                onMouseEnter={() => setMegaMenuCategory(null)}
              >
                {viewAllLabel}
              </Link>
            )}
          </>
        ) : (
          <Link
            to={buildStorefrontPath(storeSlug, '/catalog')}
            className={`${menuTextClass} font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
            style={{ color: settings.showHomeLink ? navTextColor : theme.primary }}
            onMouseEnter={() => setMegaMenuCategory(null)}
          >
            {catalogLabel}
          </Link>
        )}
      </nav>
    );
  }

  // ── CLASSIC ────────────────────────────────────────────────────
  if (settings.style === 'classic') {
    return (
      <>
        <header className={positionClass} style={headerStyle}>
          <div onMouseLeave={() => setMegaMenuCategory(null)}>
            <div className={`relative mx-auto ${STOREFRONT_CONTAINER_CLASS} px-4 py-4 md:px-6`}>
              <div className="flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">

                {/* LEFT: brand */}
                <div className="min-w-0">
                  {(settings.showLogo || settings.showStoreName) && (
                    <Link
                      to={buildStorefrontPath(storeSlug)}
                      className="flex shrink-0 items-center gap-3 md:gap-4"
                      onMouseEnter={() => setMegaMenuCategory(null)}
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
                        <span
                          className="truncate text-[22px] font-semibold leading-none tracking-[-0.03em] md:text-[26px]"
                          style={{ color: theme.mode === 'dark' ? theme.text : '#1f2937' }}
                        >
                          {storeName}
                        </span>
                      )}
                    </Link>
                  )}
                </div>

                {/* CENTER: nav */}
                <DesktopNav />

                {/* RIGHT: search + cart + hamburger */}
                <div className="relative flex items-center justify-end gap-2 md:gap-3">
                  <form
                    onSubmit={handleSearchSubmit}
                    className="relative hidden w-full min-w-[190px] max-w-[250px] lg:block"
                    onMouseEnter={() => setMegaMenuCategory(null)}
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
                  <CartButton />
                  <HamburgerButton />
                </div>
              </div>

              {/* Mobile search */}
              <form onSubmit={handleSearchSubmit} className="mt-3 lg:hidden">
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
            {showMegaMenu && activeCategoryNode && (
              <MegaMenuPanel
                theme={theme}
                storeSlug={storeSlug}
                activeCategoryName={activeCategoryNode.name}
                activeCategorySlug={activeCategoryNode.slug}
                subcategories={megaSubcategories}
                megaMenuFacets={megaMenuFacets}
                onClose={() => setMegaMenuCategory(null)}
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
          catalogType={catalogType}
          settings={settings}
          categoryTree={catalogMeta?.categoryTree ?? []}
          collections={menuCollections}
        />
      </>
    );
  }

  // ── SEARCH ────────────────────────────────────────────────────
  return (
    <>
      <header className={positionClass} style={headerStyle}>
        <div
          className={`mx-auto ${STOREFRONT_CONTAINER_CLASS} px-4 md:px-6`}
          onMouseLeave={() => setMegaMenuCategory(null)}
        >
          {/* Row 1 */}
          <div className="flex items-center gap-3 py-3">
            {(settings.showLogo || settings.showStoreName) && (
              <Link
                to={buildStorefrontPath(storeSlug)}
                className="flex shrink-0 items-center gap-2.5"
                onMouseEnter={() => setMegaMenuCategory(null)}
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
                  <span
                    className="hidden truncate text-base font-semibold leading-tight tracking-tight md:block max-w-[160px]"
                    style={{ color: theme.mode === 'dark' ? theme.text : '#1f2937' }}
                  >
                    {storeName}
                  </span>
                )}
              </Link>
            )}

            {/* Search centered, desktop */}
            <form
              onSubmit={handleSearchSubmit}
              className="relative mx-auto hidden max-w-[480px] flex-1 lg:block"
              onMouseEnter={() => setMegaMenuCategory(null)}
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
              <CartButton />
              <HamburgerButton />
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
            <div className="hidden items-center justify-center gap-6 lg:flex">
              {settings.showHomeLink && (
                <Link
                  to={buildStorefrontPath(storeSlug)}
                  className={`${menuTextClass} font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
                  style={{ color: theme.primary }}
                  onMouseEnter={() => setMegaMenuCategory(null)}
                  onClick={closeMenus}
                >
                  Inicio
                </Link>
              )}
              {inCategoriesMode ? (
                <>
                  {visibleCats.map((cat) => (
                    <Link
                      key={cat.id}
                      to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(cat.slug)}`)}
                      className={`${menuTextClass} font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
                      style={{ color: megaMenuCategory === cat.slug ? theme.primary : navTextColor }}
                      onMouseEnter={() => handleCategoryMouseEnter(cat.slug)}
                      onClick={() => setMegaMenuCategory(null)}
                    >
                      {cat.name}
                    </Link>
                  ))}
                  <MoreDropdown />
                  {!hasOverflow && (
                    <Link
                      to={buildStorefrontPath(storeSlug, '/catalog')}
                      className={`${menuTextClass} font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
                      style={{ color: navTextColor }}
                      onMouseEnter={() => setMegaMenuCategory(null)}
                    >
                      {viewAllLabel}
                    </Link>
                  )}
                </>
              ) : (
                <Link
                  to={buildStorefrontPath(storeSlug, '/catalog')}
                  className={`${menuTextClass} font-medium whitespace-nowrap transition-opacity hover:opacity-80`}
                  style={{ color: settings.showHomeLink ? navTextColor : theme.primary }}
                  onMouseEnter={() => setMegaMenuCategory(null)}
                >
                  {catalogLabel}
                </Link>
              )}
            </div>
          </div>

          {/* MegaMenuPanel — full width below nav */}
          {showMegaMenu && activeCategoryNode && (
            <MegaMenuPanel
              theme={theme}
              storeSlug={storeSlug}
              activeCategoryName={activeCategoryNode.name}
              activeCategorySlug={activeCategoryNode.slug}
              subcategories={megaSubcategories}
              megaMenuFacets={megaMenuFacets}
              onClose={() => setMegaMenuCategory(null)}
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
        catalogType={catalogType}
        settings={settings}
        categoryTree={catalogMeta?.categoryTree ?? []}
        collections={menuCollections}
      />
    </>
  );
}
