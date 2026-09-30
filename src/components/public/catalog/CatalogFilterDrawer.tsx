import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { CatalogFilterSidebar } from './CatalogFilterSidebar';
import type { CatalogFilters } from './catalogFilter.types';
import { EMPTY_FILTERS } from './catalogFilter.types';
import type { PublicStoreCategory, PublicStoreCollection, PublicStoreFacet } from '@/types/common.types';

interface CatalogFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  theme: StorefrontTheme;
  filters: CatalogFilters;
  onChange: (f: CatalogFilters) => void;
  categories: PublicStoreCategory[];
  subcategories: PublicStoreCategory[];
  collections: PublicStoreCollection[];
  facets: PublicStoreFacet[];
  priceRange: { min: number; max: number };
  currency: string;
  hidePricing?: boolean;
  resultCount: number;
  /** More results may still be loading ("24+"). */
  resultCountIsPartial?: boolean;
  /** Results for the current filters are still loading. */
  loading?: boolean;
  activeFilterCount: number;
  /** After the exit animation, once the page scroll has been restored. */
  onExited?: () => void;
}

/** Mobile filter sheet. Rendered in a portal (so no ancestor transform,
 * overflow or z-index can clip it or make it scroll with the page), with
 * the page frozen behind it, its own contained scroll, a footer that
 * always stays on screen above the iPhone home indicator, Esc/scrim to
 * close and focus returned to the button that opened it. */
export function CatalogFilterDrawer({
  open,
  onClose,
  theme,
  filters,
  onChange,
  categories,
  subcategories,
  collections,
  facets,
  priceRange,
  currency,
  hidePricing = false,
  resultCount,
  resultCountIsPartial = false,
  loading = false,
  activeFilterCount,
  onExited,
}: CatalogFilterDrawerProps) {
  // Stays mounted while the exit animation plays.
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useBodyScrollLock(rendered);

  // The parent passes a new onClose every render; reading it through an
  // effect event keeps this effect (focus + Esc) tied to `open` only.
  const requestClose = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus({ preventScroll: true });
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  // Runs after useBodyScrollLock's cleanup (cleanups run before effects),
  // so the parent can scroll without the restored position overriding it.
  const notifyExited = useEffectEvent(() => onExited?.());
  const wasRenderedRef = useRef(rendered);
  useEffect(() => {
    if (rendered) {
      wasRenderedRef.current = true;
    } else if (wasRenderedRef.current) {
      wasRenderedRef.current = false;
      notifyExited();
    }
  }, [rendered]);

  if (!rendered) return null;

  const state = open ? 'open' : 'closed';
  const resultLabel = `${resultCount}${resultCountIsPartial ? '+' : ''}`;

  return createPortal(
    <div className="fixed inset-0 z-[80] lg:hidden">
      <div
        className="ui-scrim absolute inset-0 bg-black/45"
        data-state={state}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="ui-sheet absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col shadow-2xl will-change-transform"
        data-state={state}
        onAnimationEnd={() => {
          if (!open) setRendered(false);
        }}
        style={{ backgroundColor: theme.background, color: theme.text }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-filter-drawer-title"
      >
        <div
          className="flex shrink-0 items-center justify-between border-b px-5 pb-3.5"
          style={{ borderColor: theme.border, paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-baseline gap-2">
            <h2 id="catalog-filter-drawer-title" className="text-lg font-bold">
              Filtros
            </h2>
            {activeFilterCount > 0 && (
              <span className="text-sm font-medium" style={{ color: theme.primary }}>
                {activeFilterCount} {activeFilterCount === 1 ? 'activo' : 'activos'}
              </span>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar filtros"
            className="flex h-10 w-10 items-center justify-center rounded-full outline-none transition-opacity hover:opacity-70 focus-visible:ring-2"
            style={{ backgroundColor: theme.surfaceAlt, color: theme.text }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 [-webkit-overflow-scrolling:touch]">
          <CatalogFilterSidebar
            theme={theme}
            filters={filters}
            onChange={onChange}
            categories={categories}
            subcategories={subcategories}
            collections={collections}
            facets={facets}
            priceRange={priceRange}
            currency={currency}
            hidePricing={hidePricing}
            showTitle={false}
            className="w-full"
          />
        </div>

        <div
          className="flex shrink-0 items-center gap-3 border-t px-5 pt-3"
          style={{
            borderColor: theme.border,
            backgroundColor: theme.background,
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
            disabled={activeFilterCount === 0}
            className="h-12 shrink-0 rounded-xl border px-5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceAlt }}
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 min-w-0 flex-1 truncate whitespace-nowrap rounded-xl px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.primary }}
          >
            {loading
              ? 'Cargando resultados…'
              : resultCount === 0 && !resultCountIsPartial
              ? 'Sin resultados'
              : `Ver ${resultLabel} ${resultCount === 1 && !resultCountIsPartial ? 'resultado' : 'resultados'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
