export interface WhatsappTemplateSelection {
  name: string;
  language: string;
}

/**
 * Test notifications are queued with their own one-parameter template.
 * Order notifications use the currently configured per-store template
 * returned by the secure send context.
 */
export function resolveWhatsappTemplateSelection(
  eventType: string,
  notificationTemplateName: string,
  notificationTemplateLanguage: string,
  contextTemplateName: string | null | undefined,
  contextTemplateLanguage: string | null | undefined,
): WhatsappTemplateSelection {
  if (eventType === 'test_message') {
    return {
      name: notificationTemplateName,
      language: notificationTemplateLanguage,
    };
  }

  return {
    name: contextTemplateName || notificationTemplateName,
    language: contextTemplateLanguage || notificationTemplateLanguage,
  };
}
