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

describe('store creation operating region validation', () => {
  it('only accepts the Colombia and COP combination supported by checkout', async () => {
    await expect(storeCreationSchema.validateAt('country', { country: 'CO' })).resolves.toBe('CO');
    await expect(storeCreationSchema.validateAt('currency', { currency: 'COP' })).resolves.toBe('COP');
    await expect(storeCreationSchema.validateAt('country', { country: 'MX' })).rejects.toThrow(/Colombia/);
    await expect(storeCreationSchema.validateAt('currency', { currency: 'USD' })).rejects.toThrow(/COP/);
  });
});

describe('store creation split business hours', () => {
  it('accepts an intermediate closing inside the opening hours', async () => {
    await expect(storeCreationSchema.validateAt('businessHours[0]', {
      businessHours: [{
        dayOfWeek: 1,
        isOpen: true,
        opensAt: '10:00',
        closesAt: '22:00',
        breakStartsAt: '15:00',
        breakEndsAt: '18:00',
      }],
    })).resolves.toMatchObject({
      breakStartsAt: '15:00',
      breakEndsAt: '18:00',
    });
  });

  it('rejects an intermediate closing outside the opening hours', async () => {
    await expect(storeCreationSchema.validateAt('businessHours[0]', {
      businessHours: [{
        dayOfWeek: 1,
        isOpen: true,
        opensAt: '10:00',
        closesAt: '22:00',
        breakStartsAt: '09:00',
        breakEndsAt: '18:00',
      }],
    })).rejects.toThrow(/dentro del horario/);
  });

  it('requires both intermediate closing times', async () => {
    await expect(storeCreationSchema.validateAt('businessHours[0]', {
      businessHours: [{
        dayOfWeek: 1,
        isOpen: true,
        opensAt: '10:00',
        closesAt: '22:00',
        breakStartsAt: '15:00',
        breakEndsAt: null,
      }],
    })).rejects.toThrow(/dos horas/);
  });
});
