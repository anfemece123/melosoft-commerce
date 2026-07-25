import { describe, expect, it } from 'vitest';
import { storeCreationSchema } from './storeCreation.schema';

const OWNER_BASE = {
  ownerFullName: 'María Gómez',
  ownerEmail: 'maria@example.com',
  ownerPhone: '+57 300 000 0000',
  ownerDocumentType: null,
  ownerDocumentNumber: null,
};

async function validateOwnerAccess(values: Record<string, unknown>) {
  return storeCreationSchema.validateAt('ownerPassword', {
    ...OWNER_BASE,
    ownerAccessMode: 'invitation',
    ownerPassword: '',
    ownerPasswordConfirm: '',
    ...values,
  });
}

describe('store creation owner access validation', () => {
  it('does not require a password when sending an invitation', async () => {
    await expect(validateOwnerAccess({ ownerAccessMode: 'invitation' })).resolves.toBe('');
  });

  it('requires a strong password for direct access', async () => {
    await expect(
      validateOwnerAccess({ ownerAccessMode: 'password', ownerPassword: 'weak' })
    ).rejects.toThrow(/12 caracteres/);

    await expect(
      validateOwnerAccess({
        ownerAccessMode: 'password',
        ownerPassword: 'SecureOwner12!',
      })
    ).resolves.toBe('SecureOwner12!');
  });

  it('requires password confirmation to match in direct mode', async () => {
    await expect(
      storeCreationSchema.validateAt('ownerPasswordConfirm', {
        ...OWNER_BASE,
        ownerAccessMode: 'password',
        ownerPassword: 'SecureOwner12!',
        ownerPasswordConfirm: 'DifferentOwner12!',
      })
    ).rejects.toThrow(/no coinciden/);
  });
});
