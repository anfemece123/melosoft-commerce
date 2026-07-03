import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { CatalogFilters, FacetFilter } from './catalogFilter.types';
import type { PublicStoreCategory, PublicStoreCollection, PublicStoreFacet } from '@/types/common.types';
import { formatCurrency } from '@/utils/formatCurrency';

export interface CatalogFilterSidebarProps {
  theme: StorefrontTheme;
  filters: CatalogFilters;
  onChange: (f: CatalogFilters) => void;
  categories: PublicStoreCategory[];
  subcategories: PublicStoreCategory[];
  collections: PublicStoreCollection[];
  facets: PublicStoreFacet[];
  priceRange: { min: number; max: number };
  currency: string;
  className?: string;
}

function FilterSection({
  title,
  theme,
  children,
  defaultOpen = true,
}: {
  title: string;
  theme: StorefrontTheme;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b py-3" style={{ borderColor: theme.border }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold" style={{ color: theme.text }}>
          {title}
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: theme.mutedText }} />
          : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: theme.mutedText }} />}
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

function RadioItem({
  label,
  selected,
  theme,
  onClick,
}: {
  label: string;
  selected: boolean;
  theme: StorefrontTheme;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:opacity-80"
      style={{ backgroundColor: selected ? `${theme.primary}12` : 'transparent' }}
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
        style={{
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? theme.primary : 'transparent',
        }}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="text-sm truncate" style={{ color: selected ? theme.primary : theme.text }}>
        {label}
      </span>
    </button>
  );
}

function CheckboxItem({
  label,
  checked,
  theme,
  onClick,
}: {
  label: string;
  checked: boolean;
  theme: StorefrontTheme;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:opacity-80"
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors"
        style={{
          borderColor: checked ? theme.primary : theme.border,
          backgroundColor: checked ? theme.primary : 'transparent',
        }}
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-sm truncate" style={{ color: theme.text }}>
        {label}
      </span>
    </button>
  );
}

