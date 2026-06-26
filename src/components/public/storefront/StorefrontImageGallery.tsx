import { useId, useMemo, useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Package, UtensilsCrossed } from 'lucide-react';
import type { PublicProductImage } from '@/types/common.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';

type StorefrontImageGalleryProps = {
  images: PublicProductImage[];
  productName: string;
  isMenu: boolean;
  theme: StorefrontTheme;
  mode?: 'card' | 'detail';
  className?: string;
};

export function StorefrontImageGallery({
  images,
  productName,
  isMenu,
  theme,
  mode = 'card',
  className = '',
}: StorefrontImageGalleryProps) {
  const fallbackImage = useMemo<PublicProductImage[]>(
    () => (images.length > 0 ? images : [{ imageUrl: '', altText: productName, sortOrder: 0, isPrimary: true }]),
    [images, productName]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const galleryId = useId();
  const safeIndex = Math.min(activeIndex, Math.max(fallbackImage.length - 1, 0));
  const activeImage = fallbackImage[safeIndex];
  const hasMultiple = fallbackImage.length > 1;
  const isDetail = mode === 'detail';

  function showPrevious(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    setActiveIndex((current) => (current - 1 + fallbackImage.length) % fallbackImage.length);
  }

  function showNext(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    setActiveIndex((current) => (current + 1) % fallbackImage.length);
  }

  return (
    <div className={className}>
      <div className="relative">
        <StorefrontMediaFrame
          src={activeImage?.imageUrl || null}
          alt={activeImage?.altText || productName}
          aspectClassName={isDetail ? 'aspect-square' : 'aspect-square'}
          roundedClassName={isDetail ? 'rounded-[1.75rem]' : 'rounded-[1.5rem]'}
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              {isMenu
                ? <UtensilsCrossed className="h-10 w-10 text-gray-300" />
                : <Package className="h-10 w-10 text-gray-300" />}
            </div>
          }
        />

        {hasMultiple ? (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Ver imagen anterior"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-sm transition-opacity hover:opacity-100"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
                opacity: isDetail ? 1 : 0.94,
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="Ver siguiente imagen"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-sm transition-opacity hover:opacity-100"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
                opacity: isDetail ? 1 : 0.94,
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {!isDetail ? (
              <div
                className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 px-4"
                role="tablist"
                aria-label={`Galería de ${productName}`}
              >
                {fallbackImage.map((image, index) => {
                  const selected = index === safeIndex;
                  return (
                    <button
                      key={`${galleryId}-${image.imageUrl}-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-label={`Ver imagen ${index + 1}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setActiveIndex(index);
                      }}
                      className="transition-all"
                      style={{
                        width: selected ? 26 : 8,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: selected ? theme.primary : theme.border,
                        opacity: selected ? 1 : 0.92,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
                      }}
                    />
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {hasMultiple && isDetail ? (
        <div className={isDetail ? 'mt-4 space-y-3' : 'mt-3 space-y-2'}>
          <div
            className="flex items-center justify-center gap-2"
            role="tablist"
            aria-label={`Galería de ${productName}`}
          >
            {fallbackImage.map((image, index) => {
              const selected = index === safeIndex;
              return (
                <button
                  key={`${galleryId}-${image.imageUrl}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`Ver imagen ${index + 1}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveIndex(index);
                  }}
                  className="transition-all"
                  style={{
                    width: selected ? 26 : 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: selected ? theme.primary : theme.border,
                    opacity: selected ? 1 : 0.7,
                  }}
                />
              );
            })}
          </div>

          {isDetail ? (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
              {fallbackImage.map((image, index) => {
                const selected = index === safeIndex;
                return (
                  <button
                    key={`${galleryId}-thumb-${image.imageUrl}-${index}`}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setActiveIndex(index);
                    }}
                    className="overflow-hidden rounded-2xl border p-1 transition-transform hover:scale-[1.02]"
                    style={{
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: theme.surfaceAlt,
                    }}
                    aria-label={`Seleccionar imagen ${index + 1}`}
                  >
                    <StorefrontMediaFrame
                      src={image.imageUrl}
                      alt={image.altText || `${productName} ${index + 1}`}
                      aspectClassName="aspect-square"
                      roundedClassName="rounded-[1rem]"
                      fallback={<div className="h-full w-full" style={{ backgroundColor: theme.surface }} />}
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
