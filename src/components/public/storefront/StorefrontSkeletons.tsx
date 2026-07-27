import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Package, Search, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import { PublicStoreLogo } from './PublicStoreLogo';
import { buildStorefrontTheme, STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from './storefrontTheme';
import type { PublicStorePage } from '@/types/common.types';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton';

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
  catalogType?: string | null;
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
      <div className={`relative mx-auto ${STOREFRONT_CONTAINER_CLASS} px-4 py-4 md:px-6`}>
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
            <Skeleton className="h-3 w-12 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
            <Skeleton className="h-3 w-16 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
            <Skeleton className="h-3 w-20 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
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
              <Skeleton className="h-4 w-4 rounded-sm" style={{ backgroundColor: theme.softPrimary }} />
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

/** Single product/menu-item card placeholder — mirrors `StorefrontProductCard`'s
 * real structure (image, category label, 2-line title, rating row, price
 * row, CTA button) so the grid doesn't jump in height once real cards
 * replace it. */
export function StorefrontProductCardSkeleton({
  theme,
  size = 'default',
}: {
  theme: StorefrontTheme;
  size?: 'default' | 'large';
}) {
  const isLarge = size === 'large';
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-transparent" aria-hidden="true">
      <Skeleton
        className="aspect-square w-full rounded-t-2xl border-b"
        style={{ backgroundColor: theme.surfaceAlt, borderColor: theme.border }}
      />
      <div className={`flex flex-1 flex-col ${isLarge ? 'p-4 sm:p-5' : 'p-3.5'}`}>
        <Skeleton className="h-3 w-16 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
        <Skeleton className="mt-3 h-4 w-[88%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
        <Skeleton className="mt-2 h-4 w-[65%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
        <Skeleton className="mt-2 h-3 w-20 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
          <Skeleton className="h-4 w-12 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
        </div>
        <Skeleton className={`mt-3 w-full rounded-lg ${isLarge ? 'h-11' : 'h-10'}`} style={{ backgroundColor: theme.primary }} />
      </div>
    </div>
  );
}

/** Grid of `StorefrontProductCardSkeleton` — shared by the home page's
 * catalog section, `StoreCatalogPage`, and any "recommended for you" rail,
 * so all three ever only diverge in column count / item count. */
export function StorefrontProductGridSkeleton({
  branding,
  theme: themeOverride,
  isMenu: isMenuOverride,
  count = 6,
  columnsClassName = 'grid-cols-2 md:grid-cols-3',
  size = 'default',
  title = null,
}: {
  branding?: StorefrontBrandingLike | null;
  /** Pass an already-resolved theme/isMenu (e.g. from a page that built its
   * own `StorefrontTheme`) instead of a raw branding object. Takes
   * precedence over `branding` when provided. */
  theme?: StorefrontTheme;
  isMenu?: boolean;
  count?: number;
  columnsClassName?: string;
  size?: 'default' | 'large';
  title?: string | null;
}) {
  const theme = themeOverride ?? buildThemeFromBranding(branding);
  const isMenu = isMenuOverride ?? branding?.catalogType === 'menu';

  return (
    <SkeletonRegion label={isMenu ? 'Cargando el menú…' : 'Cargando productos…'}>
      {title ? (
        <div className="mb-4 flex items-center gap-2">
          {isMenu ? (
            <UtensilsCrossed className="h-5 w-5" style={{ color: theme.primary }} />
          ) : (
            <Package className="h-5 w-5" style={{ color: theme.primary }} />
          )}
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
      ) : null}

      <div className={`grid gap-4 ${columnsClassName}`}>
        {Array.from({ length: count }).map((_, index) => (
          <StorefrontProductCardSkeleton key={index} theme={theme} size={size} />
        ))}
      </div>
    </SkeletonRegion>
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
  const isMenu = branding?.catalogType === 'menu';

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
          <section className="w-full pb-8 pt-0 md:pb-12" aria-hidden="true">
            <div className="relative overflow-hidden px-6 pb-10 pt-[130px] md:px-10 md:pb-12 md:pt-[144px] lg:px-14">
              <div className={`mx-auto grid ${STOREFRONT_CONTAINER_CLASS} items-center gap-10 px-4 md:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12`}>
                <div className="order-2 flex items-center lg:order-1 lg:min-h-[460px]">
                  <div className="mx-auto flex w-full max-w-[620px] flex-col items-center text-center lg:mx-0 lg:max-w-[560px] lg:items-start lg:text-left">
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-[280px] rounded-[18px] sm:h-14 sm:w-[340px] md:h-16 md:w-[420px]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.56)' }} />
                      <Skeleton className="h-12 w-[220px] rounded-[18px] sm:h-14 sm:w-[290px] md:h-16 md:w-[340px]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.56)' }} />
                    </div>
                    <div className="mt-5 space-y-2">
                      <Skeleton className="h-4 w-[240px] rounded-full sm:w-[300px] md:w-[360px]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.46)' }} />
                      <Skeleton className="h-4 w-[190px] rounded-full sm:w-[250px] md:w-[300px]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.46)' }} />
                    </div>
                    <div className="mt-8 w-full max-w-[320px] sm:max-w-[360px] lg:max-w-none">
                      <Skeleton className="h-[52px] w-full rounded-full lg:h-[46px] lg:w-[176px]" style={{ backgroundColor: theme.primary }} />
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
                      <Skeleton className="h-[78%] w-[72%] rounded-[42%_42%_26%_26%/38%_38%_22%_22%]" style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.72)' }} />
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
          <StorefrontProductGridSkeleton
            branding={branding}
            title={isMenu ? 'Menú' : 'Catálogo'}
            columnsClassName="grid-cols-2 md:grid-cols-3"
            count={6}
          />
        </div>
      </section>
    </div>
  );
}

