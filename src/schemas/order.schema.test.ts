import { describe, expect, it } from 'vitest';
import {
  checkoutSchema,
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

describe('checkout customer phone validation', () => {
  it('accepts a complete Colombian mobile in national or country-code format', async () => {
    await expect(checkoutSchema.validateAt('customerPhone', { customerPhone: '3001234567' }))
      .resolves.toBe('3001234567');
    await expect(checkoutSchema.validateAt('customerPhone', { customerPhone: '573001234567' }))
      .resolves.toBe('573001234567');
  });

  it('rejects letters, incomplete values and landlines', async () => {
    await expect(checkoutSchema.validateAt('customerPhone', { customerPhone: '30012abc67' }))
      .rejects.toThrow(/números|celular colombiano/);
    await expect(checkoutSchema.validateAt('customerPhone', { customerPhone: '300123456' }))
      .rejects.toThrow(/10 dígitos/);
    await expect(checkoutSchema.validateAt('customerPhone', { customerPhone: '6011234567' }))
      .rejects.toThrow(/celular colombiano/);
  });
});
