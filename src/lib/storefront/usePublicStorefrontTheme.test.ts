import { describe, expect, it } from 'vitest';
import { buildThemeWithExperience } from './usePublicStorefrontTheme';
import type { PublicCategoryExperience } from '@/types/common.types';

const experience: PublicCategoryExperience = {
  id: 'experience-1',
  storeId: 'store-1',
  storeSlug: 'modo',
  categoryId: 'category-1',
  categoryName: 'Pádel',
  categorySlug: 'padel',
  displayName: 'Modo Pádel',
  description: null,
  logoUrl: null,
  coverImageUrl: null,
  themeMode: 'dark',
  primaryColor: '#16a34a',
  secondaryColor: '#dcfce7',
  accentColor: '#facc15',
  backgroundColor: '#052e16',
  textColor: '#f0fdf4',
  buttonRadius: '14px',
  sortOrder: 0,
};

describe('buildThemeWithExperience', () => {
  it('overrides only the store theme values supplied by the active experience', () => {
    const theme = buildThemeWithExperience({
      mode: 'light',
      primaryColor: '#4f46e5',
      backgroundColor: '#ffffff',
      textColor: '#111827',
    }, experience);

    expect(theme.mode).toBe('dark');
    expect(theme.primary).toBe('#16a34a');
    expect(theme.background).toBe('#052e16');
    expect(theme.text).toBe('#f0fdf4');
    expect(theme.radius).toBe('14px');
  });

  it('keeps the company theme when no experience is active', () => {
    const theme = buildThemeWithExperience({
      mode: 'light',
      primaryColor: '#4f46e5',
      backgroundColor: '#ffffff',
      textColor: '#111827',
    }, null);

    expect(theme.mode).toBe('light');
    expect(theme.primary).toBe('#4f46e5');
    expect(theme.background).toBe('#ffffff');
  });
});
