import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from '@/features/orders/orders.types';
import { OrderConfirmDialog } from './OrderConfirmDialog';

const order: Order = {
  id: 'order-1',
  storeId: 'store-1',
  storeLocationId: null,
  orderNumber: 'PED-1001',
  source: 'web',
  customerName: 'María García',
  customerEmail: null,
  customerPhone: '+573001234567',
  customerDocument: null,
  shippingAddress: 'Calle 1 # 2-3',
  city: 'Bogotá',
  department: 'Bogotá D.C.',
  deliveryNeighborhood: null,
  deliveryReference: null,
  subtotal: 50_000,
  shippingAmount: 0,
  discountAmount: 0,
  totalAmount: 50_000,
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
  createdAt: '2026-07-28T12:00:00.000Z',
  updatedAt: '2026-07-28T12:00:00.000Z',
};

describe('OrderConfirmDialog', () => {
  it('confirms the order without opening WhatsApp when the channel is disconnected', async () => {
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <OrderConfirmDialog
        order={order}
        automaticWhatsappReady={false}
        onStatusChange={onStatusChange}
        onClose={onClose}
      />,
    );

    expect(screen.getByText(/el pedido se confirmará normalmente/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('order-1', 'confirmed');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
