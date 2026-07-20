import { createContext, useContext } from 'react';
import type { PublicDomainResolution } from '@/features/domains/domains.types';

export type StorefrontDomainMode =
  | 'loading'
  | 'platform'
  | 'subdomain'
  | 'custom'
  | 'unrecognized';

export interface StorefrontDomainContextValue {
  mode: StorefrontDomainMode;
  resolution: PublicDomainResolution | null;
  hostname: string;
}

export const StorefrontDomainContext = createContext<StorefrontDomainContextValue>({
  mode: 'loading',
  resolution: null,
  hostname: '',
});

export function useStorefrontDomain(): StorefrontDomainContextValue {
  return useContext(StorefrontDomainContext);
}

export function isStorefrontHostnameMode(mode: StorefrontDomainMode): boolean {
  return mode === 'subdomain' || mode === 'custom';
}

export function useResolvedStoreSlug(routeStoreSlug?: string): string | null {
  const { mode, resolution } = useStorefrontDomain();
  if (routeStoreSlug) return routeStoreSlug;
  return isStorefrontHostnameMode(mode) ? resolution?.storeSlug ?? null : null;
}
