import { describe, expect, it } from 'vitest';
import type { PublicCartaPageRow } from '@/types/database.types';
import { attachPublicCartaImages, mapPublicCartaPageRowsToPublicCartaPage } from './carta.mapper';

function row(overrides: Partial<PublicCartaPageRow>): PublicCartaPageRow {
  return {
    store_slug: 'demo',
    store_name: 'Demo',
    logo_url: null,
    currency: 'COP',
    title: 'Nuestra carta',
    subtitle: null,
    carta_template_key: 'gallery',
    carta_navigation_mode: 'continuous',
    show_category_descriptions: true,
    cover_layout: 'none',
    cover_product_ids: [],
    cover_image_url: null,
    cover_background_image_url: null,
    show_logo: true,
    show_product_descriptions: true,
    category_heading_alignment: 'center',
    product_image_mode: 'all',
    category_image_modes: {},
    category_image_selections: {},
    category_image_positions: {},
    category_image_sizes: {},
    product_image_positions: {},
    theme_mode: 'light',
    primary_color: '#4f46e5',
    secondary_color: '#eef2ff',
    accent_color: '#7c3aed',
    background_color: '#ffffff',
    text_color: '#111827',
    button_radius: '16px',
    product_id: 'product',
    product_name: 'Producto',
    short_description: null,
    main_image_url: null,
    effective_price: 20000,
    variants: [],
    product_sort_order: 0,
    category_id: 'category',
    category_name: 'Categoría',
    category_slug: 'categoria',
    category_description: 'Descripción',
    category_image_url: 'https://example.com/category.jpg',
    category_sort_order: 0,
    ...overrides,
  };
}

describe('carta mapper', () => {
  it('maps the visual settings and honors the carta-specific category/product order', () => {
    const page = mapPublicCartaPageRowsToPublicCartaPage([
      row({ product_id: 'second-product', product_name: 'Segundo', product_sort_order: 1, category_id: 'second-category', category_name: 'Segunda', category_sort_order: 1 }),
      row({ product_id: 'first-b', product_name: 'B', product_sort_order: 1, category_id: 'first-category', category_name: 'Primera', category_sort_order: 0 }),
      row({ product_id: 'first-a', product_name: 'A', product_sort_order: 0, category_id: 'first-category', category_name: 'Primera', category_sort_order: 0 }),
    ]);

    expect(page?.templateKey).toBe('gallery');
    expect(page?.navigationMode).toBe('continuous');
    expect(page?.coverImageUrl).toBeNull();
    expect(page?.coverBackgroundImageUrl).toBeNull();
    expect(page?.categoryImageModes).toEqual({});
    expect(page?.categoryImageSelections).toEqual({});
    expect(page?.categoryImagePositions).toEqual({});
    expect(page?.categoryImageSizes).toEqual({});
    expect(page?.productImagePositions).toEqual({});
    expect(page?.categories.map((category) => category.name)).toEqual(['Primera', 'Segunda']);
    expect(page?.categories[0].products.map((product) => product.name)).toEqual(['A', 'B']);
    expect(page?.categories[0].description).toBe('Descripción');
    expect(page?.categories[0].imageUrl).toBe('https://example.com/category.jpg');
  });

  it('uses safe defaults for legacy or unknown layout values', () => {
    const page = mapPublicCartaPageRowsToPublicCartaPage([
      row({ carta_template_key: 'unknown', carta_navigation_mode: 'unknown' }),
    ]);

    expect(page?.templateKey).toBe('signature');
    expect(page?.navigationMode).toBe('continuous');
  });

  it('maps every active variant with a readable label and availability', () => {
    const page = mapPublicCartaPageRowsToPublicCartaPage([
      row({
        variants: [
          {
            id: 'small',
            sku: 'BURG-S',
            price: 18000,
            compareAtPrice: null,
            stockQuantity: 0,
            stockPolicy: 'deny',
            isDefault: true,
            isAvailable: false,
            imageUrl: null,
            optionValues: [{ optionId: 'size', optionName: 'Tamaño', valueId: 's', value: 'Pequeña' }],
          },
          {
            id: 'large',
            sku: 'BURG-L',
            price: 24000,
            compareAtPrice: null,
            stockQuantity: 3,
            stockPolicy: 'deny',
            isDefault: false,
            isAvailable: true,
            imageUrl: null,
            optionValues: [{ optionId: 'size', optionName: 'Tamaño', valueId: 'l', value: 'Grande' }],
          },
        ],
      }),
    ]);

    expect(page?.categories[0].products[0].variants.map((variant) => ({
      label: variant.label,
      price: variant.price,
      isAvailable: variant.isAvailable,
    }))).toEqual([
      { label: 'Tamaño: Pequeña', price: 18000, isAvailable: false },
      { label: 'Tamaño: Grande', price: 24000, isAvailable: true },
    ]);
  });

  it('converts the removed composition layout into a single-image cover', () => {
    const page = mapPublicCartaPageRowsToPublicCartaPage([
      row({ cover_layout: 'collage' }),
    ]);

    expect(page?.coverLayout).toBe('single');
  });

  it('preserves the uploaded cover background independently from the central image', () => {
    const page = mapPublicCartaPageRowsToPublicCartaPage([
      row({ cover_background_image_url: 'https://example.com/background.jpg' }),
    ]);

    expect(page?.coverBackgroundImageUrl).toBe('https://example.com/background.jpg');
  });

  it('preserves the image explicitly selected for each category', () => {
    const page = mapPublicCartaPageRowsToPublicCartaPage([
      row({
        category_image_modes: { category: 'first_per_category', invalid: 'unknown' },
        category_image_selections: { category: 'product:chosen-product' },
        category_image_positions: { category: 'below_heading' },
        category_image_sizes: { category: 'small' },
        product_image_positions: { product: 'right', invalid: 'center' },
      }),
    ]);

    expect(page?.categoryImageModes).toEqual({ category: 'first_per_category' });
    expect(page?.categoryImageSelections).toEqual({ category: 'product:chosen-product' });
    expect(page?.categoryImagePositions).toEqual({ category: 'below_heading' });
    expect(page?.categoryImageSizes).toEqual({ category: 'small' });
    expect(page?.productImagePositions).toEqual({ product: 'right' });
  });

  it('hydrates missing carta images from the product gallery source of truth', () => {
    const page = mapPublicCartaPageRowsToPublicCartaPage([
      row({ product_id: 'with-gallery', main_image_url: null }),
    ]);

    expect(page).not.toBeNull();
    const hydrated = attachPublicCartaImages(page!, [
      { product_id: 'with-gallery', image_url: 'https://example.com/real-product.jpg' },
    ]);

    expect(hydrated.categories[0].products[0].imageUrl).toBe('https://example.com/real-product.jpg');
  });
});
