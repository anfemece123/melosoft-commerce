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
// every WhatsApp Business Solution Provider — but should be confirmed
// against the live App Dashboard once the Configuration ID exists,
// since Meta's own implementation docs were not fully retrievable while
// writing this.

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

let sdkLoadPromise: Promise<void> | null = null;

function loadFacebookSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    if (window.FB) {
      resolve();
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: env.metaAppId ?? '', xfbml: false, version: GRAPH_SDK_VERSION });
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de Meta.'));
    document.body.appendChild(script);
  });

  return sdkLoadPromise;
}

function listenForEmbeddedSignupSession(timeoutMs: number): Promise<EmbeddedSignupSession> {
  return new Promise<EmbeddedSignupSession>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', handleMessage);
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

    function handleMessage(event: MessageEvent) {
      if (typeof event.origin !== 'string' || !event.origin.endsWith('facebook.com')) return;

      let parsed: { type?: string; event?: string; data?: Record<string, unknown> } | null = null;
      try {
        parsed = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as typeof parsed);
      } catch {
        return;
      }
      if (!parsed || parsed.type !== 'WA_EMBEDDED_SIGNUP') return;

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
    }

    window.addEventListener('message', handleMessage);
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

  const sessionPromise = listenForEmbeddedSignupSession(5 * 60 * 1000);

  const code = await new Promise<string>((resolve, reject) => {
    window.FB?.login(
      (response) => {
        if (response.authResponse?.code) {
          resolve(response.authResponse.code);
        } else {
          reject(new Error('EMBEDDED_SIGNUP_CANCELLED'));
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

  const session = await sessionPromise;
  return { code, session };
}
