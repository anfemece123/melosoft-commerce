import { describe, expect, it } from 'vitest';
import { buildWhatsappTemplateCreatePayload } from './whatsappTemplatePayload.ts';

describe('buildWhatsappTemplateCreatePayload', () => {
  it('matches Meta current positional template schema', () => {
    expect(buildWhatsappTemplateCreatePayload({
      name: 'melosoft_whatsapp_test_v1',
      category: 'utility',
      language: 'es_CO',
      bodyText: 'Hola {{1}}.',
      bodyExample: ['Melosoft Commerce'],
    })).toEqual({
      name: 'melosoft_whatsapp_test_v1',
      category: 'utility',
      language: 'es_CO',
      parameter_format: 'positional',
      components: [
        {
          type: 'body',
          text: 'Hola {{1}}.',
          example: { body_text: [['Melosoft Commerce']] },
        },
      ],
    });
  });
});
