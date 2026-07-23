import { describe, expect, it } from 'vitest';
import { buildMetaTemplateSyncDiagnostic } from './metaGraphDiagnostics.ts';

describe('buildMetaTemplateSyncDiagnostic', () => {
  it('returns bounded fields that identify the failed template operation', () => {
    expect(buildMetaTemplateSyncDiagnostic(
      'template_create',
      'melosoft_order_confirmation_v1',
      400,
      {
        message: 'Invalid parameter',
        type: 'OAuthException',
        code: 100,
        error_subcode: 2388045,
        fbtrace_id: 'trace-123',
      },
    )).toEqual({
      stage: 'template_create',
      templateName: 'melosoft_order_confirmation_v1',
      upstreamStatus: 400,
      metaCode: 100,
      metaSubcode: 2388045,
      metaType: 'OAuthException',
      metaMessage: 'Invalid parameter',
      traceId: 'trace-123',
    });
  });

  it('redacts credentials if Meta unexpectedly echoes them', () => {
    const diagnostic = buildMetaTemplateSyncDiagnostic(
      'template_lookup',
      'melosoft_whatsapp_test_v1',
      401,
      { message: 'access_token=customer-token' },
    );

    expect(diagnostic.metaMessage).toBe('access_token=[redacted]');
  });
});
