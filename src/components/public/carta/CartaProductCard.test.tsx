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
});
