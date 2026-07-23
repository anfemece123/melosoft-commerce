import { describe, expect, it } from 'vitest';
import { resolveWhatsappTemplateSelection } from './whatsappTemplateSelection.ts';

describe('resolveWhatsappTemplateSelection', () => {
  it('uses the notification template for a test message', () => {
    expect(resolveWhatsappTemplateSelection(
      'test_message',
      'melosoft_whatsapp_test_v1',
      'es_CO',
      'melosoft_order_confirmation_v1',
      'es_CO',
    )).toEqual({
      name: 'melosoft_whatsapp_test_v1',
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
});
