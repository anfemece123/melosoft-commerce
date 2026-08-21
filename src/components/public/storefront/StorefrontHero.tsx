import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type TouchEvent,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PublicStoreLogo } from './PublicStoreLogo';
import { StorefrontActionButton } from './StorefrontActionButton';
import { STOREFRONT_CONTAINER_CLASS, withAlpha, type StorefrontTheme } from './storefrontTheme';
import type { PublicStoreHeroSlide } from '@/types/common.types';
import { isExternalHeroCtaHref } from '@/lib/storefront/heroCta';

interface StorefrontHeroProps {
  theme: StorefrontTheme;
  storeName: string;
  storeLogoUrl: string | null;
  transparentHeaderOnMobile?: boolean;
  getCtaHref: (slide: PublicStoreHeroSlide) => string;
  fallbackCtaLabel: string;
  slides: PublicStoreHeroSlide[];
}

const AUTOPLAY_DELAY_MS = 7_000;
const SWIPE_THRESHOLD_PX = 44;

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

function getHeroBackgroundStyle(slide: PublicStoreHeroSlide, theme: StorefrontTheme): CSSProperties {
  if (slide.backgroundImageUrl) {
    return {
      backgroundImage: `linear-gradient(90deg, rgba(15, 23, 42, 0.28), rgba(15, 23, 42, 0.1)), url(${slide.backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }

  const fallbackBackground = theme.mode === 'dark'
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

  return { background: fallbackBackground };
}

export function StorefrontHero({
  theme,
  storeName,
  storeLogoUrl,
  transparentHeaderOnMobile = false,
  getCtaHref,
  fallbackCtaLabel,
  slides,
}: StorefrontHeroProps) {
  const activeSlides = useMemo(
    () => slides.filter((slide) => slide.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [slides]
  );
  const [requestedActiveIndex, setRequestedActiveIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const touchStartXRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const activeIndex = activeSlides.length > 0
    ? requestedActiveIndex % activeSlides.length
    : 0;
  const hasCarousel = activeSlides.length > 1;
  const interactionPaused = hoverPaused || focusPaused || touchPaused;

  useEffect(() => {
    const handleVisibilityChange = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!hasCarousel || interactionPaused || prefersReducedMotion || !pageVisible) return undefined;
    const timer = window.setTimeout(() => {
      setRequestedActiveIndex((current) => (current + 1) % activeSlides.length);
    }, AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, activeSlides.length, hasCarousel, interactionPaused, pageVisible, prefersReducedMotion]);

  if (activeSlides.length === 0) return null;

  function goToSlide(index: number) {
    setRequestedActiveIndex((index + activeSlides.length) % activeSlides.length);
  }

  function goToPreviousSlide() {
    goToSlide(activeIndex - 1);
  }

  function goToNextSlide() {
    goToSlide(activeIndex + 1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!hasCarousel) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToPreviousSlide();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToNextSlide();
    }
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusPaused(false);
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    setTouchPaused(true);
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartXRef.current = null;
    setTouchPaused(false);
    if (startX === null || endX === undefined) return;
    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta > 0) goToPreviousSlide();
    else goToNextSlide();
  }

  return (
    <section
      id="storefront-hero"
      aria-label={`Portada destacada de ${storeName}`}
      aria-roledescription={hasCarousel ? 'carrusel' : undefined}
      className="group/hero relative -mt-[1px] isolate w-full overflow-hidden pb-8 pt-0 md:pb-12"
      style={{ backgroundColor: theme.background }}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={handleBlur}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStartXRef.current = null;
        setTouchPaused(false);
      }}
    >
      <div className="absolute inset-0" aria-hidden="true">
        {activeSlides.map((slide, index) => {
          const isCurrent = index === activeIndex;
          return (
            <div
              key={`background-${slide.id}`}
              className={[
                'absolute inset-0 transition-[opacity,transform] duration-1000 ease-out motion-reduce:transition-none',
                isCurrent ? 'scale-100 opacity-100' : 'scale-[1.025] opacity-0',
              ].join(' ')}
              style={getHeroBackgroundStyle(slide, theme)}
            />
          );
        })}
      </div>

      <div className="relative z-10 mx-auto -mt-px w-full max-w-none overflow-hidden border border-transparent px-0 py-0">
        <div
          className={`relative overflow-hidden px-6 ${transparentHeaderOnMobile ? 'pt-[max(156px,calc(env(safe-area-inset-top)+136px))]' : 'pt-[130px]'} md:px-10 md:pt-[144px] lg:px-14 ${hasCarousel ? 'pb-20 md:pb-24' : 'pb-10 md:pb-12'}`}
        >
          <DecorativeBlob className="left-[-38px] top-16 h-24 w-24 rounded-[36px]" />
          <DecorativeBlob className="bottom-[-18px] left-12 h-28 w-28 rounded-full" />
          <DecorativeBlob className="left-24 top-[-8px] h-20 w-20 rounded-full opacity-40" />
          <DecorativeBlob className="right-28 top-5 h-16 w-16 rounded-[24px] opacity-30" />
          <DecorativeBlob className="bottom-8 right-10 h-16 w-16 rounded-[24px] opacity-30" />

          <div className={`relative mx-auto grid ${STOREFRONT_CONTAINER_CLASS} px-4 md:px-6`}>
            {activeSlides.map((slide, index) => {
              const isCurrent = index === activeIndex;
              const title = slide.showTitle ? slide.title?.trim() : '';
              const subtitle = slide.showSubtitle ? slide.subtitle?.trim() : '';
              const ctaLabel = slide.showCta ? slide.ctaLabel?.trim() || fallbackCtaLabel : null;
              const ctaHref = getCtaHref(slide);
              const badgeImageUrl = slide.showBadgeImage ? slide.badgeImageUrl ?? storeLogoUrl : null;
              const hasVisual = slide.showMainImage || Boolean(badgeImageUrl);
              const Heading = index === 0 ? 'h1' : 'h2';

              return (
                <article
                  key={slide.id}
                  role={hasCarousel ? 'group' : undefined}
                  aria-roledescription={hasCarousel ? 'diapositiva' : undefined}
                  aria-label={hasCarousel ? `${index + 1} de ${activeSlides.length}` : undefined}
                  aria-hidden={!isCurrent}
                  inert={!isCurrent}
                  className={[
                    'col-start-1 row-start-1 grid items-center gap-8 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none lg:gap-10',
                    hasVisual ? 'lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]' : 'lg:grid-cols-1',
                    isCurrent
                      ? 'relative z-10 translate-y-0 scale-100 opacity-100 delay-100'
                      : 'pointer-events-none z-0 translate-y-2 scale-[0.985] opacity-0 delay-0',
                  ].join(' ')}
                >
                  <div className="order-2 flex items-center lg:order-1 lg:min-h-[460px]">
                    <div className="mx-auto flex w-full max-w-[620px] flex-col items-center text-center lg:mx-0 lg:max-w-[560px] lg:items-start lg:text-left">
                      {title ? (
                        <Heading
                          className="max-w-[420px] text-[31px] font-black leading-[0.98] tracking-[-0.04em] sm:max-w-[460px] sm:text-[36px] md:max-w-[520px] md:text-[50px] lg:max-w-[560px] lg:text-[58px]"
                          style={{ color: theme.text }}
                        >
                          {title}
                        </Heading>
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
                            as={isExternalHeroCtaHref(ctaHref) ? 'a' : 'link'}
                            href={ctaHref}
                            to={ctaHref}
                            theme={theme}
                            fullWidth
                            className="h-[50px] px-8 text-[16px] hover:-translate-y-0.5 sm:h-[52px] lg:inline-flex lg:h-[44px] lg:min-w-[172px] lg:w-auto"
                          >
                            {ctaLabel}
                          </StorefrontActionButton>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {hasVisual ? (
                    <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
                      <div className="relative">
                        {slide.showMainImage ? (
                          <>
                            <div
                              aria-hidden="true"
                              className="absolute left-1/2 top-1/2 h-[232px] w-[232px] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-[296px] sm:w-[296px] md:h-[390px] md:w-[390px] lg:h-[470px] lg:w-[470px]"
                              style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#d8e0e8' }}
                            />

                            <div
                              data-testid="hero-main-image-frame"
                              className="relative flex h-[208px] w-[208px] items-end justify-center overflow-hidden rounded-full sm:h-[268px] sm:w-[268px] md:h-[420px] md:w-[420px] lg:h-[500px] lg:w-[500px]"
                              style={{
                                background: theme.mode === 'dark'
                                  ? 'radial-gradient(circle at 30% 18%, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 16%, transparent 16.5%), radial-gradient(circle at 50% 60%, rgba(0,0,0,0.22) 0, rgba(0,0,0,0.45) 100%), rgba(255,255,255,0.06)'
                                  : 'radial-gradient(circle at 30% 18%, rgba(255,255,255,0.45) 0, rgba(255,255,255,0.45) 16%, transparent 16.5%), #d8e0e8',
                              }}
                            >
                              <div
                                className="absolute bottom-0 left-0 right-0 h-[86px]"
                                style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.12) 100%)' }}
                              />

                              {slide.mainImageUrl ? (
                                <img
                                  src={slide.mainImageUrl}
                                  alt={title || storeName}
                                  loading={index === 0 ? 'eager' : 'lazy'}
                                  fetchPriority={index === 0 ? 'high' : 'auto'}
                                  decoding="async"
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <div
                                  className="mb-16 flex h-[64%] w-[64%] items-center justify-center rounded-full border-2 border-dashed text-center"
                                  style={{ borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.18)' }}
                                >
                                  <div className="px-6">
                                    <p className="text-sm font-semibold uppercase tracking-[0.32em]" style={{ color: theme.primary }}>
                                      Imagen principal
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        ) : null}

                        {slide.showBadgeImage && badgeImageUrl ? (
                          <div
                            className={[
                              'flex h-[94px] w-[94px] items-center justify-center rounded-full border-[3px] bg-white p-[4px] sm:h-[110px] sm:w-[110px] md:h-[132px] md:w-[132px]',
                              slide.showMainImage
                                ? 'absolute right-[-6px] top-5 sm:right-0 sm:top-8 md:top-10'
                                : 'relative',
                            ].join(' ')}
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
                                loading={index === 0 ? 'eager' : 'lazy'}
                                decoding="async"
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
                  ) : null}
                </article>
              );
            })}
          </div>

          {hasCarousel ? (
            <>
              <SideArrowButton
                label="Portada anterior"
                side="left"
                theme={theme}
                onClick={goToPreviousSlide}
              >
                <ChevronLeft className="h-5 w-5" />
              </SideArrowButton>

              <SideArrowButton
                label="Portada siguiente"
                side="right"
                theme={theme}
                onClick={goToNextSlide}
              >
                <ChevronRight className="h-5 w-5" />
              </SideArrowButton>

              <div
                className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 md:bottom-6"
                aria-label={`Portada ${activeIndex + 1} de ${activeSlides.length}`}
              >
                {activeSlides.map((slide, index) => {
                  const isCurrent = index === activeIndex;
                  return (
                    <button
                      key={`indicator-${slide.id}`}
                      type="button"
                      aria-label={`Ir a portada ${index + 1}`}
                      aria-current={isCurrent ? 'true' : undefined}
                      className="group/dot flex h-8 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
                      onClick={() => goToSlide(index)}
                    >
                      <span
                        className={[
                          'block h-2.5 w-2.5 rounded-full shadow-[0_1px_5px_rgba(0,0,0,0.55)] ring-1 ring-black/10 transition-[transform,background-color] duration-300 motion-reduce:transition-none',
                          isCurrent
                            ? 'scale-125 bg-white'
                            : 'scale-100 bg-white/50 group-hover/dot:bg-white/80',
                        ].join(' ')}
                      />
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SideArrowButton({
  label,
  side,
  theme,
  onClick,
  children,
}: {
  label: string;
  side: 'left' | 'right';
  theme: StorefrontTheme;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={[
        'absolute top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 text-white opacity-0 shadow-lg backdrop-blur-sm transition-[opacity,transform,background-color] duration-300 hover:scale-105 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 group-hover/hero:opacity-100 group-focus-within/hero:opacity-100 md:flex',
        side === 'left' ? 'left-5 lg:left-8' : 'right-5 lg:right-8',
      ].join(' ')}
      style={{ backgroundColor: withAlpha(theme.primary, 0.88) }}
    >
      {children}
    </button>
  );
}

function DecorativeBlob({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute ${className}`}
      style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
    />
  );
}
