import { env } from '@/lib/env';

// Client-side driver for Meta WhatsApp Embedded Signup (Modelo B).
// Loads the official Facebook JS SDK, runs FB.login() with the
// Embedded Signup Configuration ID, and listens for the SDK's
// WA_EMBEDDED_SIGNUP session-logging postMessage events to capture
// waba_id/phone_number_id/business_id alongside the exchangeable code.
//
// IMPORTANT: config_id must exist first — it is created manually in the
// Meta App Dashboard (App Dashboard → WhatsApp → Embedded Signup
// Builder), a step outside this code. Until VITE_META_APP_ID and
// VITE_META_WHATSAPP_CONFIG_ID are set, launchWhatsAppEmbeddedSignup
// throws WHATSAPP_EMBEDDED_SIGNUP_NOT_CONFIGURED rather than attempting
// a call that cannot succeed.
//
// The exact postMessage event names/fields below (WA_EMBEDDED_SIGNUP,
// FINISH / FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING / CANCEL / ERROR,
// data.waba_id / data.phone_number_id / data.business_id) follow Meta's
// documented, stable Embedded Signup pattern — the same one used by
// every WhatsApp Business Solution Provider.
//
// PRODUCTION INCIDENT (fixed here): every promise in this file used to
// have either no timeout at all, or relied solely on the Facebook JS
// SDK invoking its FB.login() callback. That callback is NOT guaranteed
// to fire if the user closes the popup window directly, or if Meta's
// side simply stops advancing after the user clicks through — a
// long-documented gap in the FB JS SDK, not something this app's code
// can prevent Meta from doing. When that happened, `await` on that
// promise never resolved OR rejected, so launchWhatsAppEmbeddedSignup()
// never returned, WhatsappSettingsPage's `finally { setConnecting(false) }`
// never ran, and the "Conectar WhatsApp Business" button spun forever.
// Every promise below now has an explicit, bounded timeout, and the
// login step additionally detects "the popup window lost focus and
// never came back with a result" as its own distinct, faster failure
// mode — so this can never hang indefinitely again, regardless of what
// Meta's popup does.

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface FacebookLoginResponse {
  authResponse?: { code?: string } | null;
  status?: string;
}

export interface EmbeddedSignupSession {
  wabaId: string | null;
  phoneNumberId: string | null;
  businessId: string | null;
}

export interface EmbeddedSignupResult {
  code: string;
  session: EmbeddedSignupSession;
}

const GRAPH_SDK_VERSION = 'v25.0'; // fallback only — see docs/whatsapp/deployment.md

// Bounded so nothing in this flow can ever hang forever:
const SDK_LOAD_TIMEOUT_MS = 20_000; // script tag + fbAsyncInit
const LOGIN_TIMEOUT_MS = 3 * 60 * 1000; // FB.login() callback, hard ceiling
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // WA_EMBEDDED_SIGNUP postMessage
// Heuristic grace period: once the main window regains focus (the
// popup normally steals it while open), how long to wait for FB.login()'s
// own callback before concluding the popup was closed without it firing.
// Kept short but non-zero so a brief, legitimate refocus (e.g. alt-tab)
// doesn't false-positive — the LOGIN_TIMEOUT_MS above is the real
// backstop if this heuristic ever misfires in either direction.
const POPUP_CLOSED_GRACE_MS = 4_000;

// Dev/prod-safe diagnostic logging for this flow only — logs event
// names, booleans, and Meta's own non-secret status strings, NEVER the
// raw `code` or any access token. Intended to be temporary: once the
// production incident this was added for is confirmed fixed, these can
// be removed or lowered to a debug-only level.
function logSignupEvent(stage: string, detail?: Record<string, unknown>): void {
  console.info(`[whatsapp-embedded-signup] ${stage}`, detail ?? {});
}

// Meta's official postMessage origin for Embedded Signup. Exact-match
// or "ends with '.facebook.com'" (WITH the leading dot) only — the
// previous check used `.endsWith('facebook.com')` without the dot,
// which would also accept a hostile "https://evil-facebook.com" or
// "https://notfacebook.com", since both literally end with the
// substring "facebook.com". A leading dot (or exact match on the bare
// domain) cannot be spoofed by string concatenation — the only way to
// produce an origin ending in ".facebook.com" is to actually control a
// real facebook.com subdomain.
function isTrustedMetaMessageOrigin(origin: string): boolean {
  if (typeof origin !== 'string' || !origin.startsWith('https://')) return false;
  return origin === 'https://www.facebook.com' || origin.endsWith('.facebook.com');
}

let sdkLoadPromise: Promise<void> | null = null;

function loadFacebookSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    if (window.FB) {
      resolve();
      return;
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      logSignupEvent('sdk_load_timeout');
      reject(new Error('EMBEDDED_SIGNUP_SDK_UNAVAILABLE'));
    }, SDK_LOAD_TIMEOUT_MS);

    window.fbAsyncInit = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.FB?.init({ appId: env.metaAppId ?? '', xfbml: false, version: GRAPH_SDK_VERSION });
      logSignupEvent('sdk_loaded');
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      logSignupEvent('sdk_script_error');
      reject(new Error('No se pudo cargar el SDK de Meta.'));
    };
    document.body.appendChild(script);
  });

  return sdkLoadPromise;
}

