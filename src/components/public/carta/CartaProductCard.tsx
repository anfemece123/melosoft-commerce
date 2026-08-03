import { ImageIcon } from 'lucide-react';
import type { CartaProductImagePosition, CartaTemplateKey, PublicCartaProduct } from '@/features/carta/carta.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';
import { withAlpha } from '@/components/public/storefront/storefrontTheme';
import { isLikelyPngAsset } from '@/lib/images/imageFormat';
import { formatCurrency } from '@/utils/formatCurrency';

interface CartaProductCardProps {
  product: PublicCartaProduct;
  currency: string;
  theme: StorefrontTheme;
  variant?: CartaTemplateKey;
  showDescription?: boolean;
  showImage?: boolean;
  compact?: boolean;
  imagePosition?: CartaProductImagePosition;
}

function DishImageFallback({ theme }: { theme: StorefrontTheme }) {
  return (
    <div className="flex h-full min-h-full w-full items-center justify-center" style={{ background: `linear-gradient(145deg, ${theme.surfaceAlt}, ${theme.softPrimary})` }}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(theme.background, 0.75), color: theme.mutedText }}>
        <ImageIcon className="h-6 w-6" />
      </div>
    </div>
  );
}

/** Checkout-free dish presentation shared by the public carta and its
 * admin preview. Every variant reserves a real, prominent media area so
 * an existing gallery image is never reduced to a tiny list thumbnail. */
