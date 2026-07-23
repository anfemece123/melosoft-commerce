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
        error_user_title: 'Template could not be created',
        error_user_msg: 'Review the template parameters.',
        error_data: { details: 'The template language is not supported.' },
      },
    )).toEqual({
      stage: 'template_create',
      templateName: 'melosoft_order_confirmation_v1',
      upstreamStatus: 400,
      metaCode: 100,
      metaSubcode: 2388045,
      metaType: 'OAuthException',
      metaMessage: 'Invalid parameter',
      metaDetails: 'The template language is not supported.',
      metaUserTitle: 'Template could not be created',
      metaUserMessage: 'Review the template parameters.',
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
    expect(diagnostic.metaDetails).toBeNull();
    expect(diagnostic.metaUserTitle).toBeNull();
    expect(diagnostic.metaUserMessage).toBeNull();
  });
});
