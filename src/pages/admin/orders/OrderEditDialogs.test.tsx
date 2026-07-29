import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/features/orders/orders.types';
import type { Product } from '@/features/products/products.types';
import type { ProductOptionGroup } from '@/features/products/products.types';
import type { ProductVariant, ProductVariantOption } from '@/features/products/productVariants.types';
import { OrderDetailsEditDialog } from './OrderDetailsEditDialog';
import { OrderItemsAmendDialog } from './OrderItemsAmendDialog';

const catalogMocks = vi.hoisted(() => ({
  getProductsByStore: vi.fn(),
  getProductOptionGroups: vi.fn(),
  getProductVariants: vi.fn(),
  getProductVariantOptions: vi.fn(),
}));

vi.mock('@/features/products/productsService', () => ({
  productsService: { getProductsByStore: catalogMocks.getProductsByStore },
}));
vi.mock('@/features/products/productOptionsService', () => ({
  productOptionsService: { getProductOptionGroups: catalogMocks.getProductOptionGroups },
}));
vi.mock('@/features/products/productVariantsService', () => ({
  productVariantsService: {
    getProductVariants: catalogMocks.getProductVariants,
    getProductVariantOptions: catalogMocks.getProductVariantOptions,
  },
}));

const catalogProduct: Product = {
  id: 'product-2',
  storeId: 'store-1',
  ownerId: 'owner-1',
  name: 'Producto adicional',
  slug: 'producto-adicional',
  description: 'Producto para agregar al pedido',
  shortDescription: null,
  descriptionSections: [],
  productType: 'physical_product',
  regularPrice: 12_000,
  compareAtPrice: null,
  salePrice: 10_000,
  costPrice: null,
  stock: 20,
  sku: 'ADD-001',
  trackInventory: true,
  isFeatured: false,
  isAvailable: true,
  preparationTimeMinutes: null,
  allowsSpecialInstructions: false,
  specialInstructionsLabel: null,
  specialInstructionsPlaceholder: null,
  specialInstructionsMaxLength: 180,
  sortOrder: 0,
  status: 'active',
  mainImageUrl: null,
  category: null,
  categoryId: null,
  hasVariants: false,
  showVariantsAsCards: false,
  sizeChartId: null,
  collections: [],
  facetValues: [],
  createdAt: '2026-07-28T12:00:00.000Z',
  updatedAt: '2026-07-28T12:00:00.000Z',
};

const variantProduct: Product = {
  ...catalogProduct,
  id: 'product-3',
  name: 'Hamburguesa especial',
  slug: 'hamburguesa-especial',
  hasVariants: true,
  productType: 'menu_item',
  allowsSpecialInstructions: true,
};

const productVariant: ProductVariant = {
  id: 'variant-1',
  storeId: 'store-1',
  productId: variantProduct.id,
  ownerId: 'owner-1',
  sku: 'HAM-GRANDE',
  barcode: null,
  price: 18_000,
  compareAtPrice: null,
  cost: null,
  stockQuantity: 10,
  stockPolicy: 'deny',
  lowStockThreshold: null,
  weight: null,
  status: 'active',
  isDefault: true,
  position: 0,
  optionSignature: 'size:grande',
  metadata: {},
  selectedValues: [{ variantId: 'variant-1', optionId: 'variant-option-1', optionValueId: 'variant-value-1' }],
  images: [],
  createdAt: '2026-07-28T12:00:00.000Z',
  updatedAt: '2026-07-28T12:00:00.000Z',
};

const variantOption: ProductVariantOption = {
  id: 'variant-option-1',
  storeId: 'store-1',
  productId: variantProduct.id,
  ownerId: 'owner-1',
  name: 'Tamaño',
  type: 'size',
  useAsPublicFilter: true,
  controlsMedia: false,
  isRequired: true,
  isActive: true,
  sortOrder: 0,
  values: [{
    id: 'variant-value-1',
    storeId: 'store-1',
    optionId: 'variant-option-1',
    ownerId: 'owner-1',
    value: 'Grande',
    colorHex: null,
    metadata: {},
    normalizedValue: 'grande',
    sortOrder: 0,
    isActive: true,
    images: [],
    createdAt: '2026-07-28T12:00:00.000Z',
    updatedAt: '2026-07-28T12:00:00.000Z',
  }],
  createdAt: '2026-07-28T12:00:00.000Z',
  updatedAt: '2026-07-28T12:00:00.000Z',
};

const requiredOptionGroup: ProductOptionGroup = {
  id: 'option-group-1',
  storeId: 'store-1',
  productId: variantProduct.id,
  ownerId: 'owner-1',
  name: 'Queso',
  description: null,
  selectionType: 'single',
  minSelect: 1,
  maxSelect: 1,
  isRequired: true,
  isActive: true,
  sortOrder: 0,
  items: [{
    id: 'option-item-1',
    groupId: 'option-group-1',
    storeId: 'store-1',
    ownerId: 'owner-1',
    label: 'Extra queso',
    description: null,
    priceDelta: 2_000,
    isDefault: false,
    isActive: true,
    sortOrder: 0,
    createdAt: '2026-07-28T12:00:00.000Z',
    updatedAt: '2026-07-28T12:00:00.000Z',
  }],
  createdAt: '2026-07-28T12:00:00.000Z',
  updatedAt: '2026-07-28T12:00:00.000Z',
};

