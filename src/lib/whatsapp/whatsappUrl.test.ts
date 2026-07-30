import { describe, expect, it } from 'vitest';
import { buildWhatsAppContactUrl, normalizePhoneForWhatsApp } from './whatsappUrl';

describe('WhatsApp URL normalization', () => {
  it.each([
    ['3185839777', '573185839777'],
    ['573185839777', '573185839777'],
    ['+57 318 583 9777', '573185839777'],
    ['0057 318 583 9777', '573185839777'],
  ])('normalizes %s as a Colombian international number', (input, expected) => {
    expect(normalizePhoneForWhatsApp(input)).toBe(expected);
  });

  it('does not invent a destination for incomplete Colombian numbers', () => {
    expect(normalizePhoneForWhatsApp('3185839')).toBeNull();
  });

  it('builds an encoded wa.me link', () => {
    expect(buildWhatsAppContactUrl('3185839777', 'Hola, necesito ayuda.')).toBe(
      'https://wa.me/573185839777?text=Hola%2C%20necesito%20ayuda.'
    );
  });
});
