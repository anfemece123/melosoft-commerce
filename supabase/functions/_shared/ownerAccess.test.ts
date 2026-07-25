import { describe, expect, it } from 'vitest';
import { ownerPasswordValidationError } from './ownerAccess';

describe('create-store owner access validation', () => {
  it('accepts a strong initial password', () => {
    expect(ownerPasswordValidationError('SecureOwner12!')).toBeNull();
  });

  it('rejects each weak password category on the server boundary', () => {
    expect(ownerPasswordValidationError('Short1!')).toMatch(/12 caracteres/);
    expect(ownerPasswordValidationError('ALLUPPERCASE12!')).toMatch(/minúscula/);
    expect(ownerPasswordValidationError('alllowercase12!')).toMatch(/mayúscula/);
    expect(ownerPasswordValidationError('NoNumbersHere!')).toMatch(/número/);
    expect(ownerPasswordValidationError('NoSymbolsHere12')).toMatch(/símbolo/);
    expect(ownerPasswordValidationError('SecureOwner12 ')).toMatch(/símbolo/);
  });
});
