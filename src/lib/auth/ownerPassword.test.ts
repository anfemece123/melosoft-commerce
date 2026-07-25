import { describe, expect, it } from 'vitest';
import {
  generateSecureOwnerPassword,
  getOwnerPasswordValidationError,
  OWNER_PASSWORD_MAX_LENGTH,
  OWNER_PASSWORD_MIN_LENGTH,
} from './ownerPassword';

describe('owner password utilities', () => {
  it('generates a strong password using cryptographically secure randomness', () => {
    const password = generateSecureOwnerPassword();

    expect(password).toHaveLength(16);
    expect(getOwnerPasswordValidationError(password)).toBeNull();
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
  });

  it('rejects passwords that do not satisfy every requirement', () => {
    expect(getOwnerPasswordValidationError('Short1!')).toMatch(/12 caracteres/);
    expect(getOwnerPasswordValidationError('ALLUPPERCASE12!')).toMatch(/minúscula/);
    expect(getOwnerPasswordValidationError('alllowercase12!')).toMatch(/mayúscula/);
    expect(getOwnerPasswordValidationError('NoNumbersHere!')).toMatch(/número/);
    expect(getOwnerPasswordValidationError('NoSymbolsHere12')).toMatch(/símbolo/);
    expect(getOwnerPasswordValidationError('SecureOwner12 ')).toMatch(/símbolo/);
    expect(getOwnerPasswordValidationError('Aa1!'.padEnd(OWNER_PASSWORD_MAX_LENGTH + 1, 'x'))).toMatch(/superar/);
  });

  it('rejects unsafe generator lengths', () => {
    expect(() => generateSecureOwnerPassword(OWNER_PASSWORD_MIN_LENGTH - 1)).toThrow();
    expect(() => generateSecureOwnerPassword(OWNER_PASSWORD_MAX_LENGTH + 1)).toThrow();
  });
});
