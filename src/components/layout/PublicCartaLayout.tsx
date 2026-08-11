import { useEffect, useState } from 'react';
import { Outlet, matchPath, useLocation } from 'react-router-dom';
import { storesService } from '@/features/stores/storesService';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { StorefrontPageLoader } from '@/components/public/storefront/StorefrontPageLoader';
import {
  isStorefrontHostnameMode,
  useStorefrontDomain,
} from '@/lib/storefront/storefrontDomainContext';
import { readCachedPublicStoreBranding, writeCachedPublicStoreBranding } from '@/lib/storefront/publicStoreBrandingCache';
import { PublicStoreBrandingProvider } from './PublicStoreBrandingContext';
import type { PublicStorePage } from '@/types/common.types';

/** Minimal public layout for "Carta digital" — deliberately does NOT reuse
 * PublicLayout, which always mounts CartProvider/CartDrawer and an ecommerce
 * nav header. The visual carta is meant to be checkout-free, so it only
 * resolves the store and paints its branding, nothing else. */
export function PublicCartaLayout() {
  const location = useLocation();
  const { mode: domainMode, resolution: domainResolution } = useStorefrontDomain();
  const matchedRoute = matchPath('/s/:storeSlug/carta', location.pathname);
  const storeSlug = matchedRoute?.params.storeSlug ??
    (isStorefrontHostnameMode(domainMode) ? domainResolution?.storeSlug ?? null : null);

  const cachedBranding = storeSlug ? readCachedPublicStoreBranding(storeSlug) : null;
  const [brandingResult, setBrandingResult] = useState<{ storeSlug: string; branding: PublicStorePage | null } | null>(null);
  const resultMatchesStore = Boolean(storeSlug && brandingResult?.storeSlug === storeSlug);
  const branding = resultMatchesStore ? brandingResult?.branding ?? null : cachedBranding;
  const loading = Boolean(storeSlug && !cachedBranding && !resultMatchesStore);

  useEffect(() => {
    if (!storeSlug) return;

    const cached = readCachedPublicStoreBranding(storeSlug);
    let cancelled = false;
    storesService.getPublicStoreBySlug(storeSlug)
      .then((data) => {
        if (cancelled) return;
        setBrandingResult({ storeSlug, branding: data });
        writeCachedPublicStoreBranding(storeSlug, data);
      })
      .catch(() => {
        if (!cancelled) setBrandingResult({ storeSlug, branding: cached });
      });

    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  const theme = buildStorefrontTheme({
    mode: branding?.themeMode ?? null,
    primaryColor: branding?.primaryColor ?? null,
    secondaryColor: branding?.secondaryColor ?? null,
    accentColor: branding?.accentColor ?? null,
    backgroundColor: branding?.backgroundColor ?? null,
    textColor: branding?.textColor ?? null,
    buttonRadius: branding?.buttonRadius ?? null,
  });

  if (loading) {
    return <StorefrontPageLoader label="Cargando carta digital…" />;
  }

  return (
    <PublicStoreBrandingProvider value={{ storeSlug, branding, loading }}>
      <div className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.text, ...theme.cssVars }}>
        <Outlet context={{ storeSlug, branding, theme }} />
      </div>
    </PublicStoreBrandingProvider>
  );
}
