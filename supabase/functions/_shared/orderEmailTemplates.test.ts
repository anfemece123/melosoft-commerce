import { describe, expect, it } from 'vitest';
import { renderOrderEmail, type OrderEmailData } from './orderEmailTemplates.ts';

function makeEmailData(overrides: Partial<OrderEmailData> = {}): OrderEmailData {
  return {
    eventType: 'customer_order_received',
    storeName: 'Tienda Demo',
    storeLogoUrl: null,
    supportEmail: 'soporte@example.com',
    customerName: 'Ana López',
    customerEmail: 'ana@example.com',
    customerPhone: '3001234567',
    orderNumber: 'MS-1042',
    createdAt: '2026-07-27T15:30:00.000Z',
    currency: 'COP',
    subtotal: 120000,
    shippingAmount: 12000,
    discountAmount: 5000,
    totalAmount: 127000,
    paymentMethod: 'online',
    paymentStatus: 'paid',
    fulfillmentMethod: 'national_shipping',
    shippingAddress: 'Calle 1 # 2-3',
    city: 'Pasto',
    department: 'Nariño',
    deliveryNeighborhood: 'Centro',
    deliveryReference: null,
    notes: null,
    shippingCarrier: null,
    trackingNumber: null,
    trackingUrl: null,
    estimatedDeliveryAt: null,
    items: [{
      name: 'Camiseta',
      quantity: 2,
      unitPrice: 60000,
      totalPrice: 120000,
      variantLabel: 'Negra / M',
    }],
    ...overrides,
  };
}

describe('Brevo order email templates', () => {
  it('renders a complete customer confirmation in HTML and text', () => {
    const email = renderOrderEmail(makeEmailData());

    expect(email.subject).toContain('MS-1042');
    expect(email.subject).toContain('Tienda Demo');
    expect(email.html).toContain('PEDIDO RECIBIDO');
    expect(email.html).toContain('Negra / M');
    expect(email.html).toContain('Calle 1 # 2-3');
    expect(email.text).toContain('2 x Camiseta');
    expect(email.text).toContain('Total:');
  });

  it('includes carrier, guide, estimate and safe tracking link for a shipment', () => {
    const email = renderOrderEmail(makeEmailData({
      eventType: 'customer_order_shipped',
      shippingCarrier: 'Coordinadora',
      trackingNumber: 'GUIA-9988',
      trackingUrl: 'https://tracking.example.com/GUIA-9988',
      estimatedDeliveryAt: '2026-07-31',
    }));

    expect(email.html).toContain('PEDIDO DESPACHADO');
    expect(email.html).toContain('Coordinadora');
    expect(email.html).toContain('GUIA-9988');
    expect(email.html).toContain('Rastrear envío');
    expect(email.text).toContain('https://tracking.example.com/GUIA-9988');
  });

  it('escapes customer content and never links a non-http tracking URL', () => {
    const email = renderOrderEmail(makeEmailData({
      customerName: '<script>alert(1)</script>',
      eventType: 'customer_order_shipped',
      trackingNumber: '<b>BAD</b>',
      trackingUrl: 'javascript:alert(1)',
      notes: '<script>alert(1)</script>',
    }));

    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).not.toContain('href="javascript:');
    expect(email.html).toContain('&lt;b&gt;BAD&lt;/b&gt;');
  });

  it('uses pickup-specific fulfillment language', () => {
    const email = renderOrderEmail(makeEmailData({
      eventType: 'customer_order_ready_for_pickup',
      fulfillmentMethod: 'pickup',
      shippingAddress: null,
      city: null,
      department: null,
      deliveryNeighborhood: null,
    }));

    expect(email.subject).toContain('Tu pedido ya está listo');
    expect(email.html).toContain('LISTO PARA RECOGER');
    expect(email.text).toContain('Recogida en tienda');
  });
});
