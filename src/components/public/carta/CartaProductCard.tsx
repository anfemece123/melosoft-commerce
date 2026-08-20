import { ImageIcon } from 'lucide-react';
import type { CartaProductImagePosition, CartaTemplateKey, PublicCartaProduct, PublicCartaVariant } from '@/features/carta/carta.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';
import { withAlpha } from '@/components/public/storefront/storefrontTheme';
import { buildCartaVariantPresentation } from '@/features/carta/cartaVariantPresentation';
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

function CartaVariantPrices({ variants, currency, theme, compact = false }: { variants: PublicCartaVariant[]; currency: string; theme: StorefrontTheme; compact?: boolean }) {
  const presentation = buildCartaVariantPresentation(variants);
  const textSize = compact ? 'text-[11px] leading-4' : 'text-xs leading-5';
  const priceSize = compact ? 'text-[11px]' : 'text-xs';

  return (
    <div className={`${compact ? 'mt-2' : 'mt-3'} space-y-1.5`} role="list" aria-label="Presentaciones disponibles">
      {presentation.optionGroups.map((group) => (
        <div key={group.id} role="listitem" className="flex items-start gap-2 border-t pt-1.5" style={{ borderColor: theme.border }}>
          <span className={`${textSize} shrink-0 font-semibold`} style={{ color: theme.mutedText }}>{group.name}:</span>
          <div className={`${textSize} min-w-0 flex flex-wrap gap-x-2 gap-y-0.5`}>
            {group.values.map((value, index) => (
              <span key={value.id} style={{ color: value.isAvailable ? theme.text : theme.mutedText }}>
                {value.label}{!value.isAvailable && <span className="ml-1">(Agotado)</span>}{index < group.values.length - 1 && <span aria-hidden="true" className="ml-2" style={{ color: theme.mutedText }}>·</span>}
              </span>
            ))}
          </div>
        </div>
      ))}

      {presentation.priceGroup && (
        <div role="listitem" className="flex items-start gap-2 border-t pt-1.5" style={{ borderColor: theme.border }}>
          <span className={`${textSize} shrink-0 font-semibold`} style={{ color: theme.mutedText }}>{presentation.priceGroup.name}:</span>
          <div className={`${textSize} min-w-0 flex flex-wrap gap-x-2.5 gap-y-0.5`}>
            {presentation.priceGroup.values.map((value, index) => (
              <span key={value.id} style={{ color: value.isAvailable ? theme.text : theme.mutedText }}>
                {value.label} <strong className={`${priceSize} font-black`} style={{ color: value.isAvailable ? theme.primary : theme.mutedText }}>{formatCurrency(value.price, 'es-CO', currency)}</strong>{!value.isAvailable && <span className="ml-1">(Agotado)</span>}{index < presentation.priceGroup!.values.length - 1 && <span aria-hidden="true" className="ml-2" style={{ color: theme.mutedText }}>·</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {presentation.matrix && (
        <div role="listitem" className="border-t pt-1.5" style={{ borderColor: theme.border }}>
          <div data-carta-variant-matrix className={`${textSize} min-w-0 space-y-1.5`}>
            {presentation.matrix.groups.map((group) => (
              <div key={group.id} className="border-b pb-1.5 last:border-b-0 last:pb-0" style={{ borderColor: theme.border }}>
                <p className="break-words" style={{ color: theme.text }}>{group.labels.join(', ')}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
                  {group.cells.map((cell, index) => cell ? (
                    <span key={presentation.matrix!.columns[index].id} style={{ color: cell.isAvailable ? theme.primary : theme.mutedText }}>
                      {presentation.matrix!.columns[index].label} <strong className="font-black">{formatCurrency(cell.price, 'es-CO', currency)}</strong>{!cell.isAvailable && <span className="ml-1 font-medium">(Agotado)</span>}
                    </span>
                  ) : null)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!presentation.priceGroup && presentation.commonPrice !== null && (
        <div role="listitem" className="flex items-center justify-between gap-3 border-t pt-1.5" style={{ borderColor: theme.border }}>
          <span className={`${textSize} font-semibold`} style={{ color: theme.mutedText }}>Precio:</span>
          <strong className={`${priceSize} font-black`} style={{ color: theme.primary }}>{formatCurrency(presentation.commonPrice, 'es-CO', currency)}</strong>
        </div>
      )}

      {presentation.rows.map((row) => (
        <div key={row.id} role="listitem" className="flex items-start justify-between gap-3 border-t pt-1.5" style={{ borderColor: theme.border }}>
          <span className={`${textSize} min-w-0 break-words`} style={{ color: theme.text }}>{row.label}</span>
          <span className={`${priceSize} shrink-0 text-right font-black`} style={{ color: row.isAvailable ? theme.primary : theme.mutedText }}>
            {formatCurrency(row.price, 'es-CO', currency)}
            {!row.isAvailable && <span className="ml-1 font-medium">Agotado</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Checkout-free dish presentation shared by the public carta and its
 * admin preview. Every variant reserves a real, prominent media area so
 * an existing gallery image is never reduced to a tiny list thumbnail. */
export function CartaProductCard({ product, currency, theme, variant = 'signature', showDescription = true, showImage = true, compact = false, imagePosition }: CartaProductCardProps) {
  const price = formatCurrency(product.price, 'es-CO', currency);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = variants.length > 0;
  const variantSummary = `${variants.length} ${variants.length === 1 ? 'variante' : 'variantes'}`;
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
          <span className={`shrink-0 font-black ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: theme.primary }}>{hasVariants ? variantSummary : price}</span>
        </div>
        {showDescription && product.shortDescription && (
          <p data-carta-product-description className={`mt-1.5 line-clamp-4 max-w-xl ${compact ? 'text-[11px] leading-4' : 'text-xs leading-5 sm:text-sm'}`} style={{ color: theme.mutedText }}>{product.shortDescription}</p>
        )}
        {hasVariants && <CartaVariantPrices variants={variants} currency={currency} theme={theme} compact={compact} />}
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
          {hasVariants ? (
            <CartaVariantPrices variants={variants} currency={currency} theme={theme} compact />
          ) : (
            <p className="mt-3 text-sm font-black sm:mt-4 sm:text-base" style={{ color: theme.primary }}>{price}</p>
          )}
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
            <span className="shrink-0 text-sm font-black" style={{ color: theme.primary }}>{hasVariants ? variantSummary : price}</span>
          </div>
          {showDescription && product.shortDescription && <p data-carta-product-description className="mt-1.5 line-clamp-4 text-xs leading-5" style={{ color: theme.mutedText }}>{product.shortDescription}</p>}
          {hasVariants && <CartaVariantPrices variants={variants} currency={currency} theme={theme} compact />}
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
        {hasVariants ? (
          <CartaVariantPrices variants={variants} currency={currency} theme={theme} />
        ) : (
          <p className="mt-4 text-base font-black" style={{ color: theme.primary }}>{price}</p>
        )}
      </div>
    </article>
  );
}
