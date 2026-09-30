import { Fragment, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode, RefObject } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Clock, LayoutGrid, Loader2, Package, Search, Tag, X } from 'lucide-react';
import type { StorefrontTheme } from './storefrontTheme';
import { withAlpha } from './storefrontTheme';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { useWhatsappInquiryMode } from '@/lib/commerce/useWhatsappInquiryMode';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import { highlightSearchMatches } from '@/lib/storefront/searchText';
import { clearRecentSearches, readRecentSearches, saveRecentSearch } from '@/lib/storefront/recentSearches';
import { MIN_SEARCH_LENGTH, useProductSearchSuggestions } from '@/features/productSearch/useProductSearchSuggestions';
import type { ProductSearchSuggestionProduct, ProductSearchTerm } from '@/features/productSearch/productSearch.types';
import { formatCurrency } from '@/utils/formatCurrency';

export interface StorefrontSearchBoxProps {
  theme: StorefrontTheme;
  storeSlug: string;
  placeholder: string;
  className?: string;
  inputClassName: string;
  inputStyle: CSSProperties;
  /** `stretch`: panel as wide as the box. `end`: wider panel aligned to the
   * box's right edge, for narrow header boxes. */
  panelPlacement?: 'stretch' | 'end';
  inputRef?: RefObject<HTMLInputElement | null>;
  onMouseEnter?: () => void;
}

interface SearchOption {
  id: string;
  href: string;
  /** Text saved as a recent search when the option is chosen. */
  recentQuery: string | null;
  render: (active: boolean) => ReactNode;
}

function termHref(term: ProductSearchTerm): string {
  if (term.kind === 'facet' && term.facetSlug && term.valueSlug) {
    return `/catalog?f_${encodeURIComponent(term.facetSlug)}=${encodeURIComponent(term.valueSlug)}`;
  }
  if (term.categorySlug && term.parentCategorySlug) {
    return `/catalog?cat=${encodeURIComponent(term.parentCategorySlug)}&sub=${encodeURIComponent(term.categorySlug)}`;
  }
  return `/catalog?cat=${encodeURIComponent(term.categorySlug ?? '')}`;
}

