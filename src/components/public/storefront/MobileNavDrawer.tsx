import {
  BadgePercent,
  ChevronRight,
  FolderTree,
  Home,
  Layers3,
  List,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  HeaderNavigationItemType,
  PublicHeaderSettings,
  PublicStoreCategory,
  PublicStoreCollection,
} from '@/types/common.types';
import type { StorefrontTheme } from './storefrontTheme';
import { PublicStoreLogo } from './PublicStoreLogo';
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
}: MobileNavDrawerProps) {
  if (!open) return null;

  const visibleCollections = showAutomaticCollections
    ? collections.filter((collection) => collection.showInMenu)
    : [];

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
              className={`flex items-center gap-3 px-5 py-3.5 font-medium transition-opacity hover:opacity-70 ${menuTextClass}`}
              style={{ color: theme.primary }}
            >
              <Home className="h-4 w-4 shrink-0" />
              Inicio
            </Link>
          )}

          {navigationItems.map((item, index) => {
            const rootCategory = item.rootCategorySlug
              ? categoryTree.find((category) => category.slug === item.rootCategorySlug) ?? null
              : null;
            return (
              <div key={item.id} className="border-b border-transparent">
                <Link
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between gap-3 px-5 py-3 font-medium transition-opacity hover:opacity-70 ${menuTextClass}`}
                  style={{
                    color: !settings.showHomeLink && index === 0
                      ? theme.primary
                      : theme.mode === 'dark' ? theme.text : '#374151',
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <NavigationItemIcon type={item.type} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {(rootCategory?.children ?? []).length > 0 && (
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: theme.mutedText }}
                    />
                  )}
                </Link>
                {(rootCategory?.children ?? []).length > 0 && (
                  <div className="pb-2">
                    {(rootCategory?.children ?? []).map((child) => (
                      <Link
                        key={child.id}
                        to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(rootCategory?.slug ?? '')}&sub=${encodeURIComponent(child.slug)}`)}
                        onClick={onClose}
                        className={`block px-12 py-2 transition-opacity hover:opacity-70 ${submenuTextClass}`}
                        style={{ color: theme.mutedText }}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {visibleCollections.length > 0 && (
            <>
              <div
                className="mx-4 my-1"
                style={{ borderTop: `1px solid ${theme.border}` }}
              />
              <p
                className="px-5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest"
                style={{ color: theme.mutedText }}
              >
                Colecciones
              </p>
              {visibleCollections.map((collection) => (
                <Link
                  key={collection.id}
                  to={buildStorefrontPath(storeSlug, `/catalog?collection=${encodeURIComponent(collection.slug)}`)}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-5 py-3 transition-opacity hover:opacity-70 ${menuTextClass}`}
                  style={{ color: theme.mode === 'dark' ? theme.text : '#374151' }}
                >
                  <Sparkles className="h-4 w-4 shrink-0" style={{ color: theme.primary }} />
                  {collection.name}
                </Link>
              ))}
            </>
          )}
        </nav>
      </div>
    </>
  );
}

function NavigationItemIcon({ type }: { type: HeaderNavigationItemType }) {
  const className = 'h-4 w-4 shrink-0';
  if (type === 'category') return <FolderTree className={className} />;
  if (type === 'collection') return <Layers3 className={className} />;
  if (type === 'facet_value') return <SlidersHorizontal className={className} />;
  if (type === 'featured') return <Sparkles className={className} />;
  if (type === 'sale') return <BadgePercent className={className} />;
  return <List className={className} />;
}
