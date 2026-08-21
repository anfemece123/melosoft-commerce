import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  PublicHeaderSettings,
  PublicStoreCategory,
  PublicStoreCollection,
} from '@/types/common.types';
import type { StorefrontTheme } from './storefrontTheme';
import { PublicStoreLogo } from './PublicStoreLogo';
import { HeaderNavigationIcon } from './HeaderNavigationIcon';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import type { ResolvedHeaderNavigationItem } from '@/lib/storefront/headerNavigation';
import {
  MENU_TEXT_SIZE_MAP,
  SUBMENU_TEXT_SIZE_MAP,
} from '@/lib/storefront/headerSettings';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  theme: StorefrontTheme;
  storeSlug: string;
  storeName: string;
  logoUrl: string | null;
  settings: PublicHeaderSettings;
  categoryTree: PublicStoreCategory[];
  collections?: PublicStoreCollection[];
  navigationItems: ResolvedHeaderNavigationItem[];
  showAutomaticCollections: boolean;
  activeNavigationItemId?: string | null;
  activeCategorySlug?: string | null;
  homeIsActive?: boolean;
}

export function MobileNavDrawer({
  open,
  onClose,
  theme,
  storeSlug,
  storeName,
  logoUrl,
  settings,
  categoryTree,
  collections = [],
  navigationItems,
  showAutomaticCollections,
  activeNavigationItemId = null,
  activeCategorySlug = null,
  homeIsActive = false,
}: MobileNavDrawerProps) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(() => (
    settings.menuMode === 'catalog_link'
      ? navigationItems.find((item) => item.type === 'catalog')?.id ?? null
      : null
  ));
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  const visibleCollections = showAutomaticCollections
    ? collections.filter((collection) => collection.showInMenu)
    : [];
  const automaticCategoryTree = categoryTree.filter((category) => category.showInMenu);

  const controlBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const menuTextClass = MENU_TEXT_SIZE_MAP[settings.menuTextSize];
  const submenuTextClass = SUBMENU_TEXT_SIZE_MAP[settings.menuTextSize];

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        id="storefront-mobile-navigation"
        ref={drawerRef}
        className="fixed bottom-0 left-0 top-0 z-50 flex w-[280px] max-w-[85vw] flex-col shadow-2xl"
        style={{ backgroundColor: theme.background }}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-4"
          style={{ borderColor: theme.border }}
        >
          {(settings.showLogo || settings.showStoreName) ? (
            <Link
              to={buildStorefrontPath(storeSlug)}
              onClick={onClose}
              className="flex min-w-0 items-center gap-2.5"
            >
              {settings.showLogo && (
                <PublicStoreLogo
                  logoUrl={logoUrl}
                  storeName={storeName}
                  sizeClassName="h-8 w-8"
                  fallbackColor={theme.primary}
                  outerClassName="border shrink-0"
                  outerStyle={{ borderColor: theme.border, backgroundColor: controlBg }}
                />
              )}
              {settings.showStoreName && (
                <span
                  className="truncate text-sm font-semibold"
                  style={{ color: theme.text }}
                >
                  {storeName}
                </span>
              )}
            </Link>
          ) : (
            <span className="text-sm font-bold" style={{ color: theme.text }}>Menú</span>
          )}

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de navegación"
            className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ backgroundColor: controlBg, color: theme.text }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {settings.showHomeLink && (
            <Link
              to={buildStorefrontPath(storeSlug)}
              onClick={onClose}
              className={`flex items-center gap-3 px-5 py-3.5 font-medium transition-opacity hover:opacity-70 ${menuTextClass} ${homeIsActive ? 'font-semibold' : ''}`}
              style={{ color: homeIsActive ? theme.primary : theme.text, backgroundColor: homeIsActive ? controlBg : 'transparent' }}
              aria-current={homeIsActive ? 'page' : undefined}
            >
              <HeaderNavigationIcon type="home" icon={settings.homeIcon} iconUrl={settings.homeIconUrl} className="h-5 w-5 shrink-0" />
              Inicio
            </Link>
          )}

          {navigationItems.map((item, index) => {
            const rootCategory = item.rootCategorySlug
              ? categoryTree.find((category) => category.slug === item.rootCategorySlug) ?? null
              : null;
            const isCatalogMenu = item.type === 'catalog';
            const hasNestedContent = isCatalogMenu
              ? automaticCategoryTree.length > 0
              : (rootCategory?.children ?? []).length > 0;
            const isExpanded = expandedItemId === item.id;
            const itemIsActive = activeNavigationItemId === item.id;
            return (
              <div key={item.id} className="border-b border-transparent">
                <div className="flex items-center">
                  <Link
                    to={item.href}
                    onClick={onClose}
                    className={`flex min-w-0 flex-1 items-center gap-3 py-3 pl-5 font-medium transition-opacity hover:opacity-70 ${menuTextClass} ${hasNestedContent ? 'pr-2' : 'pr-5'} ${itemIsActive ? 'font-semibold' : ''}`}
                    style={{
                      color: itemIsActive || (!settings.showHomeLink && index === 0)
                        ? theme.primary
                        : theme.mode === 'dark' ? theme.text : '#374151',
                      backgroundColor: itemIsActive ? controlBg : 'transparent',
                    }}
                    aria-current={itemIsActive ? 'page' : undefined}
                  >
                    <HeaderNavigationIcon type={item.type} icon={item.icon} iconUrl={item.iconUrl} className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                  {hasNestedContent ? (
                    <button
                      type="button"
                      onClick={() => setExpandedItemId((current) => current === item.id ? null : item.id)}
                      className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                      style={{ color: theme.mutedText }}
                      aria-label={`${isExpanded ? 'Ocultar' : 'Mostrar'} opciones de ${item.label}`}
                      aria-expanded={isExpanded}
                      aria-controls={`mobile-nav-children-${item.id}`}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  ) : null}
                </div>

                {hasNestedContent && isExpanded ? (
                  <div
                    id={`mobile-nav-children-${item.id}`}
                    className="mx-4 mb-2 overflow-hidden rounded-xl"
                    style={{ backgroundColor: controlBg }}
                  >
                    {isCatalogMenu ? automaticCategoryTree.map((category) => (
                      <div key={category.id} className="border-b last:border-b-0" style={{ borderColor: theme.border }}>
                        <Link
                          to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(category.slug)}`)}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 px-4 py-2.5 font-semibold transition-opacity hover:opacity-70 ${submenuTextClass} ${activeCategorySlug === category.slug ? 'font-bold' : ''}`}
                          style={{ color: activeCategorySlug === category.slug ? theme.primary : theme.text, backgroundColor: activeCategorySlug === category.slug ? controlBg : 'transparent' }}
                          aria-current={activeCategorySlug === category.slug ? 'page' : undefined}
                        >
                          {category.imageUrl ? (
                            <img src={category.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                          ) : null}
                          <span className="min-w-0 flex-1 truncate">{category.name}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: theme.mutedText }} />
                        </Link>
                        {(category.children ?? []).length > 0 ? (
                          <div className="pb-2">
                            {(category.children ?? []).map((child) => (
                              <Link
                                key={child.id}
                                to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(category.slug)}&sub=${encodeURIComponent(child.slug)}`)}
                                onClick={onClose}
                                className={`flex items-center gap-2 px-7 py-1.5 transition-opacity hover:opacity-70 ${submenuTextClass}`}
                                style={{ color: theme.mutedText }}
                              >
                                {child.imageUrl ? (
                                  <img src={child.imageUrl} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
                                ) : null}
                                <span className="truncate">{child.name}</span>
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )) : (rootCategory?.children ?? []).map((child) => (
                      <Link
                        key={child.id}
                        to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(rootCategory?.slug ?? '')}&sub=${encodeURIComponent(child.slug)}`)}
                        onClick={onClose}
                        className={`flex items-center gap-2.5 px-4 py-2.5 transition-opacity hover:opacity-70 ${submenuTextClass}`}
                        style={{ color: theme.mutedText }}
                      >
                        {child.imageUrl ? (
                          <img src={child.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{child.name}</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {visibleCollections.length > 0 && (
            <div className="mt-1">
              {visibleCollections.map((collection) => (
                <Link
                  key={collection.id}
                  to={buildStorefrontPath(storeSlug, `/catalog?collection=${encodeURIComponent(collection.slug)}`)}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-5 py-3 transition-opacity hover:opacity-70 ${menuTextClass}`}
                  style={{ color: theme.mode === 'dark' ? theme.text : '#374151' }}
                >
                  {collection.imageUrl ? (
                    <img src={collection.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <HeaderNavigationIcon type="collection" className="h-5 w-5 shrink-0" />
                  )}
                  <span className="truncate">{collection.name}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
