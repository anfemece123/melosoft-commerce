import type { CSSProperties, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Package, UtensilsCrossed } from 'lucide-react';
import type { PublicProductPage } from '@/types/common.types';
import type { CatalogItem } from '@/lib/storefront/catalogItems';
import type { StorefrontTheme } from './storefrontTheme';
import { StorefrontMediaFrame } from './StorefrontMediaFrame';
import { StorefrontRatingStars } from './StorefrontRatingStars';
import { StorefrontActionButton } from './StorefrontActionButton';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { formatCurrency } from '@/utils/formatCurrency';
import { hasActiveDiscount, getActivePrice, calculateDiscountPercentage } from '@/lib/pricing/pricing.utils';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import { isLikelyPngAsset } from '@/lib/images/imageFormat';

interface StorefrontProductCardProps {
  item: CatalogItem;
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  isUnavailable: boolean;
  showCartButton: boolean;
  productCardCtaLabel: string;
  categoryLabel?: string | null;
  linkState?: unknown;
  onLinkClick?: () => void;
  onAddToCart?: (event: MouseEvent<HTMLElement>, product: PublicProductPage) => void;
  /** 'default' (home / featured products / cart recommendations — every
   * existing caller, unchanged) or 'large' (StoreCatalogPage only) — bumps
   * padding/typography/CTA height for more visual presence on the
   * catalog's wider, lower-column-count grid. The image itself already
   * scales with whatever width the grid gives the card either way (no
   * fixed pixel sizing anywhere in this component); this only affects the
   * text/CTA/padding scale, never the shared home-facing look. */
  size?: 'default' | 'large';
}

/** Single source of truth for rendering a catalog card — extracted fresh
 * (not by touching StoreCatalogPage.tsx, which keeps its own inline JSX
 * untouched to avoid any behavioral risk to the catalog) so the Home
 * Builder's "featured products" section and the legacy homepage fallback
 * grid share identical price/variant/stock/discount logic instead of a
 * third, diverging implementation. Takes a CatalogItem (from
 * buildCatalogItems) so variant products already resolve to "Desde $X"
 * and per-color/model cards exactly like the catalog. */
