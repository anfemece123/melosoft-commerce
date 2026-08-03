import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { CartaTemplateKey, PublicCartaProduct } from '@/features/carta/carta.types';
import { CartaProductCard } from './CartaProductCard';

const theme = buildStorefrontTheme({
  primaryColor: '#dc2626',
  secondaryColor: '#fff1f2',
  backgroundColor: '#ffffff',
  textColor: '#111827',
});

const product: PublicCartaProduct = {
  id: 'dish',
  name: 'Hamburguesa artesanal',
  shortDescription: 'Pan artesanal, carne madurada, queso, vegetales frescos, salsa de la casa y acompañamiento.',
  imageUrl: 'https://example.com/dish.jpg',
  price: 28000,
  sortOrder: 0,
};

afterEach(cleanup);

describe('CartaProductCard descriptions', () => {
  it.each<CartaTemplateKey>(['signature', 'gallery', 'minimal'])(
    'allows up to four description lines in the %s format',
    (variant) => {
      const { container } = render(
        <CartaProductCard product={product} currency="COP" theme={theme} variant={variant} />
      );

      expect(container.querySelector('[data-carta-product-description]')?.className).toContain('line-clamp-4');
    }
  );

  it('also allows four lines in text-only compact menus', () => {
    const { container } = render(
      <CartaProductCard product={product} currency="COP" theme={theme} compact showImage={false} />
    );

    expect(container.querySelector('[data-carta-product-description]')?.className).toContain('line-clamp-4');
  });

  it('uses compact mobile spacing when every product has its own image', () => {
    const { container, rerender } = render(
      <CartaProductCard product={product} currency="COP" theme={theme} variant="signature" />
    );

    expect(container.querySelector('article')?.className).toContain('gap-3');
    expect(container.querySelector('article')?.className).toContain('py-1');

    rerender(<CartaProductCard product={product} currency="COP" theme={theme} variant="minimal" />);
    expect(container.querySelector('article')?.className).toContain('py-2');
  });

  it.each<CartaTemplateKey>(['signature', 'gallery', 'minimal'])(
    'places an individual product image on the right in the %s format',
    (variant) => {
      const { container } = render(
        <CartaProductCard product={product} currency="COP" theme={theme} variant={variant} imagePosition="right" />
      );

      const article = container.querySelector('article');
      expect(article?.getAttribute('data-carta-product-image-position')).toBe('right');
      expect(article?.className).toContain('grid-cols-[minmax(0,1fr)_');
    }
  );

  it('renders Editorial as a clean split composition instead of an overlay card', () => {
    const { container } = render(
      <CartaProductCard product={product} currency="COP" theme={theme} variant="gallery" />
    );

    const article = container.querySelector('[data-carta-editorial-product="true"]');
    expect(article?.getAttribute('data-carta-product-image-position')).toBe('left');
    expect(article?.className).toContain('border-b');
    expect(article?.className).not.toContain('rounded-2xl');
    expect(article?.className).not.toContain('overflow-hidden');
    expect(container.querySelector('.bg-gradient-to-t')).toBeNull();
  });

  it('keeps transparent PNG dishes floating without a visible image frame in Editorial', () => {
    const { container } = render(
      <CartaProductCard
        product={{ ...product, imageUrl: 'https://example.com/dish.png?version=2' }}
        currency="COP"
        theme={theme}
        variant="gallery"
      />
    );

    const imageFrame = container.querySelector('img')?.parentElement;
    expect(imageFrame?.className).toContain('rounded-none');
    expect(imageFrame?.className).toContain('!overflow-visible');
    expect(imageFrame?.getAttribute('style')).toBeNull();
  });
});
