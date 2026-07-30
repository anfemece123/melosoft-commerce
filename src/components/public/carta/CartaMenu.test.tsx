import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { PublicCartaPage } from '@/features/carta/carta.types';
import { CartaMenu } from './CartaMenu';

const theme = buildStorefrontTheme({
  primaryColor: '#4f46e5',
  secondaryColor: '#eef2ff',
  backgroundColor: '#ffffff',
  textColor: '#111827',
});

const page: PublicCartaPage = {
  storeName: 'Restaurante Demo',
  logoUrl: null,
  currency: 'COP',
  title: 'Carta de la casa',
  subtitle: 'Preparado al momento',
  templateKey: 'signature',
  navigationMode: 'paginated',
  showCategoryDescriptions: true,
  coverLayout: 'none',
  coverProductIds: [],
  coverImageUrl: null,
  coverBackgroundImageUrl: null,
  showLogo: true,
  showProductDescriptions: true,
  categoryHeadingAlignment: 'center',
  productImageMode: 'all',
  categoryImageSelections: {},
  categoryImagePositions: {},
  categoryImageSizes: {},
  themeMode: 'light',
  primaryColor: '#4f46e5',
  secondaryColor: '#eef2ff',
  accentColor: '#7c3aed',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  buttonRadius: '16px',
  categories: [
    {
      id: 'starters',
      name: 'Entradas',
      slug: 'entradas',
      description: 'Para comenzar',
      imageUrl: null,
      sortOrder: 0,
      products: [{ id: 'one', name: 'Croquetas', shortDescription: 'Crocantes', imageUrl: null, price: 18000, sortOrder: 0 }],
    },
    {
      id: 'mains',
      name: 'Fuertes',
      slug: 'fuertes',
      description: 'Nuestros favoritos',
      imageUrl: null,
      sortOrder: 1,
      products: [{ id: 'two', name: 'Lomo de la casa', shortDescription: 'Con salsa', imageUrl: null, price: 42000, sortOrder: 0 }],
    },
  ],
};

