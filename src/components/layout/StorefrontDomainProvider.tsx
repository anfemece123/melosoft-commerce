import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { domainsService } from '@/features/domains/domainsService';
import type { PublicDomainResolution } from '@/features/domains/domains.types';
import { env } from '@/lib/env';
import {
  StorefrontDomainContext,
  isStorefrontHostnameMode,
  type StorefrontDomainMode,
} from '@/lib/storefront/storefrontDomainContext';
import { setActiveStorefrontHostnameStore } from '@/lib/storefront/storefrontPaths';
import {
  RESERVED_STOREFRONT_SUBDOMAINS,
  isValidStorefrontSubdomain,
  normalizeStorefrontRootDomain,
} from '@/lib/storefront/storefrontSubdomains';

interface DomainState {
  mode: StorefrontDomainMode;
  resolution: PublicDomainResolution | null;
}

function configuredPlatformHostnames(): Set<string> {
  const hostnames = new Set<string>(['localhost', '127.0.0.1', '::1']);
  if (env.publicSiteUrl) {
    try {
      hostnames.add(new URL(env.publicSiteUrl).hostname.toLowerCase());
    } catch {
      // The environment warning is surfaced in the domain settings screen.
    }
  }
  for (const hostname of env.platformHostnames?.split(',') ?? []) {
    const normalized = hostname.trim().toLowerCase();
    if (normalized) hostnames.add(normalized);
  }
  const rootDomain = normalizeStorefrontRootDomain(env.storefrontRootDomain);
  if (rootDomain) {
    hostnames.add(rootDomain);
    for (const subdomain of RESERVED_STOREFRONT_SUBDOMAINS) {
      hostnames.add(`${subdomain}.${rootDomain}`);
    }
  }
  return hostnames;
}

function includedStoreSlug(hostname: string): string | null {
  const rootDomain = normalizeStorefrontRootDomain(env.storefrontRootDomain);
  if (!rootDomain || !hostname.endsWith(`.${rootDomain}`)) return null;
  const subdomain = hostname.slice(0, -(rootDomain.length + 1));
  if (!subdomain || subdomain.includes('.') || RESERVED_STOREFRONT_SUBDOMAINS.has(subdomain)) {
    return null;
  }
  return subdomain;
}

export function StorefrontDomainProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
  const isPlatformHost = configuredPlatformHostnames().has(hostname);
  const [state, setState] = useState<DomainState>(() => ({
    mode: isPlatformHost ? 'platform' : 'loading',
    resolution: null,
  }));

  useEffect(() => {
    let cancelled = false;
    if (isPlatformHost) {
      setActiveStorefrontHostnameStore(null);
      return;
    }

    const storeSlug = includedStoreSlug(hostname);
    const resolutionRequest = storeSlug
      ? domainsService.resolvePublicSubdomain(storeSlug, hostname)
      : domainsService.resolvePublicHostname(hostname);

    resolutionRequest
      .then((resolution) => {
        if (cancelled) return;
        setActiveStorefrontHostnameStore(resolution?.storeSlug ?? null);
        setState({
          mode: resolution ? (storeSlug ? 'subdomain' : 'custom') : 'unrecognized',
          resolution,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setActiveStorefrontHostnameStore(null);
        setState({ mode: 'unrecognized', resolution: null });
      });

    return () => {
      cancelled = true;
    };
  }, [hostname, isPlatformHost]);

  useEffect(() => {
    const rootDomain = normalizeStorefrontRootDomain(env.storefrontRootDomain);
    if (!isPlatformHost || !rootDomain || ['localhost', '127.0.0.1', '::1'].includes(hostname)) return;

    const legacyMatch = location.pathname.match(/^\/s\/([^/]+)(\/.*)?$/);
    const storeSlug = legacyMatch?.[1]?.toLowerCase() ?? '';
    if (!legacyMatch || !isValidStorefrontSubdomain(storeSlug)) return;

    let cancelled = false;
    const storefrontHostname = `${storeSlug}.${rootDomain}`;
    domainsService.resolvePublicSubdomain(storeSlug, storefrontHostname)
      .then((resolution) => {
        if (cancelled || !resolution) return;
        const suffix = legacyMatch[2] ?? '/';
        window.location.replace(
          `https://${storefrontHostname}${suffix}${location.search}${location.hash}`,
        );
      })
      .catch(() => undefined);

    return () => { cancelled = true; };
  }, [hostname, isPlatformHost, location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!isStorefrontHostnameMode(state.mode) || !state.resolution) return;
    const internalPrefix = `/s/${state.resolution.storeSlug}`;
    if (location.pathname !== internalPrefix && !location.pathname.startsWith(`${internalPrefix}/`)) return;

    const cleanPath = location.pathname.slice(internalPrefix.length) || '/';
    void navigate(`${cleanPath}${location.search}${location.hash}`, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate, state]);

  useEffect(() => () => setActiveStorefrontHostnameStore(null), []);

  const value = useMemo(() => ({ ...state, hostname }), [hostname, state]);
  return (
    <StorefrontDomainContext.Provider value={value}>
      {children}
    </StorefrontDomainContext.Provider>
  );
}
