import { describe, expect, it } from 'vitest';
import {
  formatWhatsappEstimatedDelivery,
  isWhatsappOrderShipmentEvent,
  resolveWhatsappShipmentTracking,
} from './whatsappShipment.ts';

describe('WhatsApp shipment template data', () => {
  it('recognizes only the shipped event', () => {
    expect(isWhatsappOrderShipmentEvent('order_shipped')).toBe(true);
    expect(isWhatsappOrderShipmentEvent('order_ready_for_pickup')).toBe(false);
  });

  it('formats a calendar date in Spanish without timezone drift', () => {
    expect(formatWhatsappEstimatedDelivery('2026-08-03')).toBe('3 de agosto de 2026');
    expect(formatWhatsappEstimatedDelivery(null)).toBe('Por confirmar');
  });

  it('uses the carrier URL and provides a safe local-delivery fallback', () => {
    expect(resolveWhatsappShipmentTracking(' https://carrier.example/ABC123 ', 'national_shipping'))
      .toBe('https://carrier.example/ABC123');
    expect(resolveWhatsappShipmentTracking(null, 'national_shipping'))
      .toBe('Consulta el envío con la transportadora usando tu número de guía.');
    expect(resolveWhatsappShipmentTracking(null, 'local_delivery'))
      .toBe('La empresa coordinará la entrega directamente contigo.');
  });
});