export function StorefrontProductCard({
  item,
  theme,
  storeSlug,
  currency,
  isMenu,
  isUnavailable,
  showCartButton,
  productCardCtaLabel,
  categoryLabel,
  linkState,
  onLinkClick,
  onAddToCart,
  size = 'default',
}: StorefrontProductCardProps) {
  const isLarge = size === 'large';
  const product = item.product;
  const cardHref = buildStorefrontPath(
    storeSlug,
    `/p/${product.productSlug}${item.optionValueId ? `?opt=${item.optionValueId}` : ''}`,
  );
  // Only swap on desktop hover, only when there's a real, distinct second
  // image to show — a single-image product (the common case today) falls
  // straight through to the exact same single StorefrontMediaFrame as
  // before, so nothing changes visually for it.
  const hasHoverSwap = Boolean(item.imageUrl) && Boolean(item.secondImageUrl) && item.secondImageUrl !== item.imageUrl;

  return (
    <Link
      to={cardHref}
      state={linkState}
      onClick={onLinkClick}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-transparent transition-all duration-200 hover:border-[var(--sf-card-border)] hover:shadow-md ${isUnavailable ? 'opacity-60' : ''}`}
      style={{ '--sf-card-border': theme.border } as CSSProperties}
    >
      <div className="relative">
        {hasHoverSwap ? (
          <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-transparent">
            <img
              src={item.imageUrl as string}
              alt={item.displayName}
              className={`h-full w-full transition-opacity duration-300 md:group-hover:opacity-0 ${
                isLikelyPngAsset(item.imageUrl)
                  ? 'object-cover p-0 drop-shadow-[0_10px_14px_rgba(15,23,42,0.08)]'
                  : 'object-cover'
              }`}
            />
            <img
              src={item.secondImageUrl as string}
              alt={item.displayName}
              className={`absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 md:group-hover:opacity-100 ${
                isLikelyPngAsset(item.secondImageUrl) ? 'p-0 drop-shadow-[0_10px_14px_rgba(15,23,42,0.08)]' : ''
              }`}
            />
          </div>
        ) : (
          <StorefrontMediaFrame
            src={item.imageUrl}
            alt={item.displayName}
            aspectClassName="aspect-square"
            roundedClassName="rounded-t-2xl"
            className="bg-transparent"
            imageClassName="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                {isMenu ? (
                  <UtensilsCrossed className="w-8 h-8 text-gray-300" />
                ) : (
                  <Package className="w-8 h-8 text-gray-300" />
                )}
              </div>
            }
          />
        )}
        {isUnavailable && (
          <div className="absolute inset-0 flex items-end pb-2 px-2">
            <span className="text-xs font-medium bg-black/60 text-white rounded-full px-2 py-0.5">
              {item.isOutOfStock && isMenu ? 'Agotado por el momento' : 'No disponible'}
            </span>
          </div>
        )}
        {!isUnavailable && !product.hasVariants && hasActiveDiscount(product.regularPrice, product.salePrice) && (
          <div className="absolute left-3 top-3">
            <DiscountBadge
              percentage={calculateDiscountPercentage(product.regularPrice, product.salePrice!)}
              size="md"
              className="px-3 py-1.5 text-sm shadow-lg"
            />
          </div>
        )}
      </div>

      <div className={`flex flex-1 flex-col ${isLarge ? 'p-4 sm:p-5' : 'p-3.5'}`}>
        <div className="min-h-4">
          {categoryLabel && (
            <span
              className={`font-semibold uppercase tracking-wide ${isLarge ? 'text-xs' : 'text-[11px]'}`}
              style={{ color: theme.primary }}
            >
              {categoryLabel}
            </span>
          )}
        </div>
        <p
          className={`mt-1 line-clamp-2 font-semibold ${isLarge ? 'min-h-[3rem] text-base leading-6' : 'min-h-[2.5rem] text-sm leading-5'}`}
          style={{ color: theme.text }}
        >
          {item.displayName}
        </p>
        <div className="min-h-[1rem] -mt-0.5">
          <StorefrontRatingStars theme={theme} rating={5} count={product.isFeatured ? 24 : 12} />
        </div>
        <div className={`mt-2 min-h-[2rem] ${isLarge ? 'min-h-[2.25rem]' : ''}`}>
          {product.hasVariants ? (
            <span className={`font-bold tracking-tight ${isLarge ? 'text-lg' : 'text-base'}`} style={{ color: theme.text }}>
              {item.minPrice !== item.maxPrice
                ? `Desde ${formatCurrency(item.minPrice, 'es-CO', currency)}`
                : formatCurrency(item.minPrice, 'es-CO', currency)}
            </span>
          ) : hasActiveDiscount(product.regularPrice, product.salePrice) ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`font-bold tracking-tight ${isLarge ? 'text-lg' : 'text-base'}`} style={{ color: theme.text }}>
                {formatCurrency(getActivePrice(product.regularPrice, product.salePrice), 'es-CO', currency)}
              </span>
              <span className="text-xs line-through" style={{ color: theme.mutedText }}>
                {formatCurrency(product.regularPrice, 'es-CO', currency)}
              </span>
            </div>
          ) : (
            <span className={`font-bold tracking-tight ${isLarge ? 'text-lg' : 'text-base'}`} style={{ color: theme.text }}>
              {formatCurrency(product.regularPrice, 'es-CO', currency)}
            </span>
          )}
        </div>

        {isUnavailable ? (
          <div
            className={`mt-3 flex items-center justify-center rounded-lg border text-xs font-medium ${isLarge ? 'h-11' : 'h-10'}`}
            style={{ borderColor: theme.border, color: theme.mutedText }}
          >
            {item.isOutOfStock
              ? (isMenu ? 'Agotado por el momento' : 'Agotado')
              : 'No disponible en esta sede'}
          </div>
        ) : product.hasVariants ? (
          <StorefrontActionButton
            as="div"
            theme={theme}
            variant="outline"
            fullWidth
            className={`mt-3 text-sm font-semibold ${isLarge ? 'h-11' : 'h-10'}`}
          >
            Ver opciones
          </StorefrontActionButton>
        ) : showCartButton ? (
          <StorefrontActionButton
            as="button"
            type="button"
            theme={theme}
            variant="outline"
            fullWidth
            className={`mt-3 text-sm font-semibold ${isLarge ? 'h-11' : 'h-10'}`}
            onClick={(event) => onAddToCart?.(event, product)}
          >
            {productCardCtaLabel}
          </StorefrontActionButton>
        ) : (
          <StorefrontActionButton
            as="div"
            theme={theme}
            variant="outline"
            fullWidth
            className={`mt-3 text-sm font-semibold ${isLarge ? 'h-11' : 'h-10'}`}
          >
            {productCardCtaLabel}
          </StorefrontActionButton>
        )}
      </div>
    </Link>
  );
}
