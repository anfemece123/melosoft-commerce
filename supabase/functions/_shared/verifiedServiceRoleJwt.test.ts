import { describe, expect, it } from 'vitest';
import { readVerifiedJwtRole } from './verifiedServiceRoleJwt.ts';

function jwtWithPayload(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encoded}.signature`;
}

describe('readVerifiedJwtRole', () => {
  it('reads a verified service_role JWT payload', () => {
    expect(readVerifiedJwtRole(jwtWithPayload({ role: 'service_role' }))).toBe('service_role');
  });

  it('does not authorize user roles or malformed values', () => {
    expect(readVerifiedJwtRole(jwtWithPayload({ role: 'authenticated' }))).toBe('authenticated');
    expect(readVerifiedJwtRole('not-a-jwt')).toBeNull();
    expect(readVerifiedJwtRole('header.@@@.signature')).toBeNull();
  });
});
