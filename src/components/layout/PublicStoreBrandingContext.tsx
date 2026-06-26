import { createContext, useContext } from 'react';
import type { PublicStorePage } from '@/types/common.types';

interface PublicStoreBrandingContextValue {
  storeSlug: string | null;
  branding: PublicStorePage | null;
  loading: boolean;
}

const PublicStoreBrandingContext = createContext<PublicStoreBrandingContextValue>({
  storeSlug: null,
  branding: null,
  loading: false,
});

export function PublicStoreBrandingProvider({
  value,
  children,
}: {
  value: PublicStoreBrandingContextValue;
  children: React.ReactNode;
}) {
  return (
    <PublicStoreBrandingContext.Provider value={value}>
      {children}
    </PublicStoreBrandingContext.Provider>
  );
}

export function usePublicStoreBranding() {
  return useContext(PublicStoreBrandingContext);
}
