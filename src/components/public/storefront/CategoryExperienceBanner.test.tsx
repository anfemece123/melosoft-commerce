import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryExperienceBanner } from './CategoryExperienceBanner';
import { buildStorefrontTheme } from './storefrontTheme';
import type { PublicCategoryExperience } from '@/types/common.types';

const experience: PublicCategoryExperience = {
  id: 'experience-1',
  storeId: 'store-1',
  storeSlug: 'demo',
  categoryId: 'category-1',
  categoryName: 'Pádel',
  categorySlug: 'padel',
  displayName: 'Modo Pádel',
  description: 'Todo para mejorar tu juego.',
  logoUrl: 'https://example.com/padel-logo.webp',
  coverImageUrl: 'https://example.com/padel-cover.webp',
  themeMode: 'dark',
  primaryColor: '#16a34a',
  secondaryColor: '#dcfce7',
  accentColor: '#facc15',
  backgroundColor: '#052e16',
  textColor: '#f0fdf4',
  buttonRadius: '14px',
  sortOrder: 0,
};

describe('CategoryExperienceBanner', () => {
  it('renders the contextual cover as an image-only home-sized hero', () => {
    render(
      <CategoryExperienceBanner
        theme={buildStorefrontTheme(experience)}
        experience={experience}
      />,
    );

    expect(screen.getByTestId('category-experience-banner')).not.toBeNull();
    const hero = screen.getByTestId('category-experience-banner');
    expect(hero.id).toBe('storefront-hero');
    expect(screen.queryByRole('heading', { name: 'Modo Pádel' })).toBeNull();
    expect(
      Array.from(hero.querySelectorAll<HTMLElement>('[style]'))
        .some((element) => element.style.backgroundImage.includes(experience.coverImageUrl ?? '')),
    ).toBe(true);
  });
});
