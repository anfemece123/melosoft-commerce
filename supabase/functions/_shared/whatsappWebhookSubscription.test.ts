import { describe, expect, it, vi } from 'vitest';
import {
  resolveWhatsappWebhookCallbackUrl,
  subscribeWhatsappWabaWithWebhookOverride,
} from './whatsappWebhookSubscription.ts';

describe('WhatsApp per-WABA webhook subscription', () => {
  it('builds the Commerce callback from the Supabase project URL', () => {
    expect(resolveWhatsappWebhookCallbackUrl({
      supabaseUrl: 'https://project.supabase.co/',
    })).toBe('https://project.supabase.co/functions/v1/whatsapp-webhook');
  });

  it('allows an explicit callback URL for non-standard deployments', () => {
    expect(resolveWhatsappWebhookCallbackUrl({
      supabaseUrl: 'https://project.supabase.co',
      configuredUrl: ' https://commerce.example.com/meta-webhook ',
    })).toBe('https://commerce.example.com/meta-webhook');
  });

  it('subscribes the WABA with an override without exposing credentials in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    const result = await subscribeWhatsappWabaWithWebhookOverride({
      graphApiVersion: 'v25.0',
      wabaId: 'waba/123',
      accessToken: 'customer-access-token',
      callbackUrl: 'https://project.supabase.co/functions/v1/whatsapp-webhook',
      verifyToken: 'commerce-verify-token',
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/waba%2F123/subscribed_apps',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer customer-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          override_callback_uri: 'https://project.supabase.co/functions/v1/whatsapp-webhook',
          verify_token: 'commerce-verify-token',
        }),
      }),
    );
  });

  it('returns a controlled failure when Meta is unavailable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network error'));

    const result = await subscribeWhatsappWabaWithWebhookOverride({
      graphApiVersion: 'v25.0',
      wabaId: 'waba-123',
      accessToken: 'customer-access-token',
      callbackUrl: 'https://project.supabase.co/functions/v1/whatsapp-webhook',
      verifyToken: 'commerce-verify-token',
      fetchImpl,
    });

    expect(result).toEqual({ ok: false, status: 0, body: {} });
  });
});
