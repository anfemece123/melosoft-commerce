import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from '@/features/orders/orders.types';
import { OrderDetailsEditDialog } from './OrderDetailsEditDialog';
import { OrderItemsAmendDialog } from './OrderItemsAmendDialog';

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
});
