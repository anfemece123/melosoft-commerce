import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicStoreHeroSlide } from '@/types/common.types';
import { buildStorefrontTheme } from './storefrontTheme';
import { StorefrontHero } from './StorefrontHero';

const theme = buildStorefrontTheme({ primaryColor: '#4f46e5' });

function slide(id: string, sortOrder: number, title: string): PublicStoreHeroSlide {
  return {
    id,
    storeId: 'store',
    sortOrder,
    isActive: true,
    showTitle: true,
    showSubtitle: true,
    showCta: true,
    showMainImage: false,
    showBadgeImage: false,
    title,
    subtitle: `Descripción ${title}`,
    ctaLabel: `Abrir ${title}`,
    ctaTargetType: 'catalog',
    ctaTargetId: null,
    ctaTargetUrl: null,
    mainImageUrl: null,
    backgroundImageUrl: null,
    badgeImageUrl: null,
  };
}

function renderHero() {
  return render(
    <MemoryRouter>
      <StorefrontHero
        theme={theme}
        storeName="Restaurante Demo"
        storeLogoUrl={null}
        fallbackCtaLabel="Ver menú"
        slides={[slide('first', 1, 'Primera portada'), slide('second', 2, 'Segunda portada')]}
        getCtaHref={(item) => `/catalog?slide=${item.id}`}
      />
    </MemoryRouter>
  );
}

function pane(label: string): HTMLElement {
  const element = document.querySelector(`[aria-label="${label}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`No se encontró ${label}`);
  return element;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('StorefrontHero carousel', () => {
  it('does not render the main image circle when it is disabled', () => {
    renderHero();

    expect(screen.queryByTestId('hero-main-image-frame')).toBeNull();
  });

  it('changes slides through explicit controls without removing either pane', () => {
    renderHero();

    expect(pane('1 de 2').getAttribute('aria-hidden')).toBe('false');
    expect(pane('2 de 2').getAttribute('aria-hidden')).toBe('true');

    const nextButton = screen.getByRole('button', { name: 'Portada siguiente' });
    expect(nextButton.className).toContain('hidden');
    expect(nextButton.className).toContain('group-hover/hero:opacity-100');
    expect(screen.queryByRole('button', { name: /Pausar carrusel/i })).toBeNull();

    fireEvent.click(nextButton);

    expect(pane('1 de 2').getAttribute('aria-hidden')).toBe('true');
    expect(pane('2 de 2').getAttribute('aria-hidden')).toBe('false');
  });

  it('pauses on pointer interaction and resumes after the pointer leaves', () => {
    vi.useFakeTimers();
    const { container } = renderHero();
    const carousel = container.querySelector('#storefront-hero');
    if (!(carousel instanceof HTMLElement)) throw new Error('No se encontró la portada');

    fireEvent.mouseEnter(carousel);
    act(() => vi.advanceTimersByTime(14_000));
    expect(pane('1 de 2').getAttribute('aria-hidden')).toBe('false');

    fireEvent.mouseLeave(carousel);
    act(() => vi.advanceTimersByTime(7_000));

    expect(pane('2 de 2').getAttribute('aria-hidden')).toBe('false');
  });

  it('supports a horizontal swipe on touch devices', () => {
    const { container } = renderHero();
    const carousel = container.querySelector('#storefront-hero');
    if (!(carousel instanceof HTMLElement)) throw new Error('No se encontró la portada');

    fireEvent.touchStart(carousel, { touches: [{ clientX: 220 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 120 }] });

    expect(pane('2 de 2').getAttribute('aria-hidden')).toBe('false');
  });
});
