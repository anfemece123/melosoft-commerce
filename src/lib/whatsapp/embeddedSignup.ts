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
// FINISH / FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING / FINISH_ONLY_WABA /
// CANCEL / ERROR, data.waba_id / data.phone_number_id / data.business_id)
// follow Meta's documented, stable Embedded Signup pattern — the same
// one used by every WhatsApp Business Solution Provider.
//
// PRODUCTION INCIDENT — real production evidence showed:
//   sdk_loaded → login_callback_fired {status: connected, hasCode: true}
//   → login_succeeded → ... nothing. No postmessage_received, no
//   session_data_received, no Network call, no error, no loading end.
//
// The exact await that was stuck: `await session.promise` right after
// `login_succeeded`, below in launchWhatsAppEmbeddedSignup. That promise
// DID have its own timeout (5 minutes) — but two things were wrong: (1)
// once Meta already invoked the FB.login() callback successfully, there
// is no reason to keep waiting minutes for the accompanying session
// postMessage — if Meta is going to send it, it arrives almost
// immediately; and (2) there was no visibility into WHY no message ever
// arrived (arrived and got silently dropped by the origin check, vs.
// never arrived at all).
//
// Fixed here: (a) a short, dedicated grace window that starts counting
// specifically from the moment login succeeds — see
// POST_LOGIN_SESSION_GRACE_MS — instead of relying on FB.login's own
// timeout (which had already fired successfully and can't help here);
// (b) a coordinator state object (hasCode/hasSessionInfo/
// lastEmbeddedSignupEvent) logged immediately after login succeeds, and
// a distinct log line for a message that matched Meta's own payload
// shape but got rejected by the origin check — so the next time this
// happens, the logs say exactly what happened instead of just going
// silent; (c) FINISH/FINISH_ONLY_WABA/CANCEL/ERROR are all recognized
// (FINISH_ONLY_WABA — and any other FINISH_* variant — via a prefix
// match, not an exact enumerated list); (d) a distinct
// EMBEDDED_SIGNUP_NO_SESSION_INFO error, carrying a correlation ID, for
// the case where code succeeds but truly no session data ever arrives.

// ── Diagnostics ────────────────────────────────────────────────

// One correlation ID per launchWhatsAppEmbeddedSignup() attempt — every
// log line and every thrown EmbeddedSignupError for that attempt carries
// it, so a user-visible error message can be matched back to the exact
// console/log sequence that produced it.
function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

// Dev/prod-safe diagnostic logging for this flow only — logs event
// names, booleans, elapsed time, and Meta's own non-secret status/event
// strings, NEVER the raw `code` or any access token. Intended to be
// temporary: once this incident is confirmed fixed in production, these
// can be removed or lowered to a debug-only level.
function createSignupLogger(correlationId: string) {
  return function logSignupEvent(stage: string, detail?: Record<string, unknown>): void {
    console.info(`[whatsapp-embedded-signup:${correlationId}] ${stage}`, detail ?? {});
  };
}

// Thrown by every failure path in this file. `code` is the stable,
// matchable identifier WhatsappSettingsPage's error-message map keys on
// (unchanged contract vs. a plain Error's .message); `correlationId`
// lets a displayed error be traced back to its exact log sequence.
export class EmbeddedSignupError extends Error {
  readonly code: string;
  readonly correlationId: string;

  constructor(code: string, correlationId: string) {
    super(code);
    this.name = 'EmbeddedSignupError';
    this.code = code;
    this.correlationId = correlationId;
  }
}

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
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // WA_EMBEDDED_SIGNUP postMessage, own timeout — covers it arriving anytime during the whole flow, including before login succeeds
// Short, DEDICATED grace window that starts counting from the moment
// login succeeds — not from when the popup opened. If Meta is going to
// send the session postMessage at all, it arrives within a couple of
// seconds of the login callback firing; there is no reason to wait
// minutes for it once we already have the code. This is the fix for the
// exact reported incident: FB.login succeeded, login_succeeded logged,
// then silence — this bounds that silence to a few seconds instead of
// up to SESSION_TIMEOUT_MS.
const POST_LOGIN_SESSION_GRACE_MS = 12_000;
// Heuristic grace period: once the main window regains focus (the
// popup normally steals it while open), how long to wait for FB.login()'s
// own callback before concluding the popup was closed without it firing.
// Kept short but non-zero so a brief, legitimate refocus (e.g. alt-tab)
// doesn't false-positive — the LOGIN_TIMEOUT_MS above is the real
// backstop if this heuristic ever misfires in either direction.
const POPUP_CLOSED_GRACE_MS = 4_000;

