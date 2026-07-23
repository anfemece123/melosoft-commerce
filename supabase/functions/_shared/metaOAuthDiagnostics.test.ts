import { describe, expect, it } from 'vitest';
import {
  buildMetaTokenExchangeDiagnostic,
  sanitizeMetaOAuthErrorMessage,
} from './metaOAuthDiagnostics';

describe('sanitizeMetaOAuthErrorMessage', () => {
  it('preserves the useful Meta explanation', () => {
    expect(sanitizeMetaOAuthErrorMessage(
      'Error validating verification code. Please make sure your redirect_uri is identical.',
    )).toBe('Error validating verification code. Please make sure your redirect_uri is identical.');
  });

  it('redacts OAuth credentials if Meta unexpectedly echoes them', () => {
    expect(sanitizeMetaOAuthErrorMessage(
      'client_secret=super-secret code:one-time-code access_token="customer-token"',
    )).toBe('client_secret=[redacted] code:[redacted] access_token=[redacted]');
  });
});

describe('buildMetaTokenExchangeDiagnostic', () => {
  it('returns only bounded, non-secret fields needed to diagnose Meta', () => {
    expect(buildMetaTokenExchangeDiagnostic(400, {
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 36008,
      fbtrace_id: 'trace-123',
    })).toEqual({
      stage: 'token_exchange',
      upstreamStatus: 400,
      metaCode: 100,
      metaSubcode: 36008,
      metaType: 'OAuthException',
      metaMessage: 'Invalid parameter',
      traceId: 'trace-123',
    });
  });
});