function Highlighted({ text, query, color }: { text: string; query: string; color: string }) {
  return (
    <>
      {highlightSearchMatches(text, query).map((segment, index) =>
        segment.match ? (
          <mark key={index} className="bg-transparent font-semibold" style={{ color }}>
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function SuggestionSkeleton({ theme }: { theme: StorefrontTheme }) {
  return (
    <div className="space-y-1 p-2" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg" style={{ backgroundColor: theme.surfaceAlt }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded" style={{ backgroundColor: theme.surfaceAlt }} />
            <div className="h-2.5 w-1/3 animate-pulse rounded" style={{ backgroundColor: theme.surfaceAlt }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Header search with live suggestions: products with photo, brand and
 * price, brand/category shortcuts and a "see all results" link. Full
 * keyboard support (↑ ↓ Enter Esc) and ARIA combobox semantics. */
export function StorefrontSearchBox({
  theme,
  storeSlug,
  placeholder,
  className = '',
  inputClassName,
  inputStyle,
  panelPlacement = 'stretch',
  inputRef,
  onMouseEnter,
}: StorefrontSearchBoxProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const { branding } = usePublicStoreBranding();
  const inquiry = useWhatsappInquiryMode();
  const currency = branding?.currency ?? 'COP';

  const [query, setQuery] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);
  const [closedAtPath, setClosedAtPath] = useState(location.pathname + location.search);
  const rootRef = useRef<HTMLFormElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Keep the box in sync when the URL query changes elsewhere (catalog
  // search box, back/forward) — adjusting state during render, not in an
  // effect, per React's guidance.
  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    setQuery(urlQuery);
  }
  // Close after any navigation.
  const currentPath = location.pathname + location.search;
  if (currentPath !== closedAtPath) {
    setClosedAtPath(currentPath);
    setOpen(false);
    setActiveIndex(-1);
  }

  const suggestions = useProductSearchSuggestions(storeSlug, query, open);
  const shown = suggestions.data ?? suggestions.staleData;
  const trimmedQuery = query.trim();
  const showRecent = open && trimmedQuery.length < MIN_SEARCH_LENGTH && recent.length > 0;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function goTo(href: string, recentQuery: string | null) {
    if (recentQuery) setRecent(saveRecentSearch(storeSlug, recentQuery));
    setOpen(false);
    setActiveIndex(-1);
    (inputRef ?? localInputRef).current?.blur();
    void navigate(buildStorefrontPath(storeSlug, href));
  }

  function submitSearch(value: string) {
    const q = value.trim();
    goTo(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog', q || null);
  }

  function priceLabel(product: ProductSearchSuggestionProduct): ReactNode {
    if (inquiry.enabled || product.maxPrice <= 0) return null;
    if (product.hasVariants && product.minPrice !== product.maxPrice) {
      return <span>Desde {formatCurrency(product.minPrice, 'es-CO', currency)}</span>;
    }
    if (product.salePrice !== null && product.salePrice < product.regularPrice) {
      return (
        <span className="flex flex-col items-end leading-tight">
          <span>{formatCurrency(product.salePrice, 'es-CO', currency)}</span>
          <span className="text-[11px] font-normal line-through" style={{ color: theme.mutedText }}>
            {formatCurrency(product.regularPrice, 'es-CO', currency)}
          </span>
        </span>
      );
    }
    return <span>{formatCurrency(product.minPrice, 'es-CO', currency)}</span>;
  }

  function buildOptions(): SearchOption[] {
    const rowStyle = (active: boolean): CSSProperties => ({
      backgroundColor: active ? withAlpha(theme.primary, 0.08) : 'transparent',
      color: theme.text,
    });

    if (showRecent) {
      return recent.map((item, index) => ({
        id: `${listboxId}-recent-${index}`,
        href: `/catalog?q=${encodeURIComponent(item)}`,
        recentQuery: item,
        render: (active: boolean) => (
          <span className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm" style={rowStyle(active)}>
            <Clock className="h-4 w-4 shrink-0" style={{ color: theme.mutedText }} />
            <span className="min-w-0 flex-1 truncate">{item}</span>
          </span>
        ),
      }));
    }
    if (!shown || trimmedQuery.length < MIN_SEARCH_LENGTH) return [];

    const termOptions: SearchOption[] = shown.terms.map((term, index) => ({
      id: `${listboxId}-term-${index}`,
      href: termHref(term),
      recentQuery: null,
      render: (active: boolean) => (
        <span className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={rowStyle(active)}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: withAlpha(theme.primary, 0.1), color: theme.primary }}
          >
            {term.kind === 'category' ? <LayoutGrid className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: theme.mutedText }}>
              {term.groupLabel}
            </span>
            <span className="block truncate text-sm">
              <Highlighted text={term.label} query={trimmedQuery} color={theme.primary} />
            </span>
          </span>
          <span className="shrink-0 text-xs" style={{ color: theme.mutedText }}>
            {term.productCount} {term.productCount === 1 ? 'producto' : 'productos'}
          </span>
        </span>
      ),
    }));

    const productOptions: SearchOption[] = shown.products.map((product) => {
      const soldOut = !inquiry.enabled && (
        !product.isAvailable || (!product.hasVariants && product.trackInventory && product.stock <= 0)
      );
      const subtitle = [product.brand, product.categoryName].filter(Boolean).join(' · ');
      return {
        id: `${listboxId}-product-${product.productId}`,
        href: `/p/${encodeURIComponent(product.productSlug)}`,
        recentQuery: trimmedQuery,
        render: (active: boolean) => (
          <span className="flex items-center gap-3 rounded-xl px-2 py-2" style={rowStyle(active)}>
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
              style={{ borderColor: theme.border, backgroundColor: '#ffffff' }}
            >
              {product.mainImageUrl ? (
                <img
                  src={product.mainImageUrl}
                  alt=""
                  width={56}
                  height={56}
                  decoding="async"
                  className="h-full w-full object-contain"
                />
              ) : (
                <Package className="h-5 w-5" style={{ color: theme.mutedText }} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm leading-snug">
                <Highlighted text={product.productName} query={trimmedQuery} color={theme.primary} />
              </span>
              {(subtitle || soldOut) && (
                <span className="mt-0.5 block truncate text-xs" style={{ color: theme.mutedText }}>
                  {subtitle}
                  {soldOut ? `${subtitle ? ' · ' : ''}Agotado` : ''}
                </span>
              )}
            </span>
            <span className="shrink-0 text-right text-sm font-semibold">{priceLabel(product)}</span>
          </span>
        ),
      };
    });

    const viewAll: SearchOption[] = shown.total > 0
      ? [{
          id: `${listboxId}-all`,
          href: `/catalog?q=${encodeURIComponent(trimmedQuery)}`,
          recentQuery: trimmedQuery,
          render: (active: boolean) => (
            <span
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold"
              style={{ backgroundColor: active ? withAlpha(theme.primary, 0.12) : withAlpha(theme.primary, 0.06), color: theme.primary }}
            >
              {shown.total === 1 ? 'Ver el resultado' : `Ver los ${shown.total} resultados`}
              <ArrowRight className="h-4 w-4" />
            </span>
          ),
        }]
      : [];

    return [...termOptions, ...productOptions, ...viewAll];
  }

  // At most ~10 rows — cheap enough to rebuild on every render.
  const options = buildOptions();

  const termCount = !showRecent && shown ? shown.terms.length : 0;
  const productCount = !showRecent && shown ? shown.products.length : 0;
  const panelVisible = open && (showRecent || suggestions.active);
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!panelVisible) {
        setOpen(true);
        return;
      }
      if (options.length === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + step;
        if (next < -1) return options.length - 1;
        if (next >= options.length) return -1;
        return next;
      });
    } else if (event.key === 'Escape') {
      if (panelVisible) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      } else if (query) {
        setQuery('');
      }
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (activeOption) goTo(activeOption.href, activeOption.recentQuery);
    else submitSearch(query);
  }

  function renderSectionLabel(label: string, action?: ReactNode) {
    return (
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: theme.mutedText }}>
          {label}
        </span>
        {action}
      </div>
    );
  }

  function renderOption(option: SearchOption, index: number) {
    const active = index === activeIndex;
    return (
      <li
        key={option.id}
        id={option.id}
        role="option"
        aria-selected={active}
        onMouseEnter={() => setActiveIndex(index)}
        // mousedown (not click) keeps focus handling simple: the option
        // navigates before the input's blur can close the panel.
        onMouseDown={(event) => {
          event.preventDefault();
          goTo(option.href, option.recentQuery);
        }}
        className="cursor-pointer"
      >
        {option.render(active)}
      </li>
    );
  }

  const loadingWithoutResults = suggestions.loading && !shown;
  const noResults = !showRecent && suggestions.data && suggestions.data.total === 0 && suggestions.data.terms.length === 0;

  return (
    <form
      ref={rootRef}
      role="search"
      onSubmit={handleSubmit}
      className={`relative ${className}`}
      onMouseEnter={onMouseEnter}
    >
      <input
        ref={(node) => {
          localInputRef.current = node;
          if (inputRef) inputRef.current = node;
        }}
        type="search"
        role="combobox"
        aria-expanded={panelVisible}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption?.id}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          setRecent(readRecentSearches(storeSlug));
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${inputClassName} [&::-webkit-search-cancel-button]:hidden`}
        style={inputStyle}
      />
      <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {query && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery('');
              setActiveIndex(-1);
              (inputRef ?? localInputRef).current?.focus();
            }}
            className="rounded-full p-0.5 transition-opacity hover:opacity-70"
          >
            <X className="h-3.5 w-3.5" style={{ color: theme.mutedText }} />
          </button>
        )}
        <button type="submit" aria-label="Buscar" className="transition-opacity hover:opacity-70">
          {suggestions.loading
            ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.mutedText }} />
            : <Search className="h-4 w-4" style={{ color: theme.mutedText }} />}
        </button>
      </span>

      {panelVisible && (
        <div
          className={`absolute top-full z-[70] mt-2 overflow-hidden rounded-2xl border ${
            panelPlacement === 'end' ? 'right-0 w-[min(440px,calc(100vw-2rem))]' : 'inset-x-0'
          }`}
          style={{
            backgroundColor: theme.background,
            borderColor: theme.border,
            boxShadow: `0 24px 48px ${theme.shadow}`,
            color: theme.text,
          }}
        >
          <div className="max-h-[min(70vh,560px)] overflow-y-auto overscroll-contain p-1.5">
            {showRecent && renderSectionLabel(
              'Búsquedas recientes',
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  clearRecentSearches(storeSlug);
                  setRecent([]);
                }}
                className="text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: theme.primary }}
              >
                Borrar
              </button>,
            )}

            {loadingWithoutResults && <SuggestionSkeleton theme={theme} />}

            {suggestions.failed && !shown && (
              <p className="px-4 py-6 text-center text-sm" style={{ color: theme.mutedText }}>
                No pudimos cargar sugerencias. Presiona Enter para buscar.
              </p>
            )}

            {noResults && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium">Sin resultados para “{trimmedQuery}”</p>
                <p className="mt-1 text-xs" style={{ color: theme.mutedText }}>
                  Revisa la ortografía o prueba con menos palabras.
                </p>
              </div>
            )}

            <ul
              id={listboxId}
              role="listbox"
              aria-label="Sugerencias de búsqueda"
              className={`transition-opacity ${suggestions.loading && shown ? 'opacity-60' : ''}`}
            >
              {options.map((option, index) => (
                <Fragment key={option.id}>
                  {!showRecent && index === 0 && termCount > 0 && (
                    <li role="presentation">{renderSectionLabel('Sugerencias')}</li>
                  )}
                  {!showRecent && index === termCount && productCount > 0 && (
                    <li role="presentation">{renderSectionLabel('Productos')}</li>
                  )}
                  {renderOption(option, index)}
                </Fragment>
              ))}
            </ul>
          </div>
        </div>
      )}
    </form>
  );
}