export function CatalogFilterSidebar({
  theme,
  filters,
  onChange,
  categories,
  subcategories,
  collections,
  facets,
  priceRange,
  currency,
  className = '',
}: CatalogFilterSidebarProps) {
  const [priceMinInput, setPriceMinInput] = useState(filters.priceMin?.toString() ?? '');
  const [priceMaxInput, setPriceMaxInput] = useState(filters.priceMax?.toString() ?? '');

  function set(patch: Partial<CatalogFilters>) {
    onChange({ ...filters, ...patch });
  }

  function getFacetValues(facetSlug: string): string[] {
    return filters.facets.filter((f) => f.facetSlug === facetSlug).map((f) => f.valueSlug);
  }

  function toggleFacetValue(facetSlug: string, valueSlug: string, isMulti: boolean) {
    const current = filters.facets;
    if (isMulti) {
      const exists = current.some((f) => f.facetSlug === facetSlug && f.valueSlug === valueSlug);
      const next: FacetFilter[] = exists
        ? current.filter((f) => !(f.facetSlug === facetSlug && f.valueSlug === valueSlug))
        : [...current, { facetSlug, valueSlug }];
      set({ facets: next });
    } else {
      const alreadySelected = current.some((f) => f.facetSlug === facetSlug && f.valueSlug === valueSlug);
      const withoutFacet = current.filter((f) => f.facetSlug !== facetSlug);
      const next: FacetFilter[] = alreadySelected ? withoutFacet : [...withoutFacet, { facetSlug, valueSlug }];
      set({ facets: next });
    }
  }

  function applyPriceRange() {
    const min = priceMinInput !== '' ? Number(priceMinInput) : null;
    const max = priceMaxInput !== '' ? Number(priceMaxInput) : null;
    set({ priceMin: min, priceMax: max });
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

  const visibleFacets = facets.filter((f) => f.showInCatalogFilters);

  return (
    <aside className={`w-56 shrink-0 ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold" style={{ color: theme.text }}>Filtros</h2>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => {
              onChange({ ...filters, categorySlug: '', subcategorySlug: '', collectionSlug: '', facets: [], priceMin: null, priceMax: null, onlyFeatured: false, onlyOnSale: false });
              setPriceMinInput('');
              setPriceMaxInput('');
            }}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: theme.primary }}
          >
            Limpiar todo
          </button>
        )}
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <FilterSection title="Categoría" theme={theme}>
          <RadioItem label="Todas" selected={!filters.categorySlug} theme={theme} onClick={() => set({ categorySlug: '', subcategorySlug: '' })} />
          {categories.map((cat) => (
            <RadioItem
              key={cat.id}
              label={cat.name}
              selected={filters.categorySlug === cat.slug}
              theme={theme}
              onClick={() => set({ categorySlug: filters.categorySlug === cat.slug ? '' : cat.slug, subcategorySlug: '' })}
            />
          ))}
        </FilterSection>
      )}

      {/* Subcategories */}
      {subcategories.length > 0 && (
        <FilterSection title="Subcategoría" theme={theme}>
          <RadioItem label="Todas" selected={!filters.subcategorySlug} theme={theme} onClick={() => set({ subcategorySlug: '' })} />
          {subcategories.map((sub) => (
            <RadioItem
              key={sub.id}
              label={sub.name}
              selected={filters.subcategorySlug === sub.slug}
              theme={theme}
              onClick={() => set({ subcategorySlug: filters.subcategorySlug === sub.slug ? '' : sub.slug })}
            />
          ))}
        </FilterSection>
      )}

      {/* Collections */}
      {collections.length > 0 && (
        <FilterSection title="Colección" theme={theme}>
          <RadioItem label="Todas" selected={!filters.collectionSlug} theme={theme} onClick={() => set({ collectionSlug: '' })} />
          {collections.map((col) => (
            <RadioItem
              key={col.id}
              label={col.name}
              selected={filters.collectionSlug === col.slug}
              theme={theme}
              onClick={() => set({ collectionSlug: filters.collectionSlug === col.slug ? '' : col.slug })}
            />
          ))}
        </FilterSection>
      )}

      {/* Facets */}
      {visibleFacets.map((facet) => {
        const isMulti = facet.inputType === 'multi_select';
        const selectedValues = getFacetValues(facet.slug);
        return (
          <FilterSection key={facet.id} title={facet.name} theme={theme} defaultOpen={facet.values.length <= 8}>
            {!isMulti && (
              <RadioItem label="Todos" selected={selectedValues.length === 0} theme={theme} onClick={() => set({ facets: filters.facets.filter((f) => f.facetSlug !== facet.slug) })} />
            )}
            {facet.values.map((val) => {
              const selected = selectedValues.includes(val.slug);
              return isMulti ? (
                <CheckboxItem key={val.id} label={val.value} checked={selected} theme={theme} onClick={() => toggleFacetValue(facet.slug, val.slug, true)} />
              ) : (
                <RadioItem key={val.id} label={val.value} selected={selected} theme={theme} onClick={() => toggleFacetValue(facet.slug, val.slug, false)} />
              );
            })}
          </FilterSection>
        );
      })}

      {/* Price range */}
      {priceRange.max > 0 && (
        <FilterSection title="Precio" theme={theme} defaultOpen={false}>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs mb-1" style={{ color: theme.mutedText }}>Desde</p>
                <input
                  type="number"
                  min={0}
                  value={priceMinInput}
                  onChange={(e) => setPriceMinInput(e.target.value)}
                  onBlur={applyPriceRange}
                  placeholder={formatCurrency(priceRange.min, 'es-CO', currency)}
                  className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
                  style={{ borderColor: theme.border, backgroundColor: theme.surfaceAlt, color: theme.text }}
                />
              </div>
              <div className="flex-1">
                <p className="text-xs mb-1" style={{ color: theme.mutedText }}>Hasta</p>
                <input
                  type="number"
                  min={0}
                  value={priceMaxInput}
                  onChange={(e) => setPriceMaxInput(e.target.value)}
                  onBlur={applyPriceRange}
                  placeholder={formatCurrency(priceRange.max, 'es-CO', currency)}
                  className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
                  style={{ borderColor: theme.border, backgroundColor: theme.surfaceAlt, color: theme.text }}
                />
              </div>
            </div>
          </div>
        </FilterSection>
      )}

      {/* Más filtros */}
      <FilterSection title="Más filtros" theme={theme} defaultOpen={false}>
        <CheckboxItem label="Destacados" checked={filters.onlyFeatured} theme={theme} onClick={() => set({ onlyFeatured: !filters.onlyFeatured })} />
        <CheckboxItem label="En oferta" checked={filters.onlyOnSale} theme={theme} onClick={() => set({ onlyOnSale: !filters.onlyOnSale })} />
      </FilterSection>
    </aside>
  );
}