// Meta's official postMessage origin for Embedded Signup. Exact-match
// or "ends with '.facebook.com'" (WITH the leading dot) only — a check
// without the dot would also accept a hostile "https://evil-facebook.com"
// or "https://notfacebook.com", since both literally end with the
// substring "facebook.com". A leading dot (or exact match on the bare
// domain) cannot be spoofed by string concatenation — the only way to
// produce an origin ending in ".facebook.com" is to actually control a
// real facebook.com subdomain.
function isTrustedMetaMessageOrigin(origin: string): boolean {
  if (typeof origin !== 'string' || !origin.startsWith('https://')) return false;
  return origin === 'https://www.facebook.com' || origin.endsWith('.facebook.com');
}

let sdkLoadPromise: Promise<void> | null = null;

function loadFacebookSdk(log: ReturnType<typeof createSignupLogger>): Promise<void> {
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
      log('sdk_load_timeout');
      reject(new Error('EMBEDDED_SIGNUP_SDK_UNAVAILABLE'));
    }, SDK_LOAD_TIMEOUT_MS);

    window.fbAsyncInit = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.FB?.init({ appId: env.metaAppId ?? '', xfbml: false, version: GRAPH_SDK_VERSION });
      log('sdk_loaded');
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
      log('sdk_script_error');
      reject(new Error('No se pudo cargar el SDK de Meta.'));
    };
    document.body.appendChild(script);
  });

  return sdkLoadPromise;
}

interface CoordinatorState {
  hasCode: boolean;
  hasSessionInfo: boolean;
  lastEmbeddedSignupEvent: string | null;
}

