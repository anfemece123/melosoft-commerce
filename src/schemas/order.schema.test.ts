import { describe, expect, it } from 'vitest';
import {
  createCheckoutSchema,
  WHATSAPP_CONSENT_REQUIRED_MESSAGE,
} from './order.schema';

describe('checkout WhatsApp consent validation', () => {
  it('requires explicit consent when automatic order updates are ready', async () => {
    const schema = createCheckoutSchema(true);

    await expect(
      schema.validateAt('whatsappConsent', { whatsappConsent: false }),
    ).rejects.toThrow(WHATSAPP_CONSENT_REQUIRED_MESSAGE);

    await expect(
      schema.validateAt('whatsappConsent', { whatsappConsent: true }),
    ).resolves.toBe(true);
  });

  it('does not block stores without an operational WhatsApp channel', async () => {
    const schema = createCheckoutSchema(false);

    await expect(
      schema.validateAt('whatsappConsent', { whatsappConsent: false }),
    ).resolves.toBe(false);
  });
});
