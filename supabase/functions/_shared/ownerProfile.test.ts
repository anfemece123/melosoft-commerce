import { describe, expect, it } from 'vitest';
import { buildOwnerProfileUpsert } from './ownerProfile';

const owner = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'owner@example.com',
  fullName: 'Owner Example',
  phone: '3000000000',
  documentType: 'CC',
  documentNumber: '123456789',
};

describe('owner profile creation', () => {
  it('never updates an existing global profile during store creation', () => {
    expect(buildOwnerProfileUpsert(owner, true)).toBeNull();
  });

  it('creates personal fields without assigning global role or status', () => {
    const row = buildOwnerProfileUpsert(owner, false);
    expect(row?.email).toBe(owner.email);
    expect(row).not.toHaveProperty('platform_role');
    expect(row).not.toHaveProperty('status');
  });
});
