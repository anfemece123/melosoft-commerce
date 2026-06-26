import { useEffect, useMemo, useState } from 'react';
import { PublicStoreLogo } from './PublicStoreLogo';
import { StorefrontActionButton } from './StorefrontActionButton';
import type { StorefrontTheme } from './storefrontTheme';
import type { PublicStoreHeroSlide } from '@/types/common.types';

interface StorefrontHeroProps {
  theme: StorefrontTheme;
  storeName: string;
  storeLogoUrl: string | null;
  ctaHref: string;
  fallbackCtaLabel: string;
  slides: PublicStoreHeroSlide[];
}

export function StorefrontHero({
  theme,
  storeName,
  storeLogoUrl,
  ctaHref,
  fallbackCtaLabel,
  slides,
}: StorefrontHeroProps) {
  const activeSlides = useMemo(
    () => slides.filter((slide) => slide.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [slides]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [activeSlides.length]);

  useEffect(() => {
    if (activeSlides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % activeSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [activeSlides.length]);

  const slide = activeSlides[activeIndex];
  if (!slide) return null;

  const fallbackBackground =
    theme.mode === 'dark'
      ? [
          'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.38) 100%)',
          'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.07) 0, transparent 14%)',
          'radial-gradient(circle at 82% 16%, rgba(255,255,255,0.06) 0, transparent 13%)',
          `linear-gradient(135deg, ${theme.background} 0%, #1a1a1a 52%, #090b0f 100%)`,
        ].join(', ')
      : [
          `radial-gradient(circle at 14% 22%, ${theme.softPrimary} 0, transparent 16%)`,
          'radial-gradient(circle at 82% 20%, rgba(255,255,255,0.58) 0, transparent 12%)',
          `linear-gradient(135deg, ${theme.secondary} 0%, #f9f7f2 45%, ${theme.background} 100%)`,
        ].join(', ');

  const heroBackgroundStyle = slide.backgroundImageUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(15, 23, 42, 0.24), rgba(15, 23, 42, 0.12)), url(${slide.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: fallbackBackground,
      };

  const title = slide.showTitle ? slide.title?.trim() : '';
  const subtitle = slide.showSubtitle ? slide.subtitle?.trim() : '';
  const ctaLabel = slide.showCta ? slide.ctaLabel?.trim() || fallbackCtaLabel : null;
  const badgeImageUrl = slide.showBadgeImage ? slide.badgeImageUrl ?? storeLogoUrl : null;

  return (
    <section
      id="storefront-hero"
      className="-mt-[1px] w-full pb-8 pt-0 md:pb-12"
      style={heroBackgroundStyle}
    >
      <div className="relative mx-auto -mt-px w-full max-w-none overflow-hidden border border-transparent px-0 py-0">
        <div className="relative overflow-hidden px-6 pb-10 pt-[130px] md:px-10 md:pb-12 md:pt-[144px] lg:px-14">
          <DecorativeBlob className="left-[-38px] top-16 h-24 w-24 rounded-[36px]" />
          <DecorativeBlob className="bottom-[-18px] left-12 h-28 w-28 rounded-full" />
          <DecorativeBlob className="left-24 top-[-8px] h-20 w-20 rounded-full opacity-40" />
          <DecorativeBlob className="right-28 top-5 h-16 w-16 rounded-[24px] opacity-30" />
          <DecorativeBlob className="bottom-8 right-10 h-16 w-16 rounded-[24px] opacity-30" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 md:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-10">
            <div className="order-2 flex items-center lg:order-1 lg:min-h-[460px]">
              <div className="mx-auto flex w-full max-w-[620px] flex-col items-center text-center lg:mx-0 lg:max-w-[560px] lg:items-start lg:text-left">
                {title ? (
                  <h1
                    className="max-w-[420px] text-[31px] font-black leading-[0.98] tracking-[-0.04em] sm:max-w-[460px] sm:text-[36px] md:max-w-[520px] md:text-[50px] lg:max-w-[560px] lg:text-[58px]"
                    style={{ color: theme.text }}
                  >
                    {title}
                  </h1>
                ) : null}

                {subtitle ? (
                  <p
                    className="mt-4 max-w-[390px] text-[15px] leading-[1.35] sm:max-w-[420px] sm:text-[16px] md:max-w-[470px] md:text-[18px] lg:max-w-[500px] lg:text-[19px]"
                    style={{ color: theme.mutedText }}
                  >
                    {subtitle}
                  </p>
                ) : null}

                {ctaLabel ? (
                  <div className="mt-6 w-full max-w-[320px] sm:max-w-[360px] lg:max-w-none">
                    <StorefrontActionButton
                      as="a"
                      href={ctaHref}
                      theme={theme}
                      fullWidth
                      className="h-[50px] px-8 text-[16px] hover:-translate-y-0.5 sm:h-[52px] lg:inline-flex lg:h-[44px] lg:min-w-[172px] lg:w-auto"
                    >
                      {ctaLabel}
                    </StorefrontActionButton>
                  </div>
                ) : null}

                {activeSlides.length > 1 ? (
                  <div className="mt-7 flex items-center gap-2">
                    {activeSlides.map((heroSlide, index) => (
                      <button
                        key={heroSlide.id}
                        type="button"
                        aria-label={`Ir a portada ${index + 1}`}
                        className="h-2.5 rounded-full transition-all"
                        style={{
                          width: index === activeIndex ? 28 : 10,
                          backgroundColor: index === activeIndex ? theme.primary : 'rgba(255,255,255,0.42)',
                        }}
                        onClick={() => setActiveIndex(index)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
              <div className="relative">
                <div
                  className="absolute left-1/2 top-6 h-[248px] w-[248px] -translate-x-1/2 rounded-full sm:top-7 sm:h-[320px] sm:w-[320px] md:h-[390px] md:w-[390px] lg:h-[470px] lg:w-[470px]"
                  style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#d8e0e8' }}
                />

                <div
                  className="relative flex h-[208px] w-[208px] items-end justify-center overflow-hidden rounded-full sm:h-[268px] sm:w-[268px] md:h-[420px] md:w-[420px] lg:h-[500px] lg:w-[500px]"
                  style={{
                    background: theme.mode === 'dark'
                      ? 'radial-gradient(circle at 30% 18%, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 16%, transparent 16.5%), radial-gradient(circle at 50% 60%, rgba(0,0,0,0.22) 0, rgba(0,0,0,0.45) 100%), rgba(255,255,255,0.06)'
                      : 'radial-gradient(circle at 30% 18%, rgba(255,255,255,0.45) 0, rgba(255,255,255,0.45) 16%, transparent 16.5%), #d8e0e8',
                  }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[86px]"
                    style={{
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.12) 100%)',
                    }}
                  />

                  {slide.showMainImage && slide.mainImageUrl ? (
                    <img src={slide.mainImageUrl} alt={title || storeName} className="h-full w-full object-contain" />
                  ) : slide.showMainImage ? (
                    <div
                      className="mb-16 flex h-[64%] w-[64%] items-center justify-center rounded-full border-2 border-dashed text-center"
                      style={{ borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.18)' }}
                    >
                      <div className="px-6">
                        <p className="text-sm font-semibold uppercase tracking-[0.32em]" style={{ color: theme.primary }}>
                          Imagen Principal
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                {slide.showBadgeImage && badgeImageUrl ? (
                  <div
                    className="absolute right-[-6px] top-5 flex h-[94px] w-[94px] items-center justify-center rounded-full border-[3px] bg-white p-[4px] sm:right-0 sm:top-8 sm:h-[110px] sm:w-[110px] md:top-10 md:h-[132px] md:w-[132px]"
                    style={{
                      borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.18)' : '#d6dce2',
                      boxShadow: theme.mode === 'dark' ? '0 14px 28px rgba(0,0,0,0.34)' : '0 10px 20px rgba(0,0,0,0.12)',
                      backgroundColor: theme.mode === 'dark' ? 'rgba(15,23,42,0.92)' : '#ffffff',
                    }}
                  >
                    {slide.badgeImageUrl ? (
                      <img
                        src={slide.badgeImageUrl}
                        alt={`${storeName} badge`}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <PublicStoreLogo
                        logoUrl={storeLogoUrl}
                        storeName={storeName}
                        sizeClassName="h-full w-full"
                        fallbackColor={theme.primary}
                        outerClassName={theme.mode === 'dark' ? 'border border-white/10 bg-slate-950' : 'border border-gray-200 bg-white'}
                        imageClassName="rounded-full object-cover"
                        iconClassName="h-11 w-11"
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DecorativeBlob({ className }: { className: string }) {
  return (
    <div
      className={`absolute ${className}`}
      style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
    />
  );
}
