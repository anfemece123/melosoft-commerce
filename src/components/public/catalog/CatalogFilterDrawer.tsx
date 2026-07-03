import { X } from 'lucide-react';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
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
  resultCount: number;
}

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
  resultCount,
}: CatalogFilterDrawerProps) {
  if (!open) return null;

  function clearFilters() {
    onChange({ ...EMPTY_FILTERS, query: filters.query });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed bottom-0 right-0 top-0 z-50 flex w-[300px] max-w-[92vw] flex-col shadow-2xl"
        style={{ backgroundColor: theme.background }}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-5 py-4"
          style={{ borderColor: theme.border }}
        >
          <h2 className="text-base font-bold" style={{ color: theme.text }}>
            Filtros
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar filtros"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ backgroundColor: theme.surfaceAlt, color: theme.text }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
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
            className="w-full"
          />
        </div>

        {/* Footer */}
        <div
          className="flex shrink-0 items-center gap-3 border-t px-4 py-4"
          style={{ borderColor: theme.border }}
        >
          <button
            type="button"
            onClick={clearFilters}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceAlt }}
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.primary }}
          >
            Ver {resultCount} resultado{resultCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>
  );
}
