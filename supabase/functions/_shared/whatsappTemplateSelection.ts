export interface WhatsappTemplateSelection {
  name: string;
  language: string;
}

/**
 * Test sends deliberately reuse the store's approved order template.
 * Keeping a second, independently reviewed test template made the UI report
 * "ready" from the order-template status while Meta could still reject the
 * test template with 132001. One approved template per WABA is both simpler
 * for every merchant and makes the test exercise the real sending path.
 */
export function resolveWhatsappTemplateSelection(
  _eventType: string,
  notificationTemplateName: string,
  notificationTemplateLanguage: string,
  contextTemplateName: string | null | undefined,
  contextTemplateLanguage: string | null | undefined,
): WhatsappTemplateSelection {
  return {
    name: contextTemplateName || notificationTemplateName,
    language: contextTemplateLanguage || notificationTemplateLanguage,
  };
}

/**
 * Nine safe example values matching melosoft_order_confirmation_v1.
 * The test is visibly marked as such and cannot be mistaken for a real order.
 */
export const WHATSAPP_TEST_ORDER_TEMPLATE_PARAMS = [
  'Cliente de prueba',
  'Tu tienda',
  'PRUEBA-0001',
  '1x Pedido de prueba',
  '$ 0',
  'No aplica',
  'No aplica',
  'Prueba',
  'Este es un mensaje de prueba de Melosoft Commerce.',
] as const;
