import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, matchPath, useLocation, useNavigationType } from 'react-router-dom';
import { CartDrawer } from '@/components/public/cart/CartDrawer';
import { StorefrontFooter } from '@/components/public/storefront/StorefrontFooter';
import { StorefrontHeader } from '@/components/public/storefront/StorefrontHeader';
import { StorefrontPageLoader } from '@/components/public/storefront/StorefrontPageLoader';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { storesService } from '@/features/stores/storesService';
import { categoriesService, buildCategoryTree } from '@/features/categories/categoriesService';
import { collectionsService } from '@/features/collections/collectionsService';
import { facetsService } from '@/features/facets/facetsService';
import { productsService } from '@/features/products/productsService';
import {
  canUseWebOrders,
  type PublicCommerceConfig,
} from '@/lib/commerce/commerceConfig.utils';
import { CartProvider, useCart } from '@/lib/cart/cartContext';
import type { CatalogMeta, PublicStorePage, PublicStoreCategory } from '@/types/common.types';
import { readCachedPublicStoreBranding, writeCachedPublicStoreBranding } from '@/lib/storefront/publicStoreBrandingCache';
import { PublicStoreBrandingProvider } from './PublicStoreBrandingContext';
import { PublicLocationProvider } from '@/lib/locations/locationContext';
import { PublicRouteReadyProvider } from './PublicRouteReadyContext';
import { readPublicScrollPosition, writePublicScrollPosition } from '@/lib/storefront/publicScrollRestoration';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { OrderingStatusNotice } from '@/components/public/cart/OrderingStatusNotice';
import { pruneEmptyCategoryTree, pruneEmptyCollections } from '@/lib/storefront/catalogVisibility';
import { useStorefrontDocumentMetadata } from '@/lib/storefront/useStorefrontDocumentMetadata';
import {
  isStorefrontHostnameMode,
  useStorefrontDomain,
} from '@/lib/storefront/storefrontDomainContext';
import { domainsService } from '@/features/domains/domainsService';