/** @deprecated kept for existing call sites — delegates to
 * `StorefrontProductGridSkeleton`, which is the shared implementation. */
export function StorefrontCatalogGridSkeleton({
  branding,
  title = null,
  columnsClassName = 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
  count = 8,
}: {
  branding?: StorefrontBrandingLike | null;
  title?: string | null;
  columnsClassName?: string;
  count?: number;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <StorefrontProductGridSkeleton
        branding={branding}
        title={title}
        columnsClassName={columnsClassName}
        count={count}
        size="large"
      />
    </div>
  );
}

function SkeletonBreadcrumb({ theme }: { theme: StorefrontTheme }) {
  return (
    <div className="mb-4 flex items-center gap-1" aria-hidden="true">
      <Skeleton className="h-3 w-10 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
      <ChevronRight className="h-3 w-3 shrink-0" style={{ color: theme.mutedText }} />
      <Skeleton className="h-3 w-16 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
      <ChevronRight className="h-3 w-3 shrink-0" style={{ color: theme.mutedText }} />
      <Skeleton className="h-3 w-24 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
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
      <main className={`mx-auto ${STOREFRONT_CONTAINER_CLASS} px-4 py-6 lg:px-6 lg:py-8`}>
        <SkeletonBreadcrumb theme={theme} />
        <Link
          to={buildStorefrontPath(storeSlug)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: theme.text }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>

        <SkeletonRegion label="Cargando producto…" className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-10 lg:items-start">
          <section className="grid gap-3 lg:grid-cols-[56px_minmax(0,1fr)] lg:items-start">
            <div className="order-2 flex gap-2 overflow-x-auto pb-2 lg:order-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-12 w-12 shrink-0 rounded-sm border lg:h-16 lg:w-16"
                  style={{ backgroundColor: theme.surfaceAlt, borderColor: theme.border }}
                />
              ))}
            </div>
            <div className="order-1 lg:order-2">
              <Skeleton
                className="aspect-square w-full rounded-sm border"
                style={{ backgroundColor: theme.surfaceAlt, borderColor: theme.border }}
              />
            </div>
          </section>

          <div className="space-y-5 pt-1">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
              <Skeleton className="h-7 w-[80%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
              <Skeleton className="h-4 w-[55%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
              <Skeleton className="h-7 w-32 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
            </div>

            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-14 rounded-md border" style={{ backgroundColor: theme.surfaceAlt, borderColor: theme.border }} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-11 rounded-md border" style={{ backgroundColor: theme.surface, borderColor: theme.border }} />
              ))}
            </div>

            <Skeleton className="h-[52px] w-full rounded-full" style={{ backgroundColor: theme.primary }} />

            <div className="rounded-[24px] border p-4" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
              <Skeleton className="h-4 w-24 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
              <Skeleton className="mt-4 h-16 w-full rounded-2xl" style={{ backgroundColor: theme.surfaceAlt }} />
            </div>
          </div>
        </SkeletonRegion>
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
          to={buildStorefrontPath(storeSlug)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: theme.text }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la tienda
        </Link>

        <SkeletonRegion label="Cargando oferta…">
          <Skeleton className="mb-6 aspect-video w-full rounded-2xl" style={{ backgroundColor: theme.surfaceAlt }} />

          <div className="mb-4 space-y-2">
            <Skeleton className="h-3 w-28 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
            <Skeleton className="h-8 w-[78%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
            <Skeleton className="h-4 w-[45%] rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
          </div>

          <div className="my-6 flex justify-center gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="text-center">
                <Skeleton className="h-16 w-16 rounded-xl" style={{ backgroundColor: theme.softPrimary }} />
                <Skeleton className="mx-auto mt-1 h-2.5 w-8 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
              </div>
            ))}
          </div>

          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="h-9 w-36 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
            <Skeleton className="h-6 w-20 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
          </div>

          <div className="mb-6 rounded-xl border-2 border-dashed p-4 text-center" style={{ borderColor: theme.border }}>
            <Skeleton className="mx-auto h-2.5 w-24 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
            <Skeleton className="mx-auto mt-2 h-7 w-32 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
          </div>

          <Skeleton className="h-14 w-full rounded-2xl" style={{ backgroundColor: theme.primary }} />

          <div className="mt-8 border-t pt-6" style={{ borderColor: theme.border }}>
            <Skeleton className="h-3 w-32 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
            <Skeleton className="mt-3 h-12 w-full rounded-xl" style={{ backgroundColor: theme.surfaceAlt }} />
          </div>
        </SkeletonRegion>
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
            to={buildStorefrontPath(storeSlug)}
            className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: theme.mutedText }}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la tienda
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="mb-8 h-8 w-60 rounded-full" style={{ backgroundColor: theme.surfaceAlt }} />
        <SkeletonRegion label="Cargando políticas…" className="space-y-8">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-[24px] border p-4" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
              <Skeleton className="mb-3 h-5 w-40 rounded-full" style={{ backgroundColor: theme.softPrimary }} />
              <Skeleton className="h-16 w-full rounded-[18px]" style={{ backgroundColor: theme.surfaceAlt }} />
            </div>
          ))}
        </SkeletonRegion>
      </main>
    </div>
  );
}