export function CartaProductCard({ product, currency, theme, variant = 'signature', showDescription = true, showImage = true, compact = false, imagePosition }: CartaProductCardProps) {
  const price = formatCurrency(product.price, 'es-CO', currency);
  const fallback = <DishImageFallback theme={theme} />;
  const hasVisibleImage = showImage && Boolean(product.imageUrl);
  const resolvedImagePosition = imagePosition ?? 'left';
  const imageOnRight = resolvedImagePosition === 'right';
  const imageIsPng = isLikelyPngAsset(product.imageUrl);

  if (!hasVisibleImage) {
    return (
      <article
        data-carta-editorial-product={variant === 'gallery' ? 'true' : undefined}
        className={`border-b ${compact ? 'py-3 sm:py-4' : 'py-4 sm:py-5'}`}
        style={{ borderColor: theme.border }}
      >
        <div className="flex items-baseline gap-2.5">
          <h3 className={`${variant === 'gallery' ? `${compact ? 'text-sm' : 'text-base sm:text-lg'} font-black tracking-tight` : `${compact ? 'text-sm' : ''} font-extrabold`} min-w-0 leading-5`} style={{ color: theme.text }}>
            {product.name}
          </h3>
          {variant === 'gallery' && (
            <span
              aria-hidden="true"
              className="min-w-4 flex-1 self-center border-t border-dashed opacity-70"
              style={{ borderColor: theme.border }}
            />
          )}
          <span className={`shrink-0 font-black ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: theme.primary }}>{price}</span>
        </div>
        {showDescription && product.shortDescription && (
          <p data-carta-product-description className={`mt-1.5 line-clamp-4 max-w-xl ${compact ? 'text-[11px] leading-4' : 'text-xs leading-5 sm:text-sm'}`} style={{ color: theme.mutedText }}>{product.shortDescription}</p>
        )}
      </article>
    );
  }

  if (variant === 'gallery') {
    return (
      <article
        data-carta-editorial-product="true"
        data-carta-product-image-position={resolvedImagePosition}
        className={`group grid min-h-36 items-center gap-3 border-b py-3 sm:min-h-44 sm:gap-6 sm:py-5 ${
          imageOnRight
            ? 'grid-cols-[minmax(0,1fr)_40%] sm:grid-cols-[minmax(0,1fr)_44%]'
            : 'grid-cols-[40%_minmax(0,1fr)] sm:grid-cols-[44%_minmax(0,1fr)]'
        }`}
        style={{ borderColor: theme.border }}
      >
        <div className={`relative isolate px-1 sm:px-3 ${imageOnRight ? 'order-2' : 'order-1'}`}>
          <StorefrontMediaFrame
            src={product.imageUrl}
            alt={product.name}
            fallback={fallback}
            aspectClassName="aspect-square w-full"
            roundedClassName={imageIsPng ? 'rounded-none' : 'rounded-[30%]'}
            className={imageIsPng ? '!overflow-visible' : ''}
            style={imageIsPng ? undefined : { backgroundColor: theme.surfaceAlt, boxShadow: `0 18px 42px ${theme.shadow}` }}
            imageClassName="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
            pngImageClassName="h-full w-full object-contain p-1 drop-shadow-[0_16px_20px_rgba(15,23,42,0.18)] transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-[1.025]"
          />
        </div>
        <div className={`flex min-w-0 flex-col justify-center py-1 text-left sm:py-3 ${imageOnRight ? 'order-1 pl-1 sm:pl-4' : 'order-2 pr-1 sm:pr-4'}`}>
          <span aria-hidden="true" className="mb-3 h-0.5 w-8 rounded-full sm:mb-4 sm:w-10" style={{ backgroundColor: theme.primary }} />
          <h3 className="text-base font-black leading-tight tracking-tight sm:text-xl" style={{ color: theme.text }}>{product.name}</h3>
          {showDescription && product.shortDescription && (
            <p data-carta-product-description className="mt-1.5 line-clamp-4 text-[11px] leading-4 sm:mt-2 sm:text-sm sm:leading-5" style={{ color: theme.mutedText }}>
              {product.shortDescription}
            </p>
          )}
          <p className="mt-3 text-sm font-black sm:mt-4 sm:text-base" style={{ color: theme.primary }}>{price}</p>
        </div>
      </article>
    );
  }

  if (variant === 'minimal') {
    return (
      <article
        data-carta-product-image-position={imagePosition ?? 'default'}
        className={`group grid min-h-28 items-center gap-3 border-b py-2 sm:gap-5 sm:py-3 ${imageOnRight ? 'grid-cols-[minmax(0,1fr)_104px] sm:grid-cols-[minmax(0,1fr)_124px]' : 'grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[124px_minmax(0,1fr)]'}`}
        style={{ borderColor: theme.border }}
      >
        <StorefrontMediaFrame
          src={product.imageUrl}
          alt={product.name}
          fallback={fallback}
          aspectClassName="aspect-square w-full shadow-lg"
          roundedClassName="rounded-full"
          className={imageOnRight ? 'order-2' : 'order-1'}
          imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          pngImageClassName="h-full w-full object-contain p-2 drop-shadow-[0_10px_14px_rgba(15,23,42,0.12)] transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className={`flex min-w-0 flex-col justify-center py-1 sm:py-2 ${imageOnRight ? 'order-1' : 'order-2'}`}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-extrabold leading-5" style={{ color: theme.text }}>{product.name}</h3>
            <span className="shrink-0 text-sm font-black" style={{ color: theme.primary }}>{price}</span>
          </div>
          {showDescription && product.shortDescription && <p data-carta-product-description className="mt-1.5 line-clamp-4 text-xs leading-5" style={{ color: theme.mutedText }}>{product.shortDescription}</p>}
        </div>
      </article>
    );
  }

  return (
    <article
      data-carta-product-image-position={imagePosition ?? 'default'}
      className={`group grid items-center gap-3 py-1 sm:min-h-40 sm:gap-6 sm:py-3 ${imageOnRight ? 'grid-cols-[minmax(0,1fr)_42%]' : 'grid-cols-[42%_minmax(0,1fr)]'}`}
    >
      <StorefrontMediaFrame
        src={product.imageUrl}
        alt={product.name}
        fallback={fallback}
        aspectClassName="aspect-square w-full shadow-xl"
        roundedClassName="rounded-full"
        className={imageOnRight ? 'order-2' : 'order-1'}
        imageClassName="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]"
        pngImageClassName="h-full w-full object-contain p-3 drop-shadow-[0_14px_18px_rgba(15,23,42,0.14)] transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]"
      />
      <div className={`flex min-w-0 flex-col justify-center py-1 sm:py-3 ${imageOnRight ? 'order-1 pl-2 sm:pl-5' : 'order-2 pr-2 sm:pr-5'}`}>
        <h3 className="text-lg font-extrabold leading-tight" style={{ color: theme.text }}>{product.name}</h3>
        {showDescription && product.shortDescription && <p data-carta-product-description className="mt-2 line-clamp-4 text-xs leading-5 sm:text-sm" style={{ color: theme.mutedText }}>{product.shortDescription}</p>}
        <p className="mt-4 text-base font-black" style={{ color: theme.primary }}>{price}</p>
      </div>
    </article>
  );
}
