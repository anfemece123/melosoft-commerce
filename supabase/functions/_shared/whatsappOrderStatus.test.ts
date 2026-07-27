import { describe, expect, it } from 'vitest';
import {
  getWhatsappOrderStatusContent,
  isWhatsappOrderStatusEvent,
  WHATSAPP_ORDER_STATUS_EVENTS,
} from './whatsappOrderStatus.ts';

describe('WhatsApp order milestones', () => {
  it('contains only the four customer-facing status events', () => {
    expect(WHATSAPP_ORDER_STATUS_EVENTS).toEqual([
      'order_ready_for_pickup',
      'order_shipped',
      'order_delivered',
      'order_cancelled',
    ]);
    expect(isWhatsappOrderStatusEvent('order_preparing')).toBe(false);
    expect(isWhatsappOrderStatusEvent('payment_approved')).toBe(false);
  });

  it('uses distinct pickup and delivery copy', () => {
    expect(getWhatsappOrderStatusContent('order_ready_for_pickup').status).toBe('Listo para recoger');
    expect(getWhatsappOrderStatusContent('order_shipped').status).toBe('Enviado');
  });
});
