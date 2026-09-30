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
  tagline: null,
  backgroundStyle: 'solid',
  backgroundPattern: 'dots',
  backgroundImageUrl: null,
  backgroundIntensity: 50,
  headingFont: 'default',
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

  it('makes page roots transparent and exposes the heading font when the experience has ambience', () => {
    const theme = buildThemeWithExperience(
      { backgroundColor: '#ffffff' },
      { ...experience, backgroundStyle: 'pattern', headingFont: 'elegant' },
    );

    expect(theme.canvas).toBe('transparent');
    expect(theme.background).toBe('#052e16');
    expect(theme.headingFontFamily).toContain('Playfair Display');
  });

  it('keeps a solid canvas for an image background without an image', () => {
    const theme = buildThemeWithExperience(null, { ...experience, backgroundStyle: 'image', backgroundImageUrl: null });

    expect(theme.canvas).toBe('#052e16');
    expect(theme.headingFontFamily).toBeNull();
  });
});
