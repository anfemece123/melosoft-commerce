import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { SideSheet } from '@/components/ui/SideSheet';
import { Button } from '@/components/ui/Button';
import { normalizeSearchText } from '@/lib/storefront/searchText';
import {
  EMPTY_ADMIN_PRODUCT_FILTERS,
  LOW_STOCK_THRESHOLD,
  PRODUCT_ISSUE_LABELS,
  UNCATEGORIZED,
} from '@/features/products/adminProductList';
import type {
  AdminProductFilters,
  ProductImageFilter,
  ProductIssue,
  ProductStockFilter,
} from '@/features/products/adminProductList';
import type { StoreFacet } from '@/features/facets/facets.types';
import type { PublicStoreCategory, PublicStoreCollection } from '@/types/common.types';

interface ProductListFiltersSheetProps {
  open: boolean;
  onClose: () => void;
  filters: AdminProductFilters;
  onChange: (filters: AdminProductFilters) => void;
  categories: PublicStoreCategory[];
  collections: PublicStoreCollection[];
  facets: StoreFacet[];
  /** Products per category / collection / attribute value id. */
  optionCounts: Map<string, number>;
  resultCount: number;
  inquiryMode: boolean;
}

interface CheckOption {
  id: string;
  label: string;
  depth?: number;
}

const LONG_LIST = 8;

