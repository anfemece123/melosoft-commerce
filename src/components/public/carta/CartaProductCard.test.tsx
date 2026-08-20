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
  variants: [],
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

  it('shows every variant and its price without changing the card composition', () => {
    const { container } = render(
      <CartaProductCard
        product={{
          ...product,
          variants: [
            {
              id: 'small',
              sku: 'BURG-S',
              price: 18000,
              compareAtPrice: null,
              stockQuantity: 2,
              stockPolicy: 'deny',
              isDefault: true,
              isAvailable: true,
              imageUrl: null,
              optionValues: [],
              label: 'Pequeña',
            },
            {
              id: 'large',
              sku: 'BURG-L',
              price: 24000,
              compareAtPrice: null,
              stockQuantity: 0,
              stockPolicy: 'deny',
              isDefault: false,
              isAvailable: false,
              imageUrl: null,
              optionValues: [],
              label: 'Grande',
            },
          ],
        }}
        currency="COP"
        theme={theme}
        variant="gallery"
      />
    );

    expect(container.textContent).toContain('Pequeña');
    expect(container.textContent).toContain('Grande');
    expect(container.textContent).toContain('18.000');
    expect(container.textContent).toContain('24.000');
    expect(container.textContent).toContain('Agotado');
  });

  it('groups a price modifier instead of repeating every variant combination', () => {
    const { container } = render(
      <CartaProductCard
        product={{
          ...product,
          variants: [
            {
              id: 'mora-water',
              sku: null,
              price: 6000,
              compareAtPrice: null,
              stockQuantity: 2,
              stockPolicy: 'deny',
              isDefault: true,
              isAvailable: true,
              imageUrl: null,
              optionValues: [
                { optionId: 'fruit', optionName: 'Fruta', valueId: 'mora', value: 'Mora' },
                { optionId: 'preparation', optionName: 'Agua o leche', valueId: 'agua', value: 'Agua' },
              ],
              label: 'Fruta: Mora · Agua o leche: Agua',
            },
            {
              id: 'mora-milk',
              sku: null,
              price: 8000,
              compareAtPrice: null,
              stockQuantity: 2,
              stockPolicy: 'deny',
              isDefault: false,
              isAvailable: true,
              imageUrl: null,
              optionValues: [
                { optionId: 'fruit', optionName: 'Fruta', valueId: 'mora', value: 'Mora' },
                { optionId: 'preparation', optionName: 'Agua o leche', valueId: 'leche', value: 'Leche' },
              ],
              label: 'Fruta: Mora · Agua o leche: Leche',
            },
          ],
        }}
        currency="COP"
        theme={theme}
        variant="gallery"
      />
    );

    expect(container.textContent).toContain('Fruta:');
    expect(container.textContent).toContain('Mora');
    expect(container.textContent).toContain('Agua o leche:');
    expect(container.textContent).toContain('Agua');
    expect(container.textContent).toContain('Leche');
    expect(container.textContent).toContain('6.000');
    expect(container.textContent).toContain('8.000');
    expect((container.textContent?.match(/Fruta:/g) ?? []).length).toBe(1);
    expect((container.textContent?.match(/Agua o leche:/g) ?? []).length).toBe(1);
  });

  it('renders a compact matrix when modifier prices vary by product', () => {
    const { container } = render(
      <CartaProductCard
        product={{
          ...product,
          variants: [
            {
              id: 'club-normal', sku: null, price: 7000, compareAtPrice: null, stockQuantity: 1, stockPolicy: 'deny', isDefault: true, isAvailable: true, imageUrl: null,
              optionValues: [
                { optionId: 'beer', optionName: 'Bebida', valueId: 'club', value: 'Club Colombia' },
                { optionId: 'prep', optionName: 'Preparación', valueId: 'normal', value: 'Normal' },
              ], label: 'Club Colombia · Normal',
            },
            {
              id: 'club-michelada', sku: null, price: 11000, compareAtPrice: null, stockQuantity: 1, stockPolicy: 'deny', isDefault: false, isAvailable: true, imageUrl: null,
              optionValues: [
                { optionId: 'beer', optionName: 'Bebida', valueId: 'club', value: 'Club Colombia' },
                { optionId: 'prep', optionName: 'Preparación', valueId: 'michelada', value: 'Michelada' },
              ], label: 'Club Colombia · Michelada',
            },
            {
              id: 'corona-normal', sku: null, price: 9000, compareAtPrice: null, stockQuantity: 1, stockPolicy: 'deny', isDefault: false, isAvailable: true, imageUrl: null,
              optionValues: [
                { optionId: 'beer', optionName: 'Bebida', valueId: 'corona', value: 'Corona' },
                { optionId: 'prep', optionName: 'Preparación', valueId: 'normal', value: 'Normal' },
              ], label: 'Corona · Normal',
            },
            {
              id: 'corona-michelada', sku: null, price: 13000, compareAtPrice: null, stockQuantity: 1, stockPolicy: 'deny', isDefault: false, isAvailable: true, imageUrl: null,
              optionValues: [
                { optionId: 'beer', optionName: 'Bebida', valueId: 'corona', value: 'Corona' },
                { optionId: 'prep', optionName: 'Preparación', valueId: 'michelada', value: 'Michelada' },
              ], label: 'Corona · Michelada',
            },
          ],
        }}
        currency="COP"
        theme={theme}
        variant="gallery"
      />
    );

    expect(container.querySelector('[data-carta-variant-matrix]')).not.toBeNull();
    expect(container.querySelector('[data-carta-variant-matrix]')?.className).not.toContain('overflow-x-auto');
    expect(container.textContent).not.toContain('Bebida');
    expect(container.textContent).toContain('Normal');
    expect(container.textContent).toContain('Michelada');
    expect(container.textContent).toContain('Club Colombia');
    expect(container.textContent).toContain('Corona');
    expect(container.textContent).toContain('13.000');
  });
});