const order: Order = {
  id: 'order-1',
  storeId: 'store-1',
  storeLocationId: null,
  orderNumber: 'PED-1001',
  source: 'web',
  customerName: 'María García',
  customerEmail: 'maria@example.com',
  customerPhone: '3001234567',
  customerDocument: null,
  shippingAddress: 'Calle 1 # 2-3',
  city: 'Bogotá',
  department: 'Bogotá D.C.',
  deliveryNeighborhood: 'Centro',
  deliveryReference: null,
  subtotal: 50_000,
  shippingAmount: 5_000,
  discountAmount: 0,
  totalAmount: 55_000,
  currency: 'COP',
  status: 'pending',
  paymentStatus: 'pending',
  paymentMethod: 'cash_on_delivery',
  fulfillmentMethod: 'local_delivery',
  shippingCarrier: null,
  trackingNumber: null,
  trackingUrl: null,
  estimatedDeliveryAt: null,
  shippedAt: null,
  deliveredAt: null,
  notes: null,
  items: [
    {
      id: 'item-1',
      orderId: 'order-1',
      productId: 'product-1',
      variantId: null,
      offerId: null,
      productNameSnapshot: 'Producto de prueba',
      productSlugSnapshot: 'producto-prueba',
      productImageUrlSnapshot: null,
      variantLabelSnapshot: null,
      variantSkuSnapshot: null,
      name: 'Producto de prueba',
      quantity: 2,
      unitPrice: 25_000,
      totalPrice: 50_000,
      customerNote: null,
      customizations: [],
      createdAt: '2026-07-28T12:00:00.000Z',
    },
  ],
  createdAt: '2026-07-28T12:00:00.000Z',
  updatedAt: '2026-07-28T12:00:00.000Z',
};

describe('order edit dialogs', () => {
  beforeEach(() => {
    catalogMocks.getProductsByStore.mockReset().mockResolvedValue([]);
    catalogMocks.getProductOptionGroups.mockReset().mockResolvedValue([]);
    catalogMocks.getProductVariants.mockReset().mockResolvedValue([]);
    catalogMocks.getProductVariantOptions.mockReset().mockResolvedValue([]);
  });

  it('sends normalized optional values and the concurrency version when correcting delivery data', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<OrderDetailsEditDialog order={order} onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/celular colombiano/i), { target: { value: '3017654321' } });
    fireEvent.change(screen.getByLabelText(/referencia de entrega/i), { target: { value: '  Portería azul  ' } });
    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), { target: { value: 'Corrección solicitada por el cliente' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      customerPhone: '3017654321',
      deliveryReference: 'Portería azul',
      reason: 'Corrección solicitada por el cliente',
      expectedUpdatedAt: order.updatedAt,
    }));
  });

  it('requires a reason and keeps at least one line when changing quantities', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<OrderItemsAmendDialog order={order} onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /restar uno/i }));
    const saveButton = screen.getByRole('button', { name: /guardar modificación/i });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveButton);

    expect(await screen.findByText(/explica el motivo con al menos 5 caracteres/i)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), { target: { value: 'Cliente pidió una unidad' } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith({
      items: [{ orderItemId: 'item-1', quantity: 1 }],
      reason: 'Cliente pidió una unidad',
      expectedUpdatedAt: order.updatedAt,
    });
  });

  it('adds an available catalog product as a server-priced amendment line', async () => {
    catalogMocks.getProductsByStore.mockResolvedValue([catalogProduct]);
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<OrderItemsAmendDialog order={order} onConfirm={onConfirm} onClose={vi.fn()} />);

    const productSelect = await screen.findByLabelText(/^producto$/i);
    fireEvent.change(productSelect, { target: { value: catalogProduct.id } });
    await waitFor(() => expect(catalogMocks.getProductOptionGroups).toHaveBeenCalledWith(catalogProduct.id));
    fireEvent.click(screen.getByRole('button', { name: /agregar al pedido/i }));

    expect(await screen.findByText('Nuevo')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), { target: { value: 'Cliente agregó otro producto' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar modificación/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith({
      items: [
        { orderItemId: 'item-1', quantity: 2 },
        {
          productId: catalogProduct.id,
          variantId: null,
          quantity: 1,
          customizationNotes: null,
          customizations: [],
        },
      ],
      reason: 'Cliente agregó otro producto',
      expectedUpdatedAt: order.updatedAt,
    });
  });

  it('requires and submits the selected variant and product additions', async () => {
    catalogMocks.getProductsByStore.mockResolvedValue([variantProduct]);
    catalogMocks.getProductVariants.mockResolvedValue([productVariant]);
    catalogMocks.getProductVariantOptions.mockResolvedValue([variantOption]);
    catalogMocks.getProductOptionGroups.mockResolvedValue([requiredOptionGroup]);
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<OrderItemsAmendDialog order={order} onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/^producto$/i), { target: { value: variantProduct.id } });
    expect(await screen.findByLabelText(/variante/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /extra queso/i }));
    fireEvent.click(screen.getByRole('button', { name: /agregar al pedido/i }));
    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), { target: { value: 'Cliente agregó hamburguesa' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar modificación/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([
        expect.objectContaining({
          productId: variantProduct.id,
          variantId: productVariant.id,
          customizations: [{ optionGroupId: requiredOptionGroup.id, optionItemId: 'option-item-1' }],
        }),
      ]),
    }));
  });
});