describe('CartaMenu', () => {
  it('renders one category at a time when the owner selects paginated navigation', () => {
    render(<CartaMenu page={page} theme={theme} />);

    expect(screen.getByText('Croquetas')).toBeTruthy();
    expect(screen.queryByText('Lomo de la casa')).toBeNull();
    expect(screen.queryByText(/Plato destacado/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

    expect(screen.queryByText('Croquetas')).toBeNull();
    expect(screen.getByText('Lomo de la casa')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Siguiente/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a sticky category strip and jumps directly to a selected category', () => {
    render(<CartaMenu page={page} theme={theme} />);

    const navigation = screen.getByRole('navigation', { name: /Categorías de la carta/i });
    expect(navigation.className).toContain('sticky');
    expect(navigation.className).toContain('top-0');
    expect(navigation.className).not.toContain('backdrop-blur');
    expect(navigation.hasAttribute('style')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Fuertes' }));

    expect(screen.getByText('Lomo de la casa')).toBeTruthy();
    expect(screen.queryByText('Croquetas')).toBeNull();
  });

  it('filters dishes by name, description, or category without being limited by pagination', () => {
    render(<CartaMenu page={page} theme={theme} />);

    const search = screen.getByRole('searchbox', { name: /Buscar platos o categorías/i });
    fireEvent.change(search, { target: { value: 'salsa' } });

    expect(screen.getByText('Lomo de la casa')).toBeTruthy();
    expect(screen.queryByText('Croquetas')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('1 plato encontrado');
    expect(screen.queryByRole('button', { name: /Siguiente/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Limpiar búsqueda/i }));
    expect(screen.getByText('Croquetas')).toBeTruthy();
    expect(screen.queryByText('Lomo de la casa')).toBeNull();
  });

  it('shows a clean empty state when no dish matches the search', () => {
    render(<CartaMenu page={{ ...page, navigationMode: 'continuous' }} theme={theme} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pizza hawaiana' } });

    expect(screen.getByText('No encontramos ese plato')).toBeTruthy();
    expect(screen.getByText(/Prueba con otro nombre, ingrediente o categoría/i)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('0 platos encontrados');
  });

  it('keeps the category strip visible even when the carta has only one category', () => {
    render(<CartaMenu page={{ ...page, navigationMode: 'continuous', categories: [page.categories[0]] }} theme={theme} />);

    expect(screen.getByRole('navigation', { name: /Categorías de la carta/i })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Entradas' })).toHaveLength(1);
    const strip = document.querySelector('[data-carta-category-strip]');
    expect(strip?.className).toContain('min-w-full');
    expect(strip?.className).toContain('justify-center');
    expect(strip?.className).toContain('w-max');
  });

  it('does not print automatic system labels or decorative numbering', () => {
    render(<CartaMenu page={{ ...page, title: null, navigationMode: 'continuous' }} theme={theme} />);

    expect(screen.queryByText(/Carta digital/i)).toBeNull();
    expect(screen.queryByText('Nuestra carta')).toBeNull();
    expect(screen.queryByText(/Categoría 0\d/i)).toBeNull();
    expect(screen.queryByText(/Sección 0\d/i)).toBeNull();
    expect(screen.queryByText(/\d+ opciones/i)).toBeNull();
  });

  it('keeps category descriptions optional without removing the category heading', () => {
    render(<CartaMenu page={{ ...page, showCategoryDescriptions: false }} theme={theme} />);

    expect(screen.getAllByText('Entradas')).toHaveLength(2);
    expect(screen.queryByText('Para comenzar')).toBeNull();
  });

  it('can show one category image without turning a product into a featured dish', () => {
    const withImages: PublicCartaPage = {
      ...page,
      productImageMode: 'first_per_category',
      categoryImageSelections: { starters: 'product:chosen-image' },
      categoryImagePositions: { starters: 'above_heading' },
      categoryImageSizes: { starters: 'small' },
      categories: page.categories.map((category, categoryIndex) => ({
        ...category,
        products: category.id === 'starters'
          ? [
              ...category.products.map((product) => ({ ...product, imageUrl: `https://example.com/dish-${categoryIndex}.jpg` })),
              { id: 'chosen-image', name: 'Sopa', shortDescription: null, imageUrl: 'https://example.com/chosen.png', price: 16000, sortOrder: 1 },
            ]
          : category.products.map((product) => ({ ...product, imageUrl: `https://example.com/dish-${categoryIndex}.jpg` })),
      })),
    };

    render(<CartaMenu page={withImages} theme={theme} />);

    expect(screen.getByRole('img', { name: 'Entradas' }).getAttribute('src')).toBe('https://example.com/chosen.png');
    expect(document.querySelector('[data-category-image-position="above_heading"]')).not.toBeNull();
    expect(document.querySelector('[data-category-image-size="small"]')).not.toBeNull();
    expect(document.querySelector('[data-category-image-format="floating-png"]')).not.toBeNull();
    expect(screen.queryByRole('img', { name: 'Croquetas' })).toBeNull();
    expect(screen.queryByText(/Plato destacado/i)).toBeNull();
  });

  it('can render the carta without any category or product images', () => {
    const withoutImages: PublicCartaPage = {
      ...page,
      productImageMode: 'none',
      categories: page.categories.map((category) => ({
        ...category,
        imageUrl: 'https://example.com/category.jpg',
        products: category.products.map((product) => ({ ...product, imageUrl: 'https://example.com/dish.jpg' })),
      })),
    };

    render(<CartaMenu page={withoutImages} theme={theme} />);

    expect(screen.queryByRole('img', { name: 'Entradas' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Croquetas' })).toBeNull();
  });

  it('does not accumulate large gaps between products in the per-product image mode', () => {
    render(<CartaMenu page={{ ...page, navigationMode: 'continuous', productImageMode: 'all' }} theme={theme} />);

    const productGrids = Array.from(document.querySelectorAll('[data-carta-products-grid]'));
    expect(productGrids.length).toBeGreaterThan(0);
    expect(productGrids.every((grid) => grid.className.includes('gap-0'))).toBe(true);
    expect(productGrids.every((grid) => !grid.className.includes('gap-5'))).toBe(true);
  });

  it('keeps the vertical separation between consecutive categories compact', () => {
    render(<CartaMenu page={{ ...page, navigationMode: 'continuous' }} theme={theme} />);

    const categorySections = Array.from(document.querySelectorAll('[data-carta-category]'));
    expect(categorySections).toHaveLength(2);
    expect(categorySections.every((section) => section.className.includes('pt-0'))).toBe(true);
    expect(categorySections.every((section) => section.className.includes('pb-6'))).toBe(true);
    expect(categorySections.every((section) => !section.className.split(' ').some((className) => className.startsWith('py-')))).toBe(true);
    expect(categorySections.every((section) => !section.className.includes('py-12'))).toBe(true);
    expect(categorySections.every((section) => !section.className.includes('lg:py-20'))).toBe(true);
  });

  it('keeps a right-side category image smaller and right-aligned on mobile', () => {
    const category = {
      ...page.categories[0],
      products: page.categories[0].products.map((product) => ({ ...product, imageUrl: 'https://example.com/dish.jpg' })),
    };
    render(<CartaMenu page={{
      ...page,
      navigationMode: 'continuous',
      productImageMode: 'first_per_category',
      categoryImageSelections: { starters: 'product:one' },
      categoryImagePositions: { starters: 'beside_right' },
      categoryImageSizes: { starters: 'small' },
      categories: [category],
    }} theme={theme} />);

    const figure = document.querySelector('[data-category-image-position="beside_right"]');
    expect(figure?.className).toContain('ml-auto');
    expect(figure?.className).toContain('max-w-[104px]');
    expect(figure?.parentElement?.className).toContain('order-2');
    expect(figure?.parentElement?.parentElement?.className).toContain('grid-cols-[minmax(0,1fr)_104px]');
  });

  it('uses an uploaded cover image without requiring a product image', () => {
    render(<CartaMenu page={{
      ...page,
      navigationMode: 'continuous',
      coverLayout: 'single',
      coverImageUrl: 'https://example.com/custom-cover.jpg',
      coverProductIds: [],
    }} theme={theme} />);

    expect(screen.getByRole('img', { name: 'Portada de Restaurante Demo' }).getAttribute('src')).toBe('https://example.com/custom-cover.jpg');
  });

  it('shows an independent cover background even without a central image', () => {
    render(<CartaMenu page={{
      ...page,
      navigationMode: 'continuous',
      coverLayout: 'none',
      coverBackgroundImageUrl: 'https://example.com/cover-background.jpg',
    }} theme={theme} />);

    const background = document.querySelector('[data-carta-cover-background]');
    expect(background?.getAttribute('src')).toBe('https://example.com/cover-background.jpg');
    expect(background?.parentElement?.hasAttribute('data-carta-cover-background-frame')).toBe(true);
    expect(background?.parentElement?.className).toContain('absolute inset-0');
    expect(background?.className).toContain('scale-125');
    expect(background?.className).toContain('origin-top');
    expect(background?.className).toContain('sm:scale-110');
  });

  it('keeps the cover background edge-to-edge at its lower mobile boundary', () => {
    render(<CartaMenu page={{
      ...page,
      navigationMode: 'continuous',
      coverBackgroundImageUrl: 'https://example.com/cover-background.jpg',
    }} theme={theme} />);

    const mobileCoverClasses = document.querySelector('[data-carta-cover]')?.className.split(' ') ?? [];
    expect(mobileCoverClasses).not.toContain('mb-5');
    expect(mobileCoverClasses).not.toContain('rounded-b-[2rem]');
    expect(mobileCoverClasses).toContain('sm:mb-8');
    expect(mobileCoverClasses).toContain('sm:rounded-b-[3rem]');
  });

  it('does not add a duplicated footer separator below the last category', () => {
    render(<CartaMenu page={{ ...page, navigationMode: 'continuous' }} theme={theme} />);

    expect(document.querySelector('footer')).toBeNull();
  });

  it('creates a visible palette gradient when secondary and background colors are identical', () => {
    const sameSurfaceTheme = buildStorefrontTheme({
      primaryColor: '#4f46e5',
      secondaryColor: '#ffffff',
      backgroundColor: '#ffffff',
      textColor: '#111827',
    });

    render(<CartaMenu page={{ ...page, navigationMode: 'continuous' }} theme={sameSurfaceTheme} />);

    const cartaSurface = document.querySelector('[data-carta-gradient-color]');
    const generatedColor = cartaSurface?.getAttribute('data-carta-gradient-color');
    expect(generatedColor).toBeTruthy();
    expect(generatedColor).not.toBe(sameSurfaceTheme.background);
    expect(cartaSurface?.getAttribute('style')).toContain('linear-gradient');
    expect(Array.from(document.querySelectorAll('[data-carta-category]')).every((section) => !section.hasAttribute('style'))).toBe(true);
  });

  it('keeps a dark background dominant while applying only a subtle secondary tint', () => {
    const darkTheme = buildStorefrontTheme({
      mode: 'dark',
      primaryColor: '#ef4444',
      secondaryColor: '#dc2626',
      backgroundColor: '#050505',
      textColor: '#ffffff',
    });

    render(<CartaMenu page={{ ...page, navigationMode: 'continuous' }} theme={darkTheme} />);

    const cartaSurface = document.querySelector('[data-carta-gradient-color]');
    const style = cartaSurface?.getAttribute('style') ?? '';
    expect(style).toContain('background-color: rgb(5, 5, 5)');
    expect(style).toContain('rgba(220, 38, 38, 0.1)');
    expect(style).not.toContain('rgb(220, 38, 38) 28%');
  });
});
