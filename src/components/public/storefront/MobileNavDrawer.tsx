import { ChevronRight, Home, List, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CatalogType, PublicHeaderSettings, PublicStoreCategory, PublicStoreCollection } from '@/types/common.types';
import type { StorefrontTheme } from './storefrontTheme';
import { PublicStoreLogo } from './PublicStoreLogo';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  theme: StorefrontTheme;
  storeSlug: string;
  storeName: string;
  logoUrl: string | null;
  catalogType: CatalogType | null;
  settings: PublicHeaderSettings;
  categoryTree: PublicStoreCategory[];
  collections?: PublicStoreCollection[];
}

function getCatalogLabel(catalogType: CatalogType | null): string {
  if (catalogType === 'menu') return 'Menú';
  if (catalogType === 'services' || catalogType === 'mixed') return 'Catálogo';
  return 'Productos';
}

function getViewAllLabel(catalogType: CatalogType | null): string {
  if (catalogType === 'menu') return 'Menú completo';
  if (catalogType === 'services' || catalogType === 'mixed') return 'Ver catálogo completo';
  return 'Todos los productos';
}

export function MobileNavDrawer({
  open,
  onClose,
  theme,
  storeSlug,
  storeName,
  logoUrl,
  catalogType,
  settings,
  categoryTree,
  collections = [],
}: MobileNavDrawerProps) {
  if (!open) return null;

  const catalogLabel = getCatalogLabel(catalogType);
  const viewAllLabel = getViewAllLabel(catalogType);
  const visibleRootCats = categoryTree.filter((c) => c.showInMenu);
  const inCategoriesMode = settings.menuMode === 'categories' && visibleRootCats.length > 0;
  const visibleCollections = collections.filter((c) => c.showInMenu);

  const controlBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

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
              className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: theme.primary }}
            >
              <Home className="h-4 w-4 shrink-0" />
              Inicio
            </Link>
          )}

          {inCategoriesMode ? (
            <>
              <Link
                to={buildStorefrontPath(storeSlug, '/catalog')}
                onClick={onClose}
                className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: theme.mode === 'dark' ? theme.text : '#374151' }}
              >
                <List className="h-4 w-4 shrink-0" />
                {viewAllLabel}
              </Link>

              <div
                className="mx-4 my-1"
                style={{ borderTop: `1px solid ${theme.border}` }}
              />

              {visibleRootCats.map((cat) => (
                <div key={cat.id} className="border-b border-transparent">
                  <Link
                    to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(cat.slug)}`)}
                    onClick={onClose}
                    className="flex items-center justify-between px-5 py-3 text-sm transition-opacity hover:opacity-70"
                    style={{ color: theme.mode === 'dark' ? theme.text : '#374151' }}
                  >
                    <span>{cat.name}</span>
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: theme.mutedText }}
                    />
                  </Link>
                  {(cat.children ?? []).length > 0 && (
                    <div className="pb-2">
                      {(cat.children ?? []).map((child) => (
                        <Link
                          key={child.id}
                          to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(cat.slug)}&sub=${encodeURIComponent(child.slug)}`)}
                          onClick={onClose}
                          className="block px-9 py-2 text-sm transition-opacity hover:opacity-70"
                          style={{ color: theme.mutedText }}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <Link
              to={buildStorefrontPath(storeSlug, '/catalog')}
              onClick={onClose}
              className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-opacity hover:opacity-70"
              style={{
                color: settings.showHomeLink
                  ? theme.mode === 'dark' ? theme.text : '#374151'
                  : theme.primary,
              }}
            >
              <List className="h-4 w-4 shrink-0" />
              {catalogLabel}
            </Link>
          )}

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
                  className="flex items-center gap-3 px-5 py-3 text-sm transition-opacity hover:opacity-70"
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
