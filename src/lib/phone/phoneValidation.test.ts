import { describe, expect, it } from 'vitest';
import {
  isValidColombianContactPhone,
  isValidColombianMobile,
  normalizeColombianMobile,
  sanitizePhoneInput,
} from './phoneValidation';

describe('phone validation', () => {
  it('removes letters and formatting while enforcing the maximum length', () => {
    expect(sanitizePhoneInput('abc +57 (300) 123-4567 xyz')).toBe('573001234567');
    expect(sanitizePhoneInput('300123456789999')).toBe('300123456789');
  });

  it('accepts Colombian mobiles in national or country-code format', () => {
    expect(isValidColombianMobile('3001234567')).toBe(true);
    expect(isValidColombianMobile('573001234567')).toBe(true);
    expect(normalizeColombianMobile('573001234567')).toBe('3001234567');
  });

  it('rejects incomplete, alphabetic, landline and foreign-looking mobiles', () => {
    expect(isValidColombianMobile('300123456')).toBe(false);
    expect(isValidColombianMobile('300123456a')).toBe(false);
    expect(isValidColombianMobile('6011234567')).toBe(false);
    expect(isValidColombianMobile('15551234567')).toBe(false);
  });

  it('allows modern Colombian landlines only for general contact fields', () => {
    expect(isValidColombianContactPhone('6011234567')).toBe(true);
    expect(isValidColombianContactPhone('576011234567')).toBe(true);
    expect(isValidColombianContactPhone('6091234567')).toBe(false);
  });
});
