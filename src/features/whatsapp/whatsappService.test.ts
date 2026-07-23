import { describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: invokeMock },
  },
}));

// supabase-js's FunctionsHttpError always carries the generic message
// "Edge Function returned a non-2xx status code" — the real body our
// own Edge Function returned only lives on error.context, a Response
// that must be read manually. This class mirrors that shape closely
// enough for completeEmbeddedSignup's extraction logic to exercise the
// same code path a real FunctionsHttpError would.
class FakeFunctionsHttpError extends Error {
  context: Response;
  constructor(context: Response) {
    super('Edge Function returned a non-2xx status code');
    this.name = 'FunctionsHttpError';
    this.context = context;
  }
}

describe('whatsappService.completeEmbeddedSignup — Edge Function error extraction', () => {
  it('reads the real error code from a non-2xx response body instead of the generic SDK message', async () => {
    const { whatsappService } = await import('./whatsappService');
    const context = new Response(JSON.stringify({ error: 'PHONE_NUMBER_ALREADY_CONNECTED', message: 'Ya conectado.' }), {
      status: 409,
    });
    invokeMock.mockResolvedValueOnce({ data: null, error: new FakeFunctionsHttpError(context) });

    await expect(
      whatsappService.completeEmbeddedSignup({
        storeId: 'store-1',
        code: 'code-1',
        wabaId: 'waba-1',
        phoneNumberId: 'phone-1',
        businessId: null,
        coexistence: false,
      }),
    ).rejects.toThrow('PHONE_NUMBER_ALREADY_CONNECTED');
  });

  it('falls back to the generic SDK message when the response body is not JSON', async () => {
    const { whatsappService } = await import('./whatsappService');
    const context = new Response('not json', { status: 500 });
    invokeMock.mockResolvedValueOnce({ data: null, error: new FakeFunctionsHttpError(context) });

    await expect(
      whatsappService.completeEmbeddedSignup({
        storeId: 'store-1',
        code: 'code-1',
        wabaId: 'waba-1',
        phoneNumberId: null,
        businessId: null,
        coexistence: false,
      }),
    ).rejects.toThrow('Edge Function returned a non-2xx status code');
  });

  it('resolves normally when the Edge Function succeeds', async () => {
    const { whatsappService } = await import('./whatsappService');
    const response = {
      ok: true as const,
      connectionStatus: 'connected',
      displayPhoneNumber: '+57 321 3706466',
      verifiedName: 'MelosoftApp',
      onboardingType: 'new_number',
    };
    invokeMock.mockResolvedValueOnce({ data: response, error: null });

    const result = await whatsappService.completeEmbeddedSignup({
      storeId: 'store-1',
      code: 'code-1',
      wabaId: null,
      phoneNumberId: null,
      businessId: null,
      coexistence: false,
    });

    expect(result).toEqual(response);
    expect(invokeMock).toHaveBeenLastCalledWith('whatsapp-embedded-signup', {
      body: {
        storeId: 'store-1',
        code: 'code-1',
        wabaId: null,
        phoneNumberId: null,
        businessId: null,
        coexistence: false,
      },
    });
  });
});
