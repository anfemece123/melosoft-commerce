import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Edit, Package, Star, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { BRAND_FACET_SLUG } from '@/lib/storefront/brandFacet';
import {
  LOW_STOCK_THRESHOLD,
  PRODUCT_ISSUE_LABELS,
  getProductIssues,
  hasProductDiscount,
} from '@/features/products/adminProductList';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Product } from '@/features/products/products.types';
import { STATUS_BADGE } from './productStatus';

export type ProductListView = 'list' | 'grid';

interface ProductListViewsProps {
  view: ProductListView;
  products: Product[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectPage: () => void;
  pageSelection: 'none' | 'some' | 'all';
  onOpen: (product: Product) => void;
  categoryLabelById: Map<string, string>;
  currency: string;
  isMenu: boolean;
  inquiryMode: boolean;
  storeId: string;
}

const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function relativeDate(value: string): string {
  const diffMs = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return '—';
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeFormatter.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return relativeFormatter.format(months, 'month');
  return relativeFormatter.format(Math.round(months / 12), 'year');
}

function Thumb({ product, isMenu, size }: { product: Product; isMenu: boolean; size: 'sm' | 'lg' }) {
  const box = size === 'sm' ? 'h-11 w-11 rounded-lg' : 'aspect-square w-full rounded-xl';
  return (
    <div className={`${box} flex shrink-0 items-center justify-center overflow-hidden border border-gray-100 bg-white`}>
      {product.mainImageUrl ? (
        <img
          src={product.mainImageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          width={size === 'sm' ? 44 : 240}
          height={size === 'sm' ? 44 : 240}
          className="h-full w-full object-contain"
        />
      ) : isMenu ? (
        <UtensilsCrossed className="h-5 w-5 text-gray-300" />
      ) : (
        <Package className="h-5 w-5 text-gray-300" />
      )}
    </div>
  );
}

function Price({ product, currency, inquiryMode }: { product: Product; currency: string; inquiryMode: boolean }) {
  if (inquiryMode) {
    return product.regularPrice > 0
      ? <span className="text-gray-500">{formatCurrency(product.regularPrice, 'es-CO', currency)}</span>
      : <span className="text-gray-400">Consultar</span>;
  }
  if (hasProductDiscount(product)) {
    return (
      <span className="flex flex-col items-end leading-tight">
        <span className="font-semibold text-gray-900">{formatCurrency(product.salePrice as number, 'es-CO', currency)}</span>
        <span className="text-xs text-gray-400 line-through">{formatCurrency(product.regularPrice, 'es-CO', currency)}</span>
      </span>
    );
  }
  return <span className="font-semibold text-gray-900">{formatCurrency(product.regularPrice, 'es-CO', currency)}</span>;
}

function Stock({ product }: { product: Product }) {
  if (product.hasVariants) return <span className="text-gray-500">Variantes</span>;
  if (!product.trackInventory) return <span className="text-gray-400">—</span>;
  const tone = product.stock <= 0
    ? 'bg-red-50 text-red-700'
    : product.stock <= LOW_STOCK_THRESHOLD ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-700';
  return <span className={`inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>{product.stock}</span>;
}

function StatusBadges({ product, isMenu }: { product: Product; isMenu: boolean }) {
  const status = STATUS_BADGE[product.status] ?? { label: product.status, variant: 'neutral' as const };
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge variant={status.variant}>{status.label}</Badge>
      {product.status === 'active' && !product.isAvailable && (
        <Badge variant="warning">{isMenu ? 'Agotado' : 'No disponible'}</Badge>
      )}
    </span>
  );
}

function IssuesDot({ product, inquiryMode }: { product: Product; inquiryMode: boolean }) {
  const issues = getProductIssues(product, { requirePrice: !inquiryMode });
  if (issues.length === 0) return null;
  const label = `Ficha incompleta: ${issues.map((issue) => PRODUCT_ISSUE_LABELS[issue].toLowerCase()).join(', ')}`;
  return (
    <span title={label} aria-label={label} className="inline-flex shrink-0 text-amber-500">
      <AlertTriangle className="h-3.5 w-3.5" />
    </span>
  );
}

function brandOf(product: Product): string | null {
  return product.facetValues.find((value) => value.facetSlug === BRAND_FACET_SLUG)?.value ?? null;
}

function openOnKey(event: KeyboardEvent, open: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    open();
  }
}

const checkboxClass = 'h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500';

const ListRow = memo(function ListRow({ product, selected, onToggleSelect, onOpen, categoryLabel, currency, isMenu, inquiryMode, storeId }: {
  product: Product;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (product: Product) => void;
  categoryLabel: string;
  currency: string;
  isMenu: boolean;
  inquiryMode: boolean;
  storeId: string;
}) {
  const brand = brandOf(product);
  const meta = [product.sku, brand].filter(Boolean).join(' · ');
  return (
    <tr
      tabIndex={0}
      onClick={() => onOpen(product)}
      onKeyDown={(event) => openOnKey(event, () => onOpen(product))}
      aria-label={`Ver detalle de ${product.name}`}
      className={`cursor-pointer outline-none transition-colors hover:bg-gray-50 focus-visible:bg-indigo-50/60 ${selected ? 'bg-indigo-50/50' : ''}`}
    >
      <td className="w-10 py-2.5 pl-4 pr-1" onClick={(event) => event.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(product.id)} aria-label={`Seleccionar ${product.name}`} className={checkboxClass} />
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex min-w-0 items-center gap-3">
          <Thumb product={product} isMenu={isMenu} size="sm" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium text-gray-900">{product.name}</span>
              {product.isFeatured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Destacado" />}
              <IssuesDot product={product} inquiryMode={inquiryMode} />
            </div>
            {meta && <p className="truncate text-xs text-gray-500">{meta}</p>}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5"><StatusBadges product={product} isMenu={isMenu} /></td>
      <td className="hidden max-w-[12rem] truncate px-3 py-2.5 text-sm text-gray-600 lg:table-cell">{categoryLabel || <span className="text-gray-400">—</span>}</td>
      <td className="px-3 py-2.5 text-right text-sm"><Price product={product} currency={currency} inquiryMode={inquiryMode} /></td>
      <td className="px-3 py-2.5 text-center text-sm"><Stock product={product} /></td>
      <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-gray-500 xl:table-cell">{relativeDate(product.updatedAt)}</td>
      <td className="py-2.5 pl-2 pr-4 text-right" onClick={(event) => event.stopPropagation()}>
        <Link
          to={`/admin/stores/${storeId}/products/${product.id}/edit`}
          aria-label={`Editar ${product.name}`}
          title="Editar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-indigo-600"
        >
          <Edit className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
});

const MobileRow = memo(function MobileRow({ product, selected, onToggleSelect, onOpen, currency, isMenu, inquiryMode }: {
  product: Product;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (product: Product) => void;
  currency: string;
  isMenu: boolean;
  inquiryMode: boolean;
}) {
  return (
    <li className={`flex items-center gap-3 px-3 py-3 ${selected ? 'bg-indigo-50/50' : ''}`}>
      <input type="checkbox" checked={selected} onChange={() => onToggleSelect(product.id)} aria-label={`Seleccionar ${product.name}`} className={checkboxClass} />
      <button type="button" onClick={() => onOpen(product)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Thumb product={product} isMenu={isMenu} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-gray-900">{product.name}</span>
            <IssuesDot product={product} inquiryMode={inquiryMode} />
          </span>
          <span className="mt-1 flex items-center justify-between gap-2">
            <StatusBadges product={product} isMenu={isMenu} />
            <span className="flex items-center gap-2 text-sm">
              <Price product={product} currency={currency} inquiryMode={inquiryMode} />
              <Stock product={product} />
            </span>
          </span>
        </span>
      </button>
    </li>
  );
});

const GridCard = memo(function GridCard({ product, selected, onToggleSelect, onOpen, currency, isMenu, inquiryMode }: {
  product: Product;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (product: Product) => void;
  currency: string;
  isMenu: boolean;
  inquiryMode: boolean;
}) {
  const brand = brandOf(product);
  return (
    <li className={`group relative rounded-2xl border bg-white p-3 transition-shadow hover:shadow-md ${selected ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-gray-200'}`}>
      <label className="absolute left-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 shadow-sm">
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(product.id)} aria-label={`Seleccionar ${product.name}`} className={checkboxClass} />
      </label>
      {product.isFeatured && (
        <Star className="absolute right-4 top-4 z-10 h-4 w-4 fill-amber-400 text-amber-400" aria-label="Destacado" />
      )}
      <button type="button" onClick={() => onOpen(product)} className="block w-full text-left">
        <Thumb product={product} isMenu={isMenu} size="lg" />
        <span className="mt-2.5 block">
          {brand && <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500">{brand}</span>}
          <span className="flex items-start gap-1">
            <span className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">{product.name}</span>
            <IssuesDot product={product} inquiryMode={inquiryMode} />
          </span>
          <span className="mt-2 flex items-center justify-between gap-2">
            <StatusBadges product={product} isMenu={isMenu} />
            <Stock product={product} />
          </span>
          <span className="mt-1.5 block text-sm"><Price product={product} currency={currency} inquiryMode={inquiryMode} /></span>
        </span>
      </button>
    </li>
  );
});

/** Table (desktop), compact rows (phone) or photo grid of the current page. */
export function ProductListViews({
  view,
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectPage,
  pageSelection,
  onOpen,
  categoryLabelById,
  currency,
  isMenu,
  inquiryMode,
  storeId,
}: ProductListViewsProps) {
  if (view === 'grid') {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <GridCard
            key={product.id}
            product={product}
            selected={selectedIds.has(product.id)}
            onToggleSelect={onToggleSelect}
            onOpen={onOpen}
            currency={currency}
            isMenu={isMenu}
            inquiryMode={inquiryMode}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <ul className="divide-y divide-gray-100 md:hidden">
        {products.map((product) => (
          <MobileRow
            key={product.id}
            product={product}
            selected={selectedIds.has(product.id)}
            onToggleSelect={onToggleSelect}
            onOpen={onOpen}
            currency={currency}
            isMenu={isMenu}
            inquiryMode={inquiryMode}
          />
        ))}
      </ul>

      <table className="hidden w-full table-fixed md:table">
        <colgroup>
          <col className="w-10" />
          <col />
          <col className="w-36" />
          <col className="hidden w-44 lg:table-column" />
          <col className="w-32" />
          <col className="w-20" />
          <col className="hidden w-32 xl:table-column" />
          <col className="w-14" />
        </colgroup>
        <thead className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="py-2.5 pl-4 pr-1">
              <input
                type="checkbox"
                checked={pageSelection === 'all'}
                ref={(node) => {
                  if (node) node.indeterminate = pageSelection === 'some';
                }}
                onChange={onToggleSelectPage}
                aria-label="Seleccionar los productos de esta página"
                className={checkboxClass}
              />
            </th>
            <th className="py-2.5 pr-3">{isMenu ? 'Plato' : 'Producto'}</th>
            <th className="px-3 py-2.5">Estado</th>
            <th className="hidden px-3 py-2.5 lg:table-cell">Categoría</th>
            <th className="px-3 py-2.5 text-right">{inquiryMode ? 'Referencia' : 'Precio'}</th>
            <th className="px-3 py-2.5 text-center">{isMenu ? 'Unid.' : 'Stock'}</th>
            <th className="hidden px-3 py-2.5 xl:table-cell">Editado</th>
            <th className="py-2.5 pl-2 pr-4"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((product) => (
            <ListRow
              key={product.id}
              product={product}
              selected={selectedIds.has(product.id)}
              onToggleSelect={onToggleSelect}
              onOpen={onOpen}
              categoryLabel={product.categoryId ? categoryLabelById.get(product.categoryId) ?? '' : ''}
              currency={currency}
              isMenu={isMenu}
              inquiryMode={inquiryMode}
              storeId={storeId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
