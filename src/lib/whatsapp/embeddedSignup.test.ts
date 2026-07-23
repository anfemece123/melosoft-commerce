import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    metaAppId: 'test-meta-app-id',
    metaWhatsappConfigId: 'test-config-id',
  },
}));

// Imported AFTER the env mock is registered above, and reset per-test via
// vi.resetModules() so each test gets a fresh sdkLoadPromise (module-level
// cache) and a fresh window.FB mock.
async function importEmbeddedSignup() {
  return import('./embeddedSignup');
}

function setHttpsLocation() {
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, protocol: 'https:' },
  });
  return () => Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
}

function postFinishMessage(overrides: {
  event?: string;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  businessId?: string | null;
  origin?: string;
} = {}) {
  const data = {
    type: 'WA_EMBEDDED_SIGNUP',
    event: overrides.event ?? 'FINISH',
    data: {
      waba_id: overrides.wabaId === undefined ? '880579344939347' : overrides.wabaId,
      phone_number_id: overrides.phoneNumberId === undefined ? '123456' : overrides.phoneNumberId,
      business_id: overrides.businessId === undefined ? 'biz-1' : overrides.businessId,
    },
  };
  window.dispatchEvent(new MessageEvent('message', {
    origin: overrides.origin ?? 'https://www.facebook.com',
    data: JSON.stringify(data),
  }));
}

