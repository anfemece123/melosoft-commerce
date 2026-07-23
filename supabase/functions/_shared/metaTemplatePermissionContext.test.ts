import { describe, expect, it } from 'vitest';
import { buildMetaTemplatePermissionContext } from './metaTemplatePermissionContext.ts';

describe('buildMetaTemplatePermissionContext', () => {
  it('reports the management permission and safe WABA review fields', () => {
    expect(buildMetaTemplatePermissionContext(
      {
        ok: true,
        status: 200,
        body: {
          data: [
            { permission: 'whatsapp_business_messaging', status: 'granted' },
            { permission: 'whatsapp_business_management', status: 'granted' },
          ],
        },
      },
      {
        ok: true,
        status: 200,
        body: {
          id: 'must-not-be-returned',
          name: 'must-not-be-returned',
          account_review_status: 'APPROVED',
          business_verification_status: 'VERIFIED',
          ownership_type: 'CLIENT_OWNED',
          country: 'CO',
        },
      },
    )).toEqual({
      managementPermission: 'granted',
      permissionQueryStatus: 200,
      wabaQueryStatus: 200,
      waba: {
        accountReviewStatus: 'APPROVED',
        businessVerificationStatus: 'VERIFIED',
        ownershipType: 'CLIENT_OWNED',
        country: 'CO',
      },
    });
  });

  it('distinguishes a missing permission from a failed permission query', () => {
    expect(buildMetaTemplatePermissionContext(
      { ok: true, status: 200, body: { data: [] } },
      { ok: false, status: 403, body: {} },
    ).managementPermission).toBe('missing');

    expect(buildMetaTemplatePermissionContext(
      { ok: false, status: 401, body: {} },
      { ok: false, status: 0, body: {} },
    ).managementPermission).toBe('unknown');
  });
});
