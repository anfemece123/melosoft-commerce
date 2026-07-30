import { useEffect, useState } from 'react';
import { Outlet, matchPath, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { storesService } from '@/features/stores/storesService';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
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

    const cached = readCachedPublicStoreBranding(storeSlug);
    if (cached) {
      setBranding(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;
    storesService.getPublicStoreBySlug(storeSlug)
      .then((data) => {
        if (cancelled) return;
        setBranding(data);
        writeCachedPublicStoreBranding(storeSlug, data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <Loader2 className="h-7 w-7 animate-spin motion-reduce:animate-none" style={{ color: theme.primary }} aria-hidden="true" />
      </div>
    );
  }

  return (
    <PublicStoreBrandingProvider value={{ storeSlug, branding, loading }}>
      <div className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.text, ...theme.cssVars }}>
        <Outlet context={{ storeSlug, branding, theme }} />
      </div>
    </PublicStoreBrandingProvider>
  );
}