describe('launchWhatsAppEmbeddedSignup', () => {
  let restoreLocation: () => void;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    restoreLocation = setHttpsLocation();
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    // Fresh FB mock per test — assigned after resetModules so the
    // re-imported module's `window.FB` check in loadFacebookSdk sees it.
    window.FB = { init: vi.fn(), login: vi.fn() };
  });

  afterEach(() => {
    restoreLocation();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as { FB?: unknown }).FB;
  });

  it('resolves with code + session on a successful FINISH callback', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      callback({ status: 'connected', authResponse: { code: 'auth-code-123' } });
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    // Let the SDK-load await resolve and the session listener actually
    // attach before dispatching — otherwise the message is sent to a
    // listener that doesn't exist yet.
    await vi.advanceTimersByTimeAsync(0);
    postFinishMessage();
    const result = await resultPromise;

    expect(result.code).toBe('auth-code-123');
    expect(result.session).toEqual({ wabaId: '880579344939347', phoneNumberId: '123456', businessId: 'biz-1' });
  });

  it('resolves with session data when Meta sends FINISH_ONLY_WABA (no phone_number_id) — the production incident', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      callback({ status: 'connected', authResponse: { code: 'auth-code-only-waba' } });
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    await vi.advanceTimersByTimeAsync(0);
    postFinishMessage({ event: 'FINISH_ONLY_WABA', phoneNumberId: null });
    const result = await resultPromise;

    expect(result.code).toBe('auth-code-only-waba');
    expect(result.session.wabaId).toBe('880579344939347');
    expect(result.session.phoneNumberId).toBeNull();
  });

  it('rejects with EMBEDDED_SIGNUP_CANCELLED when FB.login callback fires with no code', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      callback({ status: 'unknown', authResponse: null });
    });

    await expect(launchWhatsAppEmbeddedSignup({ coexistence: false })).rejects.toThrow('EMBEDDED_SIGNUP_CANCELLED');
  });

  it('rejects with EMBEDDED_SIGNUP_CANCELLED when Meta sends a CANCEL postMessage after a successful login callback', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      callback({ status: 'connected', authResponse: { code: 'auth-code-123' } });
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    await vi.advanceTimersByTimeAsync(0);
    postFinishMessage({ event: 'CANCEL' });

    await expect(resultPromise).rejects.toThrow('EMBEDDED_SIGNUP_CANCELLED');
  });

  it('rejects with EMBEDDED_SIGNUP_ERROR when Meta sends an ERROR postMessage', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      callback({ status: 'connected', authResponse: { code: 'auth-code-123' } });
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    await vi.advanceTimersByTimeAsync(0);
    postFinishMessage({ event: 'ERROR' });

    await expect(resultPromise).rejects.toThrow('EMBEDDED_SIGNUP_ERROR');
  });

  it('rejects with EMBEDDED_SIGNUP_POPUP_CLOSED when the window regains focus and the SDK callback never fires', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation(() => {
      // Meta's popup closed without ever invoking this callback.
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    const assertion = expect(resultPromise).rejects.toThrow('EMBEDDED_SIGNUP_POPUP_CLOSED');

    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(4_000);

    await assertion;
  });

  it('rejects with EMBEDDED_SIGNUP_TIMEOUT if neither the callback nor a focus event ever arrives', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation(() => {
      // Never calls back, never returns focus — a fully stuck popup.
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    const assertion = expect(resultPromise).rejects.toThrow('EMBEDDED_SIGNUP_TIMEOUT');

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

    await assertion;
  });

  it('captures session data that arrives BEFORE the FB.login callback (race order 1)', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    let capturedCallback: ((response: { status?: string; authResponse?: { code?: string } | null }) => void) | null = null;
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      capturedCallback = callback;
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    // Let setup run far enough that FB.login was called (capturing its
    // callback) and the session listener is attached — then the message
    // arrives BEFORE we manually invoke the login callback.
    await vi.advanceTimersByTimeAsync(0);
    postFinishMessage();
    capturedCallback!({ status: 'connected', authResponse: { code: 'race-order-1' } });

    const result = await resultPromise;
    expect(result.code).toBe('race-order-1');
    expect(result.session.wabaId).toBe('880579344939347');
  });

  it('captures session data that arrives AFTER the FB.login callback (race order 2)', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      callback({ status: 'connected', authResponse: { code: 'race-order-2' } });
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    await Promise.resolve(); // let the login callback's microtask settle first
    postFinishMessage();

    const result = await resultPromise;
    expect(result.code).toBe('race-order-2');
    expect(result.session.wabaId).toBe('880579344939347');
  });

  it('ignores a postMessage from a disallowed origin, and still resolves once the real one arrives', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      callback({ status: 'connected', authResponse: { code: 'auth-code-123' } });
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    await vi.advanceTimersByTimeAsync(0);
    // Spoofed origin: ends with the substring "facebook.com" but is not
    // an actual facebook.com (sub)domain — must be rejected silently.
    postFinishMessage({ origin: 'https://evil-facebook.com', wabaId: 'attacker-waba' });
    // The real message, from a genuine Meta origin, must still work.
    postFinishMessage({ origin: 'https://www.facebook.com' });

    const result = await resultPromise;
    expect(result.session.wabaId).toBe('880579344939347');
  });

  it('never resolves/rejects from a disallowed-origin message alone (times out instead of accepting it)', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation(() => {
      // No callback — only a spoofed postMessage will be sent.
    });

    const resultPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    const assertion = expect(resultPromise).rejects.toThrow('EMBEDDED_SIGNUP_TIMEOUT');

    postFinishMessage({ origin: 'https://notfacebook.com' });
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

    await assertion;
  });

  it('removes its message/focus listeners once settled, on every path (success, cancel, and popup-closed)', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();

    // Success path
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      callback({ status: 'connected', authResponse: { code: 'ok' } });
    });
    const successPromise = launchWhatsAppEmbeddedSignup({ coexistence: false });
    await vi.advanceTimersByTimeAsync(0);
    postFinishMessage();
    await successPromise;

    const messageAdds = addEventListenerSpy.mock.calls.filter((c) => c[0] === 'message').length;
    const messageRemoves = removeEventListenerSpy.mock.calls.filter((c) => c[0] === 'message').length;
    const focusAdds = addEventListenerSpy.mock.calls.filter((c) => c[0] === 'focus').length;
    const focusRemoves = removeEventListenerSpy.mock.calls.filter((c) => c[0] === 'focus').length;
    expect(messageRemoves).toBe(messageAdds);
    expect(focusRemoves).toBe(focusAdds);
  });

  it('cancels the still-pending session listener as soon as the login step itself rejects', async () => {
    const { launchWhatsAppEmbeddedSignup } = await importEmbeddedSignup();
    (window.FB!.login as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      callback({ status: 'unknown', authResponse: null }); // cancelled
    });

    await expect(launchWhatsAppEmbeddedSignup({ coexistence: false })).rejects.toThrow('EMBEDDED_SIGNUP_CANCELLED');

    // The session (postMessage) listener must have been torn down
    // immediately rather than lingering for its own 5-minute timeout.
    const messageAdds = addEventListenerSpy.mock.calls.filter((c) => c[0] === 'message').length;
    const messageRemoves = removeEventListenerSpy.mock.calls.filter((c) => c[0] === 'message').length;
    expect(messageRemoves).toBe(messageAdds);
  });
});
