import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PublicCategoryExperience } from '@/types/common.types';
import { buildStorefrontTheme } from '../storefrontTheme';
import { buildExperienceBackdropStyle } from '@/lib/storefront/experienceAmbience';
import { ExperienceBackdrop } from './ExperienceBackdrop';
import { ExperienceGateway } from './ExperienceGateway';
import { ExperienceSwitcher } from './ExperienceSwitcher';

function makeExperience(overrides: Partial<PublicCategoryExperience>): PublicCategoryExperience {
  return {
    id: 'sushi',
    storeId: 'store-1',
    storeSlug: 'dos-cocinas',
    categoryId: 'cat-sushi',
    categoryName: 'Sushi',
    categorySlug: 'sushi',
    displayName: 'Sakura',
    description: 'Rolls de autor',
    logoUrl: null,
    coverImageUrl: null,
    themeMode: 'dark',
    primaryColor: '#e11d48',
    secondaryColor: '#1f2937',
    accentColor: '#f59e0b',
    backgroundColor: '#0b0f14',
    textColor: '#f8fafc',
    buttonRadius: '9999px',
    tagline: 'Cocina japonesa',
    backgroundStyle: 'pattern',
    backgroundPattern: 'waves',
    backgroundImageUrl: null,
    backgroundIntensity: 45,
    headingFont: 'modern',
    sortOrder: 0,
    ...overrides,
  };
}

const sushi = makeExperience({});
const pizza = makeExperience({
  id: 'pizza',
  categoryId: 'cat-pizza',
  categorySlug: 'pizza',
  displayName: 'Forno',
  themeMode: 'light',
  backgroundStyle: 'solid',
  headingFont: 'bold',
  coverImageUrl: 'https://example.com/pizza.webp',
});

describe('experience ambience', () => {
  it('builds an svg pattern layer for pattern backgrounds', () => {
    const style = buildExperienceBackdropStyle(sushi);
    expect(style.backgroundColor).toBe('#0b0f14');
    expect(String(style.backgroundImage)).toContain('data:image/svg+xml');
  });

  it('only paints the backdrop for decorated experiences', () => {
    const { rerender } = render(<ExperienceBackdrop experience={sushi} />);
    expect(screen.getByTestId('experience-backdrop')).not.toBeNull();
    rerender(<ExperienceBackdrop experience={pizza} />);
    expect(screen.queryByTestId('experience-backdrop')).toBeNull();
  });
});

describe('ExperienceGateway', () => {
  it('renders one panel per experience linking to its catalog', () => {
    render(
      <MemoryRouter>
        <ExperienceGateway
          gateway={{ storeId: 'store-1', placement: 'replace_hero', title: 'Dos cocinas, una mesa', subtitle: null }}
          experiences={[sushi, pizza]}
          theme={buildStorefrontTheme({})}
          storeSlug="dos-cocinas"
          storeName="Dos Cocinas"
          storeLogoUrl={null}
          isMenu
          asPortada
        />
      </MemoryRouter>,
    );

    const panels = screen.getAllByTestId('experience-gateway-panel');
    expect(panels).toHaveLength(2);
    expect(panels[0].getAttribute('href')).toBe('/s/dos-cocinas/catalog?cat=sushi');
    expect(panels[1].getAttribute('href')).toBe('/s/dos-cocinas/catalog?cat=pizza');
    expect(screen.getByRole('heading', { name: 'Dos cocinas, una mesa' })).not.toBeNull();
    expect(screen.getAllByText('Ver menú')).toHaveLength(2);
  });
});

describe('ExperienceSwitcher', () => {
  it('marks the active experience', () => {
    render(
      <MemoryRouter>
        <ExperienceSwitcher
          experiences={[sushi, pizza]}
          activeExperience={pizza}
          theme={buildStorefrontTheme({})}
          storeSlug="dos-cocinas"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Forno/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /Sakura/ }).getAttribute('aria-current')).toBeNull();
  });
});
