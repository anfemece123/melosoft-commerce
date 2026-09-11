import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ChevronRight, Package, Plus, Sparkles, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StorefrontProductCard } from '@/components/public/storefront/StorefrontProductCard';
import { StorefrontProductGridSkeleton } from '@/components/public/storefront/StorefrontSkeletons';
import { Skeleton } from '@/components/ui/Skeleton';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { productsService } from '@/features/products/productsService';
import type { PublicProductPage } from '@/types/common.types';
import { buildCatalogItems } from '@/lib/storefront/catalogItems';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import { formatCurrency } from '@/utils/formatCurrency';
import { getActivePrice } from '@/lib/pricing/pricing.utils';

interface CartRecommendationsSectionProps {
  className?: string;
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  excludedProductIds: string[];
  unavailableProductIds: Set<string>;
  showCartButton: boolean;
  /** The drawer uses the same product source but a denser, rail/carousel
   * presentation so it can live comfortably beside the compact cart. */
  layout?: 'page' | 'drawer';
  onAddProduct?: (product: PublicProductPage) => void;
  onAddToCart?: (event: MouseEvent<HTMLElement>, product: PublicProductPage) => void;
}

export function CartRecommendationsSection({
  className,
  theme,
  storeSlug,
  currency,
  excludedProductIds,
  unavailableProductIds,
  showCartButton,
  layout = 'page',
  isMenu = false,
  onAddProduct,
  onAddToCart,
}: CartRecommendationsSectionProps) {
  const [products, setProducts] = useState<PublicProductPage[]>([]);
  const [loadedStoreSlug, setLoadedStoreSlug] = useState<string | null>(null);
  const loaded = loadedStoreSlug === storeSlug;

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      try {
        const featuredResult = await productsService.searchPublicCatalogPage({
          storeSlug,
          onlyFeatured: true,
          sortKey: 'featured',
          offset: 0,
          limit: 12,
        });

        if (cancelled) return;

        if (featuredResult.products.length >= 4) {
          setProducts(featuredResult.products);
          return;
        }

        const fallbackResult = await productsService.searchPublicCatalogPage({
          storeSlug,
          sortKey: 'newest',
          offset: 0,
          limit: 12,
        });

        if (cancelled) return;

        const merged = [...featuredResult.products];
        for (const product of fallbackResult.products) {
          if (!merged.some((item) => item.productId === product.productId)) {
            merged.push(product);
          }
        }
        setProducts(merged);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoadedStoreSlug(storeSlug);
      }
    }

    void loadRecommendations();

    return () => { cancelled = true; };
  }, [storeSlug]);

  const excludedIdsSet = useMemo(() => new Set(excludedProductIds), [excludedProductIds]);
  const items = useMemo(
    () => buildCatalogItems(products.filter((product) => !excludedIdsSet.has(product.productId)))
      .slice(0, 4),
    [products, excludedIdsSet]
  );
  const sectionClassName = layout === 'drawer'
    ? `${className ?? ''} shrink-0 border-t lg:absolute lg:right-full lg:top-0 lg:flex lg:h-full lg:w-[248px] lg:flex-col lg:border-t-0 lg:border-r`
    : `${className ?? 'mt-16'} border-t pt-10`;

  function renderDrawerProduct(item: ReturnType<typeof buildCatalogItems>[number]) {
    const product = item.product;
    const isUnavailable = unavailableProductIds.has(product.productId) || item.isOutOfStock;
    const needsConfiguration = product.hasVariants || product.hasOptions;
    const cardHref = buildStorefrontPath(storeSlug, `/p/${product.productSlug}`);

    return (
      <article
        key={item.id}
        className="flex h-[78px] w-[230px] shrink-0 items-center gap-2.5 rounded-2xl border p-2 lg:block lg:h-auto lg:w-auto lg:p-2.5"
        style={{ borderColor: theme.border, backgroundColor: theme.surface }}
      >
        <Link to={cardHref} className="group flex min-w-0 flex-1 items-center gap-2.5 lg:block">
          <StorefrontMediaFrame
            src={item.imageUrl}
            alt={item.displayName}
            aspectClassName="aspect-square"
            roundedClassName="rounded-xl"
            className="h-14 w-14 shrink-0 bg-transparent lg:h-auto lg:w-auto"
            imageClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            fallback={
              <div className="flex h-full w-full items-center justify-center" style={{ color: theme.primary }}>
                {isMenu ? <UtensilsCrossed className="h-7 w-7 opacity-45" /> : <Package className="h-7 w-7 opacity-45" />}
              </div>
            }
          />
          <p className="line-clamp-2 min-h-0 text-xs font-semibold leading-4 lg:mt-2 lg:min-h-10 lg:text-sm lg:leading-5" style={{ color: theme.text }}>
            {item.displayName}
          </p>
        </Link>
        <p className="shrink-0 whitespace-nowrap text-xs font-bold lg:mt-1 lg:text-sm" style={{ color: theme.primary }}>
          {product.hasVariants
            ? (item.minPrice !== item.maxPrice
              ? `Desde ${formatCurrency(item.minPrice, 'es-CO', currency)}`
              : formatCurrency(item.minPrice, 'es-CO', currency))
            : formatCurrency(getActivePrice(product.regularPrice, product.salePrice), 'es-CO', currency)}
        </p>
        {isUnavailable ? (
          <span className="block shrink-0 rounded-xl px-2 py-2 text-center text-[11px] font-semibold lg:mt-2" style={{ backgroundColor: theme.surfaceAlt, color: theme.mutedText }}>
            No disponible
          </span>
        ) : needsConfiguration ? (
          <Link
            to={cardHref}
            className="flex h-8 w-8 shrink-0 items-center justify-center gap-1 rounded-full text-xs font-semibold lg:mt-2 lg:h-9 lg:w-full lg:rounded-xl"
            style={{ backgroundColor: theme.softPrimary, color: theme.primary }}
          >
            <span className="hidden lg:inline">Ver opciones</span><ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center gap-1 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 lg:mt-2 lg:h-9 lg:w-full lg:rounded-xl"
            style={{ backgroundColor: theme.primary }}
            disabled={!showCartButton}
            onClick={() => onAddProduct?.(product)}
          >
            <Plus className="h-3.5 w-3.5" /><span className="hidden lg:inline">Agregar</span>
          </button>
        )}
      </article>
    );
  }

  if (!loaded) {
    if (layout === 'drawer') {
      return (
        <section className={`${sectionClassName} px-5 py-4`} style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
          <Skeleton className="h-4 w-44 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
          <div className="mt-3 flex gap-3 overflow-hidden lg:flex-col">
            <Skeleton className="h-[74px] w-[220px] shrink-0 rounded-2xl lg:h-56 lg:w-full" style={{ backgroundColor: theme.surfaceAlt }} />
            <Skeleton className="hidden h-56 w-full rounded-2xl lg:block" style={{ backgroundColor: theme.surfaceAlt }} />
          </div>
        </section>
      );
    }
    return (
      <section className={sectionClassName} style={{ borderColor: theme.border }}>
        <div className="mb-6">
          <Skeleton className="h-3 w-40 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
        </div>
        <StorefrontProductGridSkeleton theme={theme} isMenu={isMenu} columnsClassName="grid-cols-2 lg:grid-cols-4" count={4} />
      </section>
    );
  }

  if (items.length === 0) return null;

  if (layout === 'drawer') {
    return (
      <section className={`${sectionClassName} px-4 py-3 lg:py-4`} style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
        <div className="mb-2 flex items-center justify-between gap-3 lg:mb-3 lg:block">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 lg:h-4 lg:w-4" style={{ color: theme.primary }} />
            <p className="text-xs font-bold uppercase tracking-[0.1em] lg:text-sm lg:tracking-[0.12em]" style={{ color: theme.text }}>
              También te puede interesar
            </p>
          </div>
          <p className="mt-1 hidden text-xs lg:block" style={{ color: theme.mutedText }}>
            Completa tu pedido con algo más.
          </p>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory lg:mx-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:px-0 lg:pb-0">
          {items.map((item) => (
            <div key={item.id} className="snap-start lg:shrink-0">
              {renderDrawerProduct(item)}
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <p className="mt-2 text-center text-[11px] lg:hidden" style={{ color: theme.mutedText }}>
            Desliza para ver más productos
          </p>
        )}
      </section>
    );
  }

  return (
    <section className={sectionClassName} style={{ borderColor: theme.border }}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ color: theme.mutedText }}
          >
            También te puede interesar
          </p>
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {items.map((item) => {
          const product = item.product;
          const isUnavailable = unavailableProductIds.has(product.productId) || item.isOutOfStock;
          return (
            <div key={item.id} className="w-[74%] shrink-0 snap-start sm:w-[46%] lg:w-auto lg:shrink">
              <StorefrontProductCard
                item={item}
                theme={theme}
                storeSlug={storeSlug}
                currency={currency}
                isMenu={isMenu}
                isUnavailable={isUnavailable}
                showCartButton={showCartButton}
                productCardCtaLabel={showCartButton ? 'Agregar' : 'Ver producto'}
                categoryLabel={product.categoryName}
                onAddToCart={onAddToCart}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
