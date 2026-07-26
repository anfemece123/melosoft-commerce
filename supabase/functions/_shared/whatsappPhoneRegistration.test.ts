import { describe, expect, it, vi } from 'vitest';
import {
  buildMetaPhoneRegistrationDiagnostic,
  generateWhatsappRegistrationPin,
  getWhatsappCoexistenceStatus,
  getWhatsappPhonePlatformStatus,
  isValidWhatsappRegistrationPin,
  registerWhatsappPhone,
  registrationRequiresExistingPin,
} from './whatsappPhoneRegistration.ts';

describe('WhatsApp phone registration', () => {
  it('generates a six-digit PIN', () => {
    expect(generateWhatsappRegistrationPin(() => 0)).toBe('100000');
    expect(generateWhatsappRegistrationPin(() => 899_999)).toBe('999999');
    expect(isValidWhatsappRegistrationPin('654321')).toBe(true);
    expect(isValidWhatsappRegistrationPin('12345')).toBe(false);
  });

  it('posts the required Meta registration payload without putting the token in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const result = await registerWhatsappPhone({
      graphApiVersion: 'v25.0',
      phoneNumberId: 'phone/number',
      accessToken: 'secret-token',
      pin: '654321',
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/phone%2Fnumber/register',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin: '654321' }),
      }),
    );
  });

  it('checks coexistence readiness without exposing the token in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      is_on_biz_app: true,
      platform_type: 'CLOUD_API',
    }), { status: 200 }));

    const result = await getWhatsappPhonePlatformStatus({
      graphApiVersion: 'v25.0',
      phoneNumberId: 'phone/number',
      accessToken: 'secret-token',
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/phone%2Fnumber?fields=is_on_biz_app,platform_type',
      expect.objectContaining({
        headers: { Authorization: 'Bearer secret-token' },
      }),
    );
    expect(getWhatsappCoexistenceStatus(result.body)).toEqual({
      isOnBizApp: true,
      platformType: 'CLOUD_API',
      ready: true,
    });
  });

  it('does not consider a normal Cloud API number ready for coexistence', () => {
    expect(getWhatsappCoexistenceStatus({
      is_on_biz_app: false,
      platform_type: 'CLOUD_API',
    }).ready).toBe(false);
  });

  it('identifies Meta two-step PIN mismatch responses', () => {
    const diagnostic = buildMetaPhoneRegistrationDiagnostic({
      ok: false,
      status: 400,
      body: {
        error: {
          code: 133005,
          type: 'OAuthException',
          message: 'Two-step verification PIN mismatch',
          fbtrace_id: 'trace-123',
        },
      },
    });

    expect(registrationRequiresExistingPin(diagnostic)).toBe(true);
    expect(diagnostic.traceId).toBe('trace-123');
  });

  it('redacts credentials from Meta diagnostics', () => {
    const diagnostic = buildMetaPhoneRegistrationDiagnostic({
      ok: false,
      status: 400,
      body: { error: { message: 'access_token=customer-secret' } },
    });

    expect(diagnostic.metaMessage).toBe('access_token=[redacted]');
  });
});