// Returns the promise, a `cancel` so the caller can tear it down
// immediately if the login step fails first (otherwise this listener —
// and its own timer — would linger uselessly), and the live
// `coordinatorState` object the caller reads right after login succeeds
// to log exactly what's been observed so far.
function listenForEmbeddedSignupSession(
  timeoutMs: number,
  log: ReturnType<typeof createSignupLogger>,
): { promise: Promise<EmbeddedSignupSession>; cancel: () => void; state: CoordinatorState } {
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  let handleMessage: (event: MessageEvent) => void;
  const state: CoordinatorState = { hasCode: false, hasSessionInfo: false, lastEmbeddedSignupEvent: null };

  const promise = new Promise<EmbeddedSignupSession>((resolve, reject) => {
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', handleMessage);
      log('session_timeout');
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
      let parsed: { type?: string; event?: string; data?: Record<string, unknown> } | null = null;
      try {
        parsed = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as typeof parsed);
      } catch {
        return; // Not JSON at all — unrelated postMessage traffic (extensions, devtools, etc).
      }
      if (!parsed || typeof parsed !== 'object' || parsed.type !== 'WA_EMBEDDED_SIGNUP') return;

      // The payload genuinely LOOKS like Meta's Embedded Signup session
      // message — only now is a wrong origin worth logging as
      // suspicious, instead of before the type check (which would also
      // flag every unrelated postMessage arriving from a non-Meta
      // origin, drowning the signal in noise).
      if (!isTrustedMetaMessageOrigin(event.origin)) {
        log('postmessage_origin_rejected', { origin: event.origin });
        return;
      }

      state.hasSessionInfo = true;
      state.lastEmbeddedSignupEvent = parsed.event ?? null;
      log('postmessage_received', { event: parsed.event });

      // Accepts FINISH, FINISH_ONLY_WABA (sent when the WABA already has
      // a verified number registered before running Embedded Signup —
      // it carries no phone_number_id, which is fine, see
      // launchWhatsAppEmbeddedSignup/WhatsappSettingsPage below), and
      // any other FINISH_* variant Meta introduces — matched by prefix
      // instead of an exact enumerated list so a new variant is handled
      // the same way instead of requiring another narrow patch.
      if (parsed.event === 'CANCEL') {
        finish(new Error('EMBEDDED_SIGNUP_CANCELLED'));
      } else if (parsed.event === 'ERROR') {
        finish(new Error('EMBEDDED_SIGNUP_ERROR'));
      } else if (typeof parsed.event === 'string' && parsed.event.startsWith('FINISH')) {
        finish({
          wabaId: (parsed.data?.waba_id as string | undefined) ?? null,
          phoneNumberId: (parsed.data?.phone_number_id as string | undefined) ?? null,
          businessId: (parsed.data?.business_id as string | undefined) ?? null,
        });
      }
    };

    window.addEventListener('message', handleMessage);
  });

  return {
    promise,
    state,
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
function runFacebookLogin(
  options: { coexistence: boolean },
  log: ReturnType<typeof createSignupLogger>,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let popupCloseTimer: ReturnType<typeof setTimeout> | null = null;

    const hardTimeout = setTimeout(() => {
      log('login_timeout');
      settle(new Error('EMBEDDED_SIGNUP_TIMEOUT'));
    }, LOGIN_TIMEOUT_MS);

    function handleFocusReturn() {
      if (settled || popupCloseTimer) return;
      popupCloseTimer = setTimeout(() => {
        log('popup_closed_without_callback');
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
        log('login_callback_fired', {
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

// Races `sessionPromise` against a short, dedicated grace window that
// starts NOW (login already succeeded) — not against SESSION_TIMEOUT_MS,
// which would keep waiting minutes for something that either arrives in
// a couple of seconds or was never coming. Cancels the underlying
// listener if the short grace window wins, so it doesn't linger.
function waitForSessionAfterLogin(
  session: { promise: Promise<EmbeddedSignupSession>; cancel: () => void },
  correlationId: string,
): Promise<EmbeddedSignupSession> {
  return new Promise<EmbeddedSignupSession>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      session.cancel();
      reject(new EmbeddedSignupError('EMBEDDED_SIGNUP_NO_SESSION_INFO', correlationId));
    }, POST_LOGIN_SESSION_GRACE_MS);

    session.promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function launchWhatsAppEmbeddedSignup(options: { coexistence: boolean }): Promise<EmbeddedSignupResult> {
  const correlationId = createCorrelationId();
  const log = createSignupLogger(correlationId);
  const startedAt = Date.now();

  // Meta's SDK rejects FB.login from non-HTTPS pages ("FB.login can no
  // longer be called from http pages"). Fail fast with a clear reason
  // instead of letting the SDK throw its own error mid-flow — this also
  // covers plain http://localhost, which is never valid for this call.
  if (typeof window !== 'undefined' && window.location.protocol !== 'https:') {
    throw new EmbeddedSignupError('WHATSAPP_EMBEDDED_SIGNUP_REQUIRES_HTTPS', correlationId);
  }

  if (!env.metaAppId || !env.metaWhatsappConfigId) {
    throw new EmbeddedSignupError('WHATSAPP_EMBEDDED_SIGNUP_NOT_CONFIGURED', correlationId);
  }

  await loadFacebookSdk(log);
  if (!window.FB) throw new EmbeddedSignupError('EMBEDDED_SIGNUP_SDK_UNAVAILABLE', correlationId);

  const session = listenForEmbeddedSignupSession(SESSION_TIMEOUT_MS, log);

  let code: string;
  try {
    code = await runFacebookLogin(options, log);
  } catch (error) {
    // The login step failed/cancelled/timed out — there is nothing left
    // to wait for, so stop listening immediately instead of leaking the
    // message listener until its own timeout fires later.
    session.cancel();
    const errorCode = error instanceof Error ? error.message : 'EMBEDDED_SIGNUP_ERROR';
    throw new EmbeddedSignupError(errorCode, correlationId);
  }
  session.state.hasCode = true;

  // Exactly the diagnostic the production incident was missing: the
  // state of the coordinator the instant login succeeds, before waiting
  // on anything else.
  log('post_login_state', {
    hasCode: session.state.hasCode,
    hasSessionInfo: session.state.hasSessionInfo,
    lastEmbeddedSignupEvent: session.state.lastEmbeddedSignupEvent,
    elapsedMs: Date.now() - startedAt,
  });

  let sessionData: EmbeddedSignupSession;
  try {
    sessionData = await waitForSessionAfterLogin(session, correlationId);
  } catch (error) {
    if (error instanceof EmbeddedSignupError) throw error;
    const errorCode = error instanceof Error ? error.message : 'EMBEDDED_SIGNUP_ERROR';
    throw new EmbeddedSignupError(errorCode, correlationId);
  }

  log('session_data_received', {
    hasWabaId: Boolean(sessionData.wabaId),
    hasPhoneNumberId: Boolean(sessionData.phoneNumberId),
    elapsedMs: Date.now() - startedAt,
  });

  return { code, session: sessionData };
}
