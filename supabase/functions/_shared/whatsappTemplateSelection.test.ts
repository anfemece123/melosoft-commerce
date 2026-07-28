import { describe, expect, it } from 'vitest';
import {
  resolveWhatsappTemplateSelection,
  WHATSAPP_TEST_ORDER_TEMPLATE_PARAMS,
} from './whatsappTemplateSelection.ts';

describe('resolveWhatsappTemplateSelection', () => {
  it('uses the connected store template for a test message', () => {
    expect(resolveWhatsappTemplateSelection(
      'test_message',
      'melosoft_whatsapp_test_v1',
      'es_CO',
      'melosoft_order_confirmation_v1',
      'es_CO',
    )).toEqual({
      name: 'melosoft_order_confirmation_v1',
      language: 'es_CO',
    });
  });

  it('uses the connected store template for an order message', () => {
    expect(resolveWhatsappTemplateSelection(
      'order_received',
      'queued_template',
      'en_US',
      'melosoft_order_confirmation_v1',
      'es_CO',
    )).toEqual({
      name: 'melosoft_order_confirmation_v1',
      language: 'es_CO',
    });
  });

  it('falls back to the queued template when the send context has no template values', () => {
    expect(resolveWhatsappTemplateSelection(
      'order_received',
      'queued_template',
      'es_CO',
      null,
      null,
    )).toEqual({
      name: 'queued_template',
      language: 'es_CO',
    });
  });

  it('uses the dedicated shipment template when an order is dispatched', () => {
    expect(resolveWhatsappTemplateSelection(
      'order_shipped',
      'queued_shipment_template',
      'es_CO',
      'melosoft_order_confirmation_v1',
      'es_CO',
      'melosoft_order_status_v1',
      'es_CO',
      'melosoft_order_shipment_v1',
      'es_CO',
    )).toEqual({
      name: 'melosoft_order_shipment_v1',
      language: 'es_CO',
    });
  });

  it.each(['order_ready_for_pickup', 'order_out_for_delivery'])(
    'keeps %s on the generic status template',
    (eventType) => {
      expect(resolveWhatsappTemplateSelection(
        eventType,
        'queued_status_template',
        'es_CO',
        'melosoft_order_confirmation_v1',
        'es_CO',
        'melosoft_order_status_v1',
        'es_CO',
        'melosoft_order_shipment_v1',
        'es_CO',
      )).toEqual({
        name: 'melosoft_order_status_v1',
        language: 'es_CO',
      });
    },
  );

  it('provides the nine parameters required by the approved order template', () => {
    expect(WHATSAPP_TEST_ORDER_TEMPLATE_PARAMS).toHaveLength(9);
    expect(WHATSAPP_TEST_ORDER_TEMPLATE_PARAMS.join(' ')).toContain('prueba');
  });
});
