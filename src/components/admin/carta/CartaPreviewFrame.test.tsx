import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { PublicCartaPage } from '@/features/carta/carta.types';
import { CartaPreviewFrame } from './CartaPreviewFrame';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

const page: PublicCartaPage = {
  storeName: 'Restaurante de prueba',
  logoUrl: null,
  currency: 'COP',
  title: 'Nuestra carta',
  subtitle: 'Vista previa real',
  templateKey: 'signature',
  navigationMode: 'continuous',
  showCategoryDescriptions: true,
  coverLayout: 'none',
  coverProductIds: [],
  coverImageUrl: null,
  coverBackgroundImageUrl: null,
  showLogo: true,
  showProductDescriptions: true,
  categoryHeadingAlignment: 'center',
  productImageMode: 'all',
  categoryImageModes: {},
  categoryImageSelections: {},
  categoryImagePositions: {},
  categoryImageSizes: {},
  productImagePositions: {},
  themeMode: 'light',
  primaryColor: '#4f46e5',
  secondaryColor: '#eef2ff',
  accentColor: '#7c3aed',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  buttonRadius: '16px',
  categories: [{
    id: 'main',
    name: 'Platos fuertes',
    slug: 'platos-fuertes',
    description: null,
    imageUrl: null,
    sortOrder: 0,
    products: [{ id: 'dish', name: 'Hamburguesa especial', shortDescription: null, imageUrl: 'https://example.com/dish.jpg', price: 25000, sortOrder: 0 }],
  }],
};

describe('CartaPreviewFrame', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mounts the real carta inside the mobile preview iframe', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const theme = buildStorefrontTheme({ primaryColor: '#4f46e5', backgroundColor: '#ffffff', textColor: '#111827' });
    render(<CartaPreviewFrame page={page} theme={theme} device="mobile" onDeviceChange={() => undefined} />);

    const iframe = screen.getByTitle('Vista previa móvil') as HTMLIFrameElement;
    fireEvent.load(iframe);

    await waitFor(() => {
      expect(iframe.contentDocument?.body.textContent).toContain('Hamburguesa especial');
    });

    const scrollViewport = document.querySelector('[data-storefront-mobile-clip-mode="scroll"]') as HTMLElement | null;
    expect(scrollViewport?.style.overflowY).toBe('auto');
    expect(scrollViewport?.getAttribute('data-storefront-mobile-max-height')).toBe('640');
  });

  it('lets the desktop preview scroll through the carta without a bottom obstruction', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const theme = buildStorefrontTheme({ primaryColor: '#4f46e5', backgroundColor: '#ffffff', textColor: '#111827' });
    render(<CartaPreviewFrame page={page} theme={theme} device="desktop" onDeviceChange={() => undefined} />);

    const scrollViewport = document.querySelector('[data-carta-preview-scroll="desktop"]');
    expect(scrollViewport?.className).toContain('max-h-[640px]');
    expect(scrollViewport?.className).toContain('overflow-y-auto');
    expect(screen.queryByText(/Vista parcial de la carta/i)).toBeNull();
  });
});
