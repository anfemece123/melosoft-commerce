import { createContext, useContext } from 'react';
import type { PublicCategoryExperience, PublicExperienceGateway } from '@/types/common.types';

interface PublicStoreExperienceContextValue {
  experiences: PublicCategoryExperience[];
  activeExperience: PublicCategoryExperience | null;
  /** Home gateway; only non-null when enabled AND there are 2+ experiences
   * to choose from. Doubles as the "multi-brand storefront" signal. */
  gateway: PublicExperienceGateway | null;
}

const PublicStoreExperienceContext = createContext<PublicStoreExperienceContextValue>({
  experiences: [],
  activeExperience: null,
  gateway: null,
});

export function PublicStoreExperienceProvider({
  value,
  children,
}: {
  value: PublicStoreExperienceContextValue;
  children: React.ReactNode;
}) {
  return (
    <PublicStoreExperienceContext.Provider value={value}>
      {children}
    </PublicStoreExperienceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePublicStoreExperience() {
  return useContext(PublicStoreExperienceContext);
}