// Returns both the promise and a `cancel` so the caller can tear down
// the message listener immediately if the login step fails first —
// otherwise this listener (and its own 5-minute timer) would linger
// uselessly until it times out on its own.
function listenForEmbeddedSignupSession(
  timeoutMs: number,
): { promise: Promise<EmbeddedSignupSession>; cancel: () => void } {
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  let handleMessage: (event: MessageEvent) => void;

  const promise = new Promise<EmbeddedSignupSession>((resolve, reject) => {
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', handleMessage);
      logSignupEvent('session_timeout');
      reject(new Error('EMBEDDED_SIGNUP_TIMEOUT'));
    }, timeoutMs);

    function finish(value: EmbeddedSignupSession | Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
      if (value instanceof Error) reject(value);
      else resolve(value);
    }

    handleMessage = (event: MessageEvent) => {
      if (!isTrustedMetaMessageOrigin(event.origin)) return;

      let parsed: { type?: string; event?: string; data?: Record<string, unknown> } | null = null;
      try {
        parsed = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as typeof parsed);
      } catch {
        return;
      }
      if (!parsed || parsed.type !== 'WA_EMBEDDED_SIGNUP') return;

      logSignupEvent('postmessage_received', { event: parsed.event });

      if (parsed.event === 'FINISH' || parsed.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        finish({
          wabaId: (parsed.data?.waba_id as string | undefined) ?? null,
          phoneNumberId: (parsed.data?.phone_number_id as string | undefined) ?? null,
          businessId: (parsed.data?.business_id as string | undefined) ?? null,
        });
      } else if (parsed.event === 'CANCEL') {
        finish(new Error('EMBEDDED_SIGNUP_CANCELLED'));
      } else if (parsed.event === 'ERROR') {
        finish(new Error('EMBEDDED_SIGNUP_ERROR'));
      }
    };

    window.addEventListener('message', handleMessage);
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
    },
  };
}

// Runs FB.login() and resolves with the exchangeable `code`. Bounded by
// THREE independent mechanisms so it can never hang forever:
//   1. LOGIN_TIMEOUT_MS — hard ceiling regardless of anything else.
//   2. The popup-closed heuristic below — once this window regains
//      focus (the popup normally holds it while open) and the SDK
//      callback still hasn't fired after a short grace period, treat it
//      as "closed without completing".
//   3. The SDK's own callback, when Meta does invoke it.
function runFacebookLogin(options: { coexistence: boolean }): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let popupCloseTimer: ReturnType<typeof setTimeout> | null = null;

    const hardTimeout = setTimeout(() => {
      logSignupEvent('login_timeout');
      settle(new Error('EMBEDDED_SIGNUP_TIMEOUT'));
    }, LOGIN_TIMEOUT_MS);

    function handleFocusReturn() {
      if (settled || popupCloseTimer) return;
      popupCloseTimer = setTimeout(() => {
        logSignupEvent('popup_closed_without_callback');
        settle(new Error('EMBEDDED_SIGNUP_POPUP_CLOSED'));
      }, POPUP_CLOSED_GRACE_MS);
    }
    window.addEventListener('focus', handleFocusReturn);

    function cleanup() {
      clearTimeout(hardTimeout);
      if (popupCloseTimer) clearTimeout(popupCloseTimer);
      window.removeEventListener('focus', handleFocusReturn);
    }

    function settle(result: string | Error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (result instanceof Error) reject(result);
      else resolve(result);
    }

    window.FB?.login(
      (response) => {
        logSignupEvent('login_callback_fired', {
          status: response.status ?? null,
          hasCode: Boolean(response.authResponse?.code),
        });
        if (response.authResponse?.code) {
          settle(response.authResponse.code);
        } else {
          settle(new Error('EMBEDDED_SIGNUP_CANCELLED'));
        }
      },
      {
        config_id: env.metaWhatsappConfigId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          // Requests the WhatsApp Business App coexistence flow when the
          // store already has a number on the mobile app — see migration
          // 096's onboarding_type. sessionInfoVersion opts into the
          // richer WA_EMBEDDED_SIGNUP postMessage payload this file
          // listens for above.
          featureType: options.coexistence ? 'whatsapp_business_app_onboarding' : '',
          sessionInfoVersion: '3',
        },
      },
    );
  });
}

export async function launchWhatsAppEmbeddedSignup(options: { coexistence: boolean }): Promise<EmbeddedSignupResult> {
  // Meta's SDK rejects FB.login from non-HTTPS pages ("FB.login can no
  // longer be called from http pages"). Fail fast with a clear reason
  // instead of letting the SDK throw its own error mid-flow — this also
  // covers plain http://localhost, which is never valid for this call.
  if (typeof window !== 'undefined' && window.location.protocol !== 'https:') {
    throw new Error('WHATSAPP_EMBEDDED_SIGNUP_REQUIRES_HTTPS');
  }

  if (!env.metaAppId || !env.metaWhatsappConfigId) {
    throw new Error('WHATSAPP_EMBEDDED_SIGNUP_NOT_CONFIGURED');
  }

  await loadFacebookSdk();
  if (!window.FB) throw new Error('EMBEDDED_SIGNUP_SDK_UNAVAILABLE');

  const session = listenForEmbeddedSignupSession(SESSION_TIMEOUT_MS);

  let code: string;
  try {
    code = await runFacebookLogin(options);
  } catch (error) {
    // The login step failed/cancelled/timed out — there is nothing left
    // to wait for, so stop listening immediately instead of leaking the
    // message listener until its own 5-minute timeout fires later.
    session.cancel();
    throw error;
  }
  logSignupEvent('login_succeeded');

  const sessionData = await session.promise;
  logSignupEvent('session_data_received', {
    hasWabaId: Boolean(sessionData.wabaId),
    hasPhoneNumberId: Boolean(sessionData.phoneNumberId),
  });

  return { code, session: sessionData };
}
