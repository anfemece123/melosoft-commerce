import { describe, expect, it } from 'vitest';
import {
  getWhatsappLocalDeliveryDetail,
  getWhatsappOrderStatusContent,
  isWhatsappOrderStatusEvent,
  WHATSAPP_ORDER_STATUS_EVENTS,
} from './whatsappOrderStatus.ts';

describe('WhatsApp order milestones', () => {
  it('contains only the four concise customer-facing status events', () => {
    expect(WHATSAPP_ORDER_STATUS_EVENTS).toEqual([
      'order_ready_for_pickup',
      'order_out_for_delivery',
      'order_delivered',
      'order_cancelled',
    ]);
    expect(isWhatsappOrderStatusEvent('order_preparing')).toBe(false);
    expect(isWhatsappOrderStatusEvent('payment_approved')).toBe(false);
  });

  it('uses distinct pickup and delivered copy', () => {
    expect(getWhatsappOrderStatusContent('order_ready_for_pickup').status).toBe('Listo para recoger');
    expect(getWhatsappOrderStatusContent('order_out_for_delivery')).toEqual({
      status: 'En camino',
      detail: 'Tu pedido salió para entrega y llegará a la dirección registrada.',
    });
    expect(getWhatsappOrderStatusContent('order_delivered').status).toBe('Entregado');
  });

  it('includes only the logistics data provided for a local delivery', () => {
    expect(getWhatsappLocalDeliveryDetail({
      shippingCarrier: 'Mensajeros Urbanos',
      trackingNumber: 'LOCAL-2048',
      trackingUrl: null,
      estimatedDelivery: '28 de julio de 2026',
    })).toBe(
      'Tu pedido salió para entrega. Entrega a cargo de Mensajeros Urbanos. Guía: LOCAL-2048. Entrega estimada: 28 de julio de 2026.',
    );
  });

  it('keeps tracking links optional and omits empty local-delivery fields', () => {
    expect(getWhatsappLocalDeliveryDetail({
      trackingNumber: ' LOCAL-99 ',
      trackingUrl: ' ',
    })).toBe('Tu pedido salió para entrega. Guía: LOCAL-99.');
  });
});
