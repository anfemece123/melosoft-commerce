export interface WhatsappTemplateDefinition {
  name: string;
  category: 'utility';
  language: string;
  bodyText: string;
  bodyExample: string[];
}

/**
 * Builds the current positional message-template payload documented by
 * Meta. Keep the explicit parameter_format even though Meta documents
 * positional as the default: it removes ambiguity across Graph API
 * versions and matches the current request schema exactly.
 */
export function buildWhatsappTemplateCreatePayload(template: WhatsappTemplateDefinition) {
  return {
    name: template.name,
    category: template.category,
    language: template.language,
    parameter_format: 'positional',
    components: [
      {
        type: 'body',
        text: template.bodyText,
        example: { body_text: [template.bodyExample] },
      },
    ],
  };
}