export function PublicLayout() {
  const location = useLocation();
  const { mode: domainMode, resolution: domainResolution } = useStorefrontDomain();
  const matchedRoute = [
    matchPath('/s/:storeSlug/checkout', location.pathname),
    matchPath('/s/:storeSlug/payment-result', location.pathname),
    matchPath('/s/:storeSlug/cart', location.pathname),
    matchPath('/s/:storeSlug/p/:productSlug', location.pathname),
    matchPath('/s/:storeSlug/o/:offerSlug', location.pathname),
    matchPath('/s/:storeSlug/policies', location.pathname),
    matchPath('/s/:storeSlug/catalog', location.pathname),
    matchPath('/s/:storeSlug', location.pathname),
  ].find(Boolean);
  const storeSlug = matchedRoute?.params.storeSlug ??
    (isStorefrontHostnameMode(domainMode) ? domainResolution?.storeSlug ?? null : null);

  const [branding, setBranding] = useState<PublicStorePage | null>(() =>
    storeSlug ? readCachedPublicStoreBranding(storeSlug) : null
  );
  const [loading, setLoading] = useState(Boolean(storeSlug && !branding));

  useEffect(() => {
    if (!storeSlug) {
      setBranding(null);
      setLoading(false);
      return;
    }

    const resolvedStoreSlug = storeSlug;
    const cachedBranding = readCachedPublicStoreBranding(resolvedStoreSlug);
    if (cachedBranding) {
      setBranding(cachedBranding);
      setLoading(false);
    } else {
      setBranding(null);
      setLoading(true);
    }

    let cancelled = false;

    async function loadBranding() {
      try {
        const data = await storesService.getPublicStoreBySlug(resolvedStoreSlug);
        if (cancelled) return;
        setBranding(data);
        writeCachedPublicStoreBranding(resolvedStoreSlug, data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBranding();

    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  if (storeSlug && loading && !branding) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <PublicStoreBrandingProvider value={{ storeSlug, branding, loading }}>
      {storeSlug ? (
        <PublicLocationProvider storeSlug={storeSlug}>
          <CartProvider key={storeSlug} storeSlug={storeSlug}>
            <PublicStoreShell storeSlug={storeSlug} branding={branding} loading={loading} />
          </CartProvider>
        </PublicLocationProvider>
      ) : (
        <div className="min-h-screen bg-gray-50">
          <Outlet />
        </div>
      )}
    </PublicStoreBrandingProvider>
  );
}

function PublicStoreShell({
  storeSlug,
  branding,
  loading,
}: {
  storeSlug: string;
  branding: PublicStorePage | null;
  loading: boolean;
}) {
  const location = useLocation();
  const { mode: domainMode } = useStorefrontDomain();
  const navigationType = useNavigationType();
  const { totalItems } = useCart();
  const { locations, selectedLocation, orderStatus, scheduleLoading } = useSelectedLocation();
  const [cartOpen, setCartOpen] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [catalogMeta, setCatalogMeta] = useState<CatalogMeta | null>(null);
  const routeKey = `${location.pathname}${location.search}${location.hash}`;
  const pendingScrollModeRef = useRef<'restore' | 'top'>('top');

  // Canonical during the /s/:slug ↔ subdomain transition: on a real
  // storefront host (subdomain or verified custom domain) the current
  // page IS the canonical URL. On the platform host (dev, or prod before
  // the wildcard is configured) it points at whatever
  // getPlatformStoreUrl resolves to today — the subdomain once
  // VITE_STOREFRONT_ROOT_DOMAIN is set, or this same /s/:slug page
  // otherwise — so it is never a fabricated or duplicate-content URL.
  const legacyPrefix = `/s/${storeSlug}`;
  const canonicalSuffix = location.pathname === legacyPrefix
    ? '/'
    : location.pathname.startsWith(`${legacyPrefix}/`)
      ? location.pathname.slice(legacyPrefix.length)
      : location.pathname;
  const canonicalUrl = isStorefrontHostnameMode(domainMode)
    ? `${window.location.origin}${canonicalSuffix}${location.search}`
    : `${domainsService.getPlatformStoreUrl(storeSlug)}${canonicalSuffix === '/' ? '' : canonicalSuffix}${location.search}`;

  useStorefrontDocumentMetadata(
    branding?.storeName,
    branding?.faviconUrl,
    branding?.logoUrl,
    branding?.description,
    canonicalUrl,
  );

  const commerceConfig: PublicCommerceConfig = {
    catalogType: branding?.catalogType ?? null,
    commerceMode: branding?.commerceMode ?? null,
    allowsPickup: branding?.allowsPickup ?? null,
    allowsLocalDelivery: branding?.allowsLocalDelivery ?? null,
    allowsNationalShipping: branding?.allowsNationalShipping ?? null,
    whatsappCheckoutEnabled: branding?.whatsappCheckoutEnabled ?? null,
    webOrderEnabled: branding?.webOrderEnabled ?? null,
    cashOnDeliveryEnabled: branding?.cashOnDeliveryEnabled ?? null,
    onlineCheckoutEnabled: branding?.onlineCheckoutEnabled ?? null,
    localDeliveryNotes: branding?.localDeliveryNotes ?? null,
    shippingNotes: branding?.shippingNotes ?? null,
  };
  const theme = buildStorefrontTheme({
    mode: branding?.themeMode,
    primaryColor: branding?.primaryColor,
    secondaryColor: branding?.secondaryColor,
    accentColor: branding?.accentColor,
    backgroundColor: branding?.backgroundColor,
    textColor: branding?.textColor,
    buttonRadius: branding?.buttonRadius,
  });
  const hasHeroRoute = Boolean(matchPath('/s/:storeSlug', location.pathname)) ||
    (isStorefrontHostnameMode(domainMode) && location.pathname === '/');
  const hasHero = hasHeroRoute && branding?.heroEnabled !== false;
  const showCart = canUseWebOrders(commerceConfig);

  useEffect(() => {
    if (!storeSlug) return;
    let cancelled = false;
    Promise.all([
      categoriesService.getPublicCategories(storeSlug),
      collectionsService.getPublicCollections(storeSlug),
      facetsService.getPublicFacets(storeSlug),
      productsService.getPublicProductsByStoreSlug(storeSlug),
    ]).then(([cats, cols, facets, products]) => {
      if (cancelled) return;
      const categoryTree = pruneEmptyCategoryTree(buildCategoryTree(cats), products);
      const nonEmptyCollections = pruneEmptyCollections(cols, products);
      const priceRange = products.reduce(
        (acc, product) => {
          const activePrice = product.salePrice ?? product.regularPrice;
          return {
            min: Math.min(acc.min, activePrice),
            max: Math.max(acc.max, activePrice),
          };
        },
        { min: Number.POSITIVE_INFINITY, max: 0 },
      );
      setCatalogMeta({
        categories: cats,
        categoryTree,
        collections: nonEmptyCollections,
        facets,
        megaMenuFacets: facets.filter((f) => f.showInMegaMenu),
        products,
        priceRange: {
          min: priceRange.min === Number.POSITIVE_INFINITY ? 0 : priceRange.min,
          max: priceRange.max,
        },
      });
    }).catch(() => { /* catalog meta is optional */ });
    return () => { cancelled = true; };
  }, [storeSlug]);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Defensive cleanup: CartDrawer must never survive a route change (e.g.
  // browser back/forward while it's open). PublicStoreShell stays mounted
  // across nested public route navigations, so cartOpen otherwise persists
  // and its fixed, z-50 panel keeps covering the header on the new page.
  useEffect(() => {
    setCartOpen(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    setRouteReady(false);
    pendingScrollModeRef.current =
      location.state?.restoreScroll === true || navigationType === 'POP'
        ? 'restore'
        : 'top';

    if (location.state?.restoreScroll !== true && navigationType !== 'POP') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location.state, routeKey, navigationType]);

  useEffect(() => {
    let ticking = false;

    function persistScrollPosition() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        writePublicScrollPosition(routeKey, window.scrollY);
        ticking = false;
      });
    }

    persistScrollPosition();
    window.addEventListener('scroll', persistScrollPosition, { passive: true });

    return () => {
      window.removeEventListener('scroll', persistScrollPosition);
      writePublicScrollPosition(routeKey, window.scrollY);
    };
  }, [routeKey]);

  useEffect(() => {
    function handleBeforeUnload() {
      writePublicScrollPosition(routeKey, window.scrollY);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [routeKey]);

  useEffect(() => {
    if (!routeReady) return;

    let timeoutId: number | null = null;

    const restore = (attempt = 0) => {
      if (pendingScrollModeRef.current === 'restore') {
        const restoreKey = typeof location.state?.restoreScrollKey === 'string'
          ? location.state.restoreScrollKey
          : routeKey;
        const scrollTop = readPublicScrollPosition(restoreKey);
        const maxScrollableTop = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight
        );

        if (scrollTop > maxScrollableTop && attempt < 12) {
          timeoutId = window.setTimeout(() => restore(attempt + 1), 60);
          return;
        }

        window.scrollTo({
          top: Math.min(scrollTop, maxScrollableTop),
          left: 0,
          behavior: 'auto',
        });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    };

    const frameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => restore());
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [location.state, routeKey, routeReady]);

  return (
    <PublicRouteReadyProvider value={{ setRouteReady }}>
      <div className="min-h-screen" style={{ backgroundColor: theme.background }}>
        {branding ? (
          <StorefrontHeader
            theme={theme}
            storeName={branding.storeName}
            storeSlug={storeSlug}
            logoUrl={branding.logoUrl}
            slogan={branding.slogan}
            catalogType={branding.catalogType}
            hasHero={hasHero}
            showCart={showCart}
            cartCount={totalItems}
            onCartOpen={() => setCartOpen(true)}
            onRequestCloseCart={() => setCartOpen(false)}
            headerSettings={branding.headerSettings}
            categories={(catalogMeta?.categoryTree ?? []).filter((c: PublicStoreCategory) => c.showInMenu)}
            catalogMeta={catalogMeta}
          />
        ) : null}

        {showCart && selectedLocation && (scheduleLoading || orderStatus?.isAcceptingOrders !== true) ? (
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-3 sm:px-6 lg:px-8">
            <OrderingStatusNotice theme={theme} showWhenOpen={false} />
          </div>
        ) : null}

        {loading && branding ? (
          <StorefrontPageLoader branding={branding} label="Preparando la experiencia de esta empresa." />
        ) : (
          <Outlet />
        )}

        {branding ? (
          <StorefrontFooter
            theme={theme}
            branding={branding}
            locations={locations}
          />
        ) : null}

        {branding && cartOpen ? (
          <CartDrawer
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            theme={theme}
            storeName={branding.storeName}
            storeSlug={storeSlug}
            currency={branding.currency}
            whatsappNumber={branding.whatsappNumber}
            allowsPickup={branding.allowsPickup}
            allowsLocalDelivery={branding.allowsLocalDelivery}
            allowsNationalShipping={branding.allowsNationalShipping}
            localDeliveryNotes={branding.localDeliveryNotes}
            shippingNotes={branding.shippingNotes}
            localDeliveryBaseFee={branding.localDeliveryBaseFee}
            localDeliveryFreeFrom={branding.localDeliveryFreeFrom}
            nationalShippingBaseFee={branding.nationalShippingBaseFee}
            nationalShippingFreeFrom={branding.nationalShippingFreeFrom}
            cashOnDeliveryEnabled={branding.cashOnDeliveryEnabled}
            onlineCheckoutEnabled={branding.onlineCheckoutEnabled}
          />
        ) : null}
      </div>
    </PublicRouteReadyProvider>
  );
}