function Section({ title, count, defaultOpen = false, children }: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || count > 0);
  return (
    <section className="border-b border-gray-100 px-5 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">
          {title}
          {count > 0 && (
            <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">{count}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </section>
  );
}

function CheckList({ options, selected, onToggle, counts, searchLabel }: {
  options: CheckOption[];
  selected: string[];
  onToggle: (id: string) => void;
  counts: Map<string, number>;
  searchLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const long = options.length > LONG_LIST;
  const normalized = normalizeSearchText(query);
  const matching = normalized
    ? options.filter((option) => normalizeSearchText(option.label).includes(normalized))
    : options;
  const shown = long && !expanded && !normalized
    ? matching.filter((option, index) => index < LONG_LIST || selected.includes(option.id))
    : matching;

  return (
    <div>
      {long && (
        <label className="mb-2 flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${searchLabel}`}
            aria-label={`Buscar ${searchLabel}`}
            className="min-w-0 flex-1 bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-400"
          />
        </label>
      )}
      <ul className={expanded && !normalized ? 'max-h-72 space-y-0.5 overflow-y-auto pr-1' : 'space-y-0.5'}>
        {shown.map((option) => {
          const checked = selected.includes(option.id);
          const count = counts.get(option.id) ?? 0;
          return (
            <li key={option.id}>
              <label
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"
                style={{ paddingLeft: `${0.5 + (option.depth ?? 0) * 1.25}rem` }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={`min-w-0 flex-1 truncate ${checked ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{option.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-400">{count}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {normalized && matching.length === 0 && <p className="px-2 py-1.5 text-xs text-gray-400">Sin resultados</p>}
      {long && !normalized && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1.5 px-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
        >
          {expanded ? 'Ver menos' : `Ver todas (${options.length})`}
        </button>
      )}
    </div>
  );
}

function RadioList<T extends string>({ name, options, value, onChange }: {
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-0.5">
      {options.map((option) => (
        <label key={option.value || 'all'} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className={value === option.value ? 'font-medium text-gray-900' : undefined}>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function categoryOptions(categories: PublicStoreCategory[]): CheckOption[] {
  const roots = categories.filter((category) => !category.parentId);
  const options: CheckOption[] = [];
  for (const root of roots) {
    options.push({ id: root.id, label: root.name, depth: 0 });
    for (const child of categories.filter((category) => category.parentId === root.id)) {
      options.push({ id: child.id, label: child.name, depth: 1 });
    }
  }
  // Orphans (parent inactive/missing) still need to be selectable.
  const listed = new Set(options.map((option) => option.id));
  for (const category of categories) {
    if (!listed.has(category.id)) options.push({ id: category.id, label: category.name, depth: 0 });
  }
  options.push({ id: UNCATEGORIZED, label: 'Sin categoría', depth: 0 });
  return options;
}

/** Every refinement of the admin products list, applied live. */
export function ProductListFiltersSheet({
  open,
  onClose,
  filters,
  onChange,
  categories,
  collections,
  facets,
  optionCounts,
  resultCount,
  inquiryMode,
}: ProductListFiltersSheetProps) {
  const set = (patch: Partial<AdminProductFilters>) => onChange({ ...filters, ...patch });
  const issueOptions = (Object.keys(PRODUCT_ISSUE_LABELS) as ProductIssue[])
    .filter((issue) => !(inquiryMode && issue === 'no_price'));

  const stockOptions: { value: ProductStockFilter; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'in_stock', label: 'Con stock' },
    { value: 'low_stock', label: `Stock bajo (1 a ${LOW_STOCK_THRESHOLD})` },
    { value: 'out_of_stock', label: 'Agotados (0)' },
    { value: 'untracked', label: 'Sin control de inventario' },
  ];
  const imageOptions: { value: ProductImageFilter; label: string }[] = [
    { value: '', label: 'Todas' },
    { value: 'with', label: 'Con imagen' },
    { value: 'without', label: 'Sin imagen' },
  ];

  function reset() {
    onChange({ ...EMPTY_ADMIN_PRODUCT_FILTERS, query: filters.query, status: filters.status, sort: filters.sort });
  }

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title="Filtros"
      subtitle="Se aplican al instante sobre la lista."
      width="md"
      footer={(
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={reset} className="shrink-0">Limpiar filtros</Button>
          <Button onClick={onClose} className="min-w-0 flex-1">
            Ver {resultCount} {resultCount === 1 ? 'producto' : 'productos'}
          </Button>
        </div>
      )}
    >
      {categories.length > 0 && (
        <Section title="Categoría" count={filters.categoryIds.length} defaultOpen>
          <CheckList
            options={categoryOptions(categories)}
            selected={filters.categoryIds}
            onToggle={(id) => set({ categoryIds: toggle(filters.categoryIds, id) })}
            counts={optionCounts}
            searchLabel="categoría"
          />
        </Section>
      )}

      {facets.map((facet) => {
        const selected = filters.facetValueIds.filter((id) => facet.values.some((value) => value.id === id));
        return (
          <Section key={facet.id} title={facet.name} count={selected.length}>
            <CheckList
              options={facet.values.filter((value) => value.isActive).map((value) => ({ id: value.id, label: value.value }))}
              selected={filters.facetValueIds}
              onToggle={(id) => set({ facetValueIds: toggle(filters.facetValueIds, id) })}
              counts={optionCounts}
              searchLabel={facet.name.toLowerCase()}
            />
          </Section>
        );
      })}

      {collections.length > 0 && (
        <Section title="Colección" count={filters.collectionIds.length}>
          <CheckList
            options={collections.map((collection) => ({ id: collection.id, label: collection.name }))}
            selected={filters.collectionIds}
            onToggle={(id) => set({ collectionIds: toggle(filters.collectionIds, id) })}
            counts={optionCounts}
            searchLabel="colección"
          />
        </Section>
      )}

      <Section title="Calidad de la ficha" count={filters.issues.length}>
        <p className="mb-2 px-2 text-xs text-gray-500">Productos a los que les falta al menos uno de estos datos.</p>
        <CheckList
          options={issueOptions.map((issue) => ({ id: issue, label: PRODUCT_ISSUE_LABELS[issue] }))}
          selected={filters.issues}
          onToggle={(id) => set({ issues: toggle(filters.issues, id) as ProductIssue[] })}
          counts={optionCounts}
          searchLabel="dato"
        />
      </Section>

      <Section title="Inventario" count={filters.stock ? 1 : 0}>
        <RadioList name="stock" options={stockOptions} value={filters.stock} onChange={(stock) => set({ stock })} />
      </Section>

      <Section title="Imagen" count={filters.image ? 1 : 0}>
        <RadioList name="image" options={imageOptions} value={filters.image} onChange={(image) => set({ image })} />
      </Section>

      <Section title={inquiryMode ? 'Precio de referencia' : 'Precio'} count={(filters.priceMin !== null ? 1 : 0) + (filters.priceMax !== null ? 1 : 0)}>
        <div className="grid grid-cols-2 gap-2 px-2">
          {(['priceMin', 'priceMax'] as const).map((key) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs text-gray-500">{key === 'priceMin' ? 'Desde' : 'Hasta'}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={filters[key] ?? ''}
                onChange={(event) => {
                  const raw = event.target.value;
                  const value = raw === '' ? null : Math.max(0, Number(raw));
                  set({ [key]: Number.isFinite(value) ? value : null });
                }}
                onWheel={(event) => event.currentTarget.blur()}
                placeholder="$ 0"
                className="h-9 w-full rounded-lg border border-gray-300 px-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Otros" count={(filters.featured ? 1 : 0) + (filters.onSale ? 1 : 0) + (filters.withVariants ? 1 : 0)}>
        <div className="space-y-0.5">
          {([
            ['featured', 'Destacados'],
            ...(inquiryMode ? [] : [['onSale', 'Con descuento'] as const]),
            ['withVariants', 'Con variantes'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={() => set({ [key]: !filters[key] })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              {label}
            </label>
          ))}
        </div>
      </Section>
    </SideSheet>
  );
}
