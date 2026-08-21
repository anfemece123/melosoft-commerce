import { createContext, useContext } from 'react';
import type { PublicCategoryExperience } from '@/types/common.types';

interface PublicStoreExperienceContextValue {
  experiences: PublicCategoryExperience[];
  activeExperience: PublicCategoryExperience | null;
}

const PublicStoreExperienceContext = createContext<PublicStoreExperienceContextValue>({
  experiences: [],
  activeExperience: null,
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
