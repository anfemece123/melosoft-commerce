import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import { PublicStoreLogo } from './PublicStoreLogo';
import { buildStorefrontTheme } from './storefrontTheme';
import type { PublicStorePage } from '@/types/common.types';

interface StorefrontBrandingLike {
  storeName?: string | null;
  storeSlug?: string | null;
  logoUrl?: string | null;
  themeMode?: 'light' | 'dark' | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  buttonRadius?: string | null;
}

function SkeletonBlock({
  className,
  style,
}: {
  className: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <div className="absolute inset-0 animate-pulse bg-white/30 dark:bg-white/10" />
      <div
        className="absolute inset-y-0 -left-1/3 w-1/2 animate-[pulse_1.8s_ease-in-out_infinite]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
          filter: 'blur(12px)',
        }}
      />
    </div>
  );
}

function buildThemeFromBranding(branding?: StorefrontBrandingLike | null) {
  return buildStorefrontTheme({
    mode: branding?.themeMode,
    primaryColor: branding?.primaryColor,
    secondaryColor: branding?.secondaryColor,
    accentColor: branding?.accentColor,
    backgroundColor: branding?.backgroundColor,
    textColor: branding?.textColor,
    buttonRadius: branding?.buttonRadius,
  });
}

function HomeSkeletonHeader({
  branding,
  hasHero,
  showCart = false,
}: {
  branding?: StorefrontBrandingLike | null;
  hasHero?: boolean;
  showCart?: boolean;
}) {
  const theme = buildThemeFromBranding(branding);
  const storeName = branding?.storeName?.trim() || 'Cargando tienda';

  return (
    <header
      className={[
        'relative z-40',
        hasHero ? 'border-transparent' : 'border-b',
      ].join(' ')}
      style={{
        backgroundColor: hasHero ? 'transparent' : theme.background,
        borderColor: theme.border,
        backdropFilter: hasHero ? 'none' : 'blur(20px)',
        WebkitBackdropFilter: hasHero ? 'none' : 'blur(20px)',
      }}
    >
      <div className="relative mx-auto max-w-7xl px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <PublicStoreLogo
              logoUrl={branding?.logoUrl ?? null}
              storeName={storeName}
              sizeClassName="h-[52px] w-[52px] md:h-[64px] md:w-[64px]"
              fallbackColor={theme.primary}
              outerClassName="border shadow-sm"
              outerStyle={{
                borderColor: theme.border,
                backgroundColor: theme.surface,
                boxShadow: `0 10px 24px ${theme.shadow}`,
              }}
            />
            <div className="min-w-0">
              <p className="truncate text-[22px] font-semibold leading-none tracking-[-0.03em] md:text-[26px]" style={{ color: theme.text }}>
                {storeName}
              </p>
            </div>
          </div>

          <div className="hidden items-center justify-center gap-4 lg:flex">
            <SkeletonBlock className="h-3 w-12 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
            <SkeletonBlock className="h-3 w-16 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
            <SkeletonBlock className="h-3 w-20 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
          </div>

          <div className="flex items-center justify-end gap-2 md:gap-3">
            <div
              className="relative hidden h-10 min-w-[190px] max-w-[250px] rounded-md border lg:block"
              style={{ borderColor: theme.border, backgroundColor: theme.surface }}
            >
              <Search
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: theme.mutedText }}
              />
            </div>

            {showCart ? (
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full border shadow-sm md:h-12 md:w-12"
                style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }}
              >
                <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            ) : null}

            <div
              className="flex h-11 w-11 items-center justify-center rounded-full border shadow-sm lg:hidden"
              style={{ borderColor: theme.border, backgroundColor: theme.surface }}
            >
              <SkeletonBlock className="h-4 w-4 rounded-sm" style={{ backgroundColor: theme.softPrimary }} />
            </div>
          </div>
        </div>

        <div className="mt-3 lg:hidden">
          <div
            className="relative h-10 rounded-md border"
            style={{ borderColor: theme.border, backgroundColor: theme.surface }}
          >
            <Search
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: theme.mutedText }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export function StorefrontHomeSkeleton({
  branding,
  hasHero = true,
  showCart = false,
}: {
  branding?: StorefrontBrandingLike | null;
  hasHero?: boolean;
  showCart?: boolean;
}) {
  const theme = buildThemeFromBranding(branding);

  return (
    <div style={{ backgroundColor: theme.background, color: theme.text, minHeight: '100vh' }}>
      <div
        className="relative overflow-hidden"
        style={{
          background: hasHero
            ? theme.mode === 'dark'
              ? `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.34) 100%), linear-gradient(135deg, ${theme.background} 0%, #121212 58%, #0a0a0a 100%)`
              : `linear-gradient(135deg, ${theme.secondary} 0%, #f8f4eb 46%, ${theme.background} 100%)`
            : theme.background,
        }}
      >
        <HomeSkeletonHeader branding={branding} hasHero={hasHero} showCart={showCart} />

        {hasHero ? (
          <section className="w-full pb-8 pt-0 md:pb-12">
            <div className="relative overflow-hidden px-6 pb-10 pt-[130px] md:px-10 md:pb-12 md:pt-[144px] lg:px-14">
              <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 md:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12">
                <div className="order-2 flex items-center lg:order-1 lg:min-h-[460px]">
                  <div className="mx-auto flex w-full max-w-[620px] flex-col items-center text-center lg:mx-0 lg:max-w-[560px] lg:items-start lg:text-left">
                    <div className="space-y-3">
                      <SkeletonBlock className="h-12 w-[280px] rounded-[18px] sm:h-14 sm:w-[340px] md:h-16 md:w-[420px]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.56)' }} />
                      <SkeletonBlock className="h-12 w-[220px] rounded-[18px] sm:h-14 sm:w-[290px] md:h-16 md:w-[340px]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.56)' }} />
                    </div>
                    <div className="mt-5 space-y-2">
                      <SkeletonBlock className="h-4 w-[240px] rounded-full sm:w-[300px] md:w-[360px]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.46)' }} />
                      <SkeletonBlock className="h-4 w-[190px] rounded-full sm:w-[250px] md:w-[300px]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.46)' }} />
                    </div>
                    <div className="mt-8 w-full max-w-[320px] sm:max-w-[360px] lg:max-w-none">
                      <SkeletonBlock className="h-[52px] w-full rounded-full lg:h-[46px] lg:w-[176px]" style={{ backgroundColor: theme.primary }} />
                    </div>
                  </div>
                </div>

                <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
                  <div className="relative">
                    <div
                      className="absolute left-1/2 top-6 h-[248px] w-[248px] -translate-x-1/2 rounded-full sm:top-7 sm:h-[320px] sm:w-[320px] md:h-[390px] md:w-[390px] lg:h-[470px] lg:w-[470px]"
                      style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(216,224,232,0.82)' }}
                    />
                    <div
                      className="relative flex h-[208px] w-[208px] items-end justify-center overflow-hidden rounded-full border sm:h-[268px] sm:w-[268px] md:h-[420px] md:w-[420px] lg:h-[500px] lg:w-[500px]"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      <SkeletonBlock className="h-[78%] w-[72%] rounded-[42%_42%_26%_26%/38%_38%_22%_22%]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.72)' }} />
                      <div
                        className="absolute bottom-0 left-0 right-0 h-[84px]"
                        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.12) 100%)' }}
                      />
                    </div>
                    <div
                      className="absolute right-[-6px] top-5 flex h-[94px] w-[94px] items-center justify-center rounded-full border-[3px] p-[4px] sm:right-0 sm:top-8 sm:h-[110px] sm:w-[110px] md:top-10 md:h-[132px] md:w-[132px]"
                      style={{
                        borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.16)' : '#d6dce2',
                        backgroundColor: theme.mode === 'dark' ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.96)',
                      }}
                    >
                      <PublicStoreLogo
                        logoUrl={branding?.logoUrl ?? null}
                        storeName={branding?.storeName?.trim() || 'Tienda'}
                        sizeClassName="h-full w-full"
                        fallbackColor={theme.primary}
                        outerClassName={theme.mode === 'dark' ? 'border border-white/10 bg-slate-950' : 'border border-gray-200 bg-white'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <section
        className={hasHero ? 'px-4 py-12' : 'px-4 pb-12 pt-8 md:pt-10'}
        style={{ backgroundColor: theme.secondary }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" style={{ color: theme.primary }} />
            <h2 className="text-lg font-bold">Menú</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-[28px] border p-3 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
                <SkeletonBlock className="aspect-square w-full rounded-[22px]" style={{ backgroundColor: theme.surfaceAlt }} />
                <div className="mt-3 flex flex-col">
                  <SkeletonBlock className="h-3 w-20 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
                  <SkeletonBlock className="mt-3 h-4 w-[88%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
                  <SkeletonBlock className="mt-2 h-4 w-[72%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
                  <SkeletonBlock className="mt-3 h-3 w-24 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
                  <div className="mt-4 flex items-center gap-2">
                    <SkeletonBlock className="h-5 w-20 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
                    <SkeletonBlock className="h-4 w-12 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
                  </div>
                  <SkeletonBlock className="mt-4 h-10 w-full rounded-full" style={{ backgroundColor: theme.primary }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function StorefrontCatalogGridSkeleton({
  branding,
  title = null,
}: {
  branding?: StorefrontBrandingLike | null;
  title?: string | null;
}) {
  const theme = buildThemeFromBranding(branding);

  return (
    <div className="mx-auto max-w-5xl">
      {title ? (
        <div className="mb-4 flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5" style={{ color: theme.primary }} />
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-[28px] border p-3 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
            <SkeletonBlock className="aspect-square w-full rounded-[22px]" style={{ backgroundColor: theme.surfaceAlt }} />
            <div className="mt-3 flex flex-1 flex-col">
              <SkeletonBlock className="h-3 w-20 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
              <SkeletonBlock className="mt-3 h-4 w-[88%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
              <SkeletonBlock className="mt-2 h-4 w-[72%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
              <SkeletonBlock className="mt-3 h-3 w-24 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
              <div className="mt-4 flex items-center gap-2">
                <SkeletonBlock className="h-5 w-20 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
                <SkeletonBlock className="h-4 w-12 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
              </div>
              <SkeletonBlock className="mt-4 h-10 w-full rounded-full" style={{ backgroundColor: theme.primary }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StorefrontProductDetailSkeleton({
  branding,
  storeSlug,
}: {
  branding?: StorefrontBrandingLike | null;
  storeSlug: string;
}) {
  const theme = buildThemeFromBranding(branding);

  return (
    <div style={{ backgroundColor: theme.background, color: theme.text, minHeight: '100vh' }}>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link
          to={`/s/${storeSlug}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: theme.text }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la tienda
        </Link>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div>
            <div className="rounded-[32px] border p-3 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
              <SkeletonBlock className="aspect-square w-full rounded-[24px]" style={{ backgroundColor: theme.surfaceAlt }} />
            </div>
            <div className="mt-3 flex gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-20 w-20 rounded-2xl border" style={{ backgroundColor: theme.surfaceAlt, borderColor: theme.border }} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <SkeletonBlock className="h-3 w-24 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
            <div className="space-y-3">
              <SkeletonBlock className="h-8 w-[72%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
              <SkeletonBlock className="h-5 w-[34%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
              <SkeletonBlock className="h-4 w-full rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
              <SkeletonBlock className="h-4 w-[88%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
            </div>
            <div className="rounded-[24px] border p-4" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
              <SkeletonBlock className="h-4 w-24 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
              <SkeletonBlock className="mt-4 h-14 w-full rounded-2xl" style={{ backgroundColor: theme.surfaceAlt }} />
              <SkeletonBlock className="mt-3 h-14 w-full rounded-2xl" style={{ backgroundColor: theme.surfaceAlt }} />
            </div>
            <div className="rounded-[24px] border p-4" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
              <SkeletonBlock className="h-4 w-28 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
              <SkeletonBlock className="mt-4 h-12 w-full rounded-full" style={{ backgroundColor: theme.primary }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function StorefrontOfferDetailSkeleton({
  branding,
  storeSlug,
}: {
  branding?: StorefrontBrandingLike | null;
  storeSlug: string;
}) {
  const theme = buildThemeFromBranding(branding);

  return (
    <div style={{ backgroundColor: theme.background, color: theme.text, minHeight: '100vh' }}>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link
          to={`/s/${storeSlug}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: theme.text }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la tienda
        </Link>
        <div className="mb-6 rounded-[32px] border p-3 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
          <SkeletonBlock className="aspect-video w-full rounded-[24px]" style={{ backgroundColor: theme.surfaceAlt }} />
        </div>
        <SkeletonBlock className="h-3 w-28 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
        <div className="mt-3 space-y-3">
          <SkeletonBlock className="h-8 w-[78%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
          <SkeletonBlock className="h-4 w-[56%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <SkeletonBlock className="h-9 w-32 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
          <SkeletonBlock className="h-8 w-20 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
        </div>
        <div className="mt-6 rounded-[24px] border p-4" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
          <SkeletonBlock className="h-4 w-32 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
          <SkeletonBlock className="mt-4 h-20 w-full rounded-2xl" style={{ backgroundColor: theme.surfaceAlt }} />
        </div>
        <SkeletonBlock className="mt-6 h-12 w-full rounded-full" style={{ backgroundColor: theme.primary }} />
      </main>
    </div>
  );
}

export function StorefrontPoliciesSkeleton({
  branding,
  storeSlug,
}: {
  branding?: PublicStorePage | null;
  storeSlug: string;
}) {
  const theme = buildThemeFromBranding(branding);

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.text }}>
      <header className="border-b" style={{ backgroundColor: theme.background, borderColor: theme.border }}>
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link
            to={`/s/${storeSlug}`}
            className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: theme.mutedText }}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la tienda
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <SkeletonBlock className="mb-8 h-8 w-60 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
        <div className="space-y-8">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-[24px] border p-4" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
              <SkeletonBlock className="mb-3 h-5 w-40 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
              <SkeletonBlock className="h-16 w-full rounded-[18px]" style={{ backgroundColor: theme.surfaceAlt }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
