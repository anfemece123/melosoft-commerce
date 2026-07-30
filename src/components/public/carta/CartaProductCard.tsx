import { ImageIcon } from 'lucide-react';
import type { CartaProductImagePosition, CartaTemplateKey, PublicCartaProduct } from '@/features/carta/carta.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';
import { withAlpha } from '@/components/public/storefront/storefrontTheme';
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
  const imageOnRight = imagePosition === 'right';

  if (!hasVisibleImage) {
    return (
      <article
        className={`border-b ${compact ? 'py-3 sm:py-4' : `py-4 sm:py-5 ${variant === 'gallery' ? 'sm:py-6' : ''}`}`}
        style={{ borderColor: theme.border }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <h3 className={`${variant === 'gallery' ? `${compact ? 'text-sm' : 'text-base'} font-black uppercase tracking-[0.04em]` : `${compact ? 'text-sm' : ''} font-extrabold`} min-w-0 flex-[1_1_110px] leading-5`} style={{ color: theme.text }}>
            {product.name}
          </h3>
          <span className={`shrink-0 font-black ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: theme.primary }}>{price}</span>
        </div>
        {showDescription && product.shortDescription && (
          <p data-carta-product-description className={`mt-1.5 line-clamp-4 max-w-xl ${compact ? 'text-[11px] leading-4' : 'text-xs leading-5 sm:text-sm'}`} style={{ color: theme.mutedText }}>{product.shortDescription}</p>
        )}
      </article>
    );
  }

  if (variant === 'gallery' && imagePosition) {
    return (
      <article
        data-carta-product-image-position={imagePosition}
        className={`group grid min-h-36 overflow-hidden rounded-2xl border ${imageOnRight ? 'grid-cols-[minmax(0,1fr)_42%]' : 'grid-cols-[42%_minmax(0,1fr)]'}`}
        style={{ backgroundColor: withAlpha(theme.surface, 0.7), borderColor: theme.border }}
      >
        <StorefrontMediaFrame
          src={product.imageUrl}
          alt={product.name}
          fallback={fallback}
          aspectClassName="h-full min-h-36 w-full"
          roundedClassName="rounded-none"
          className={imageOnRight ? 'order-2' : 'order-1'}
          style={{ backgroundColor: theme.surfaceAlt }}
          imageClassName="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          pngImageClassName="h-full w-full object-contain p-3 drop-shadow-[0_14px_18px_rgba(15,23,42,0.14)] transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        <div className={`flex min-w-0 flex-col justify-center p-4 text-left ${imageOnRight ? 'order-1' : 'order-2'}`}>
          <h3 className="text-sm font-black uppercase leading-tight tracking-[0.03em]" style={{ color: theme.text }}>{product.name}</h3>
          {showDescription && product.shortDescription && <p data-carta-product-description className="mt-1.5 line-clamp-4 text-[11px] leading-4" style={{ color: theme.mutedText }}>{product.shortDescription}</p>}
          <span className="mt-3 text-sm font-black" style={{ color: theme.primary }}>{price}</span>
        </div>
      </article>
    );
  }

  if (variant === 'gallery') {
    return (
      <article data-carta-product-image-position="default" className="group relative text-center sm:pt-1">
        <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-t-[45%]">
          <StorefrontMediaFrame
            src={product.imageUrl}
            alt={product.name}
            fallback={fallback}
            aspectClassName="aspect-[4/5] sm:aspect-[4/3]"
            roundedClassName="rounded-t-[45%]"
            imageClassName="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            pngImageClassName="h-full w-full object-contain p-3 drop-shadow-[0_16px_20px_rgba(15,23,42,0.16)] transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
          <span className="absolute right-2.5 top-2.5 rounded-full px-2.5 py-1.5 text-[11px] font-black text-white shadow-lg sm:right-4 sm:top-4 sm:px-3 sm:text-sm" style={{ backgroundColor: theme.primary }}>
            {price}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
            <h3 className="text-base font-black leading-tight drop-shadow-sm sm:text-xl">{product.name}</h3>
            {showDescription && product.shortDescription && <p data-carta-product-description className="mt-1.5 line-clamp-4 text-[11px] leading-4 text-white/80 sm:text-sm sm:leading-5">{product.shortDescription}</p>}
          </div>
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
