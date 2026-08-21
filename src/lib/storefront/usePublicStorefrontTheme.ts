import { useMemo } from 'react';
import type { PublicCategoryExperience } from '@/types/common.types';
import { usePublicStoreExperience } from '@/components/layout/PublicStoreExperienceContext';
import { buildStorefrontTheme, type StorefrontTheme } from '@/components/public/storefront/storefrontTheme';

interface StorefrontThemeSource {
  themeMode?: 'light' | 'dark' | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  buttonRadius?: string | null;
}

export function buildThemeWithExperience(
  source: StorefrontThemeSource | null | undefined,
  experience: PublicCategoryExperience | null,
): StorefrontTheme {
  return buildStorefrontTheme({
    mode: experience?.themeMode ?? source?.themeMode,
    primaryColor: experience?.primaryColor ?? source?.primaryColor,
    secondaryColor: experience?.secondaryColor ?? source?.secondaryColor,
    accentColor: experience?.accentColor ?? source?.accentColor,
    backgroundColor: experience?.backgroundColor ?? source?.backgroundColor,
    textColor: experience?.textColor ?? source?.textColor,
    buttonRadius: experience?.buttonRadius ?? source?.buttonRadius,
  });
}

export function usePublicStorefrontTheme(source: StorefrontThemeSource | null | undefined): StorefrontTheme {
  const { activeExperience } = usePublicStoreExperience();
  return useMemo(
    () => buildThemeWithExperience(source, activeExperience),
    [activeExperience, source],
  );
}
