import { describe, expect, it } from 'vitest';
import { setPasswordSchema } from './setPassword.schema';

describe('invited owner password validation', () => {
  it('uses the same strong policy as direct owner access', async () => {
    await expect(setPasswordSchema.validate({
      password: 'only-eight',
      confirmPassword: 'only-eight',
    })).rejects.toThrow(/12 caracteres/);

    await expect(setPasswordSchema.validate({
      password: 'SecureOwner12!',
      confirmPassword: 'SecureOwner12!',
    })).resolves.toBeTruthy();
  });

  it('requires matching confirmation', async () => {
    await expect(setPasswordSchema.validate({
      password: 'SecureOwner12!',
      confirmPassword: 'DifferentOwner12!',
    })).rejects.toThrow(/no coinciden/);
  });
});
