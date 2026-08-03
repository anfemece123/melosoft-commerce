// Edge Function: whatsapp-embedded-signup
//
// Completes Meta WhatsApp Embedded Signup for one store (Modelo B —
// migration 096). The frontend runs the Facebook JS SDK's FB.login()
// with the Embedded Signup config_id, captures `code` from the login
// callback and, when Meta emits it, `waba_id`/`phone_number_id`/
// `business_id` from the SDK's session-logging postMessage events, then
// POSTs all of that here. If the browser event is missing, this function
// resolves the authorized WABA from the exchanged token's granular scopes.
//
// This function, not the frontend, is the only place that ever talks to
// Meta with META_WHATSAPP_APP_SECRET, and the only place that ever calls
// store_whatsapp_connection_save (the only SQL function that can write
// a real access token to Vault). The frontend never sees a token.
//
// Trust boundary: p_store_id is NEVER taken as authoritative from the
// request body alone — the caller's JWT is verified, then the caller's
// OWN store_members row for that exact store_id is checked (owner/admin
// only) via the service_role client, which bypasses RLS specifically so
// this check is reliable regardless of RLS policy details. A platform
// admin can inspect connection status (see the platform_
// whatsapp_connections_overview view, read elsewhere) but cannot use
// this endpoint to connect a number to a store they don't own/admin —
// per the explicit requirement that platform_admin does not "own" store
// numbers.
//
// IMPORTANT — verify against Meta's live App Dashboard before first use:
// the exact fields returned by the Embedded Signup session-logging
// event, and whether the code-exchange below needs an additional
// "generate long-lived System User token" step for your specific App
// configuration, can only be confirmed once the Embedded Signup
// Configuration (config_id) exists in the Meta App Dashboard — that is
// a manual step outside this code (see docs/whatsapp/deployment.md).
// This implementation follows Meta's documented, stable Embedded Signup
// pattern (code + server-side token exchange via /oauth/access_token),
// used identically by every WhatsApp Business Solution Provider.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders as corsHeaders } from '../_shared/allowedOrigins.ts';
import {
  type MetaDebugTokenData,
  resolveSingleWhatsappWaba,
} from '../_shared/whatsappTokenTargets.ts';
import {
  buildMetaTokenExchangeDiagnostic,
  type MetaOAuthError,
} from '../_shared/metaOAuthDiagnostics.ts';
import { buildMetaEmbeddedSignupTokenUrl } from '../_shared/metaOAuthExchange.ts';
import {
  buildMetaPhoneRegistrationDiagnostic,
  generateWhatsappRegistrationPin,
  getWhatsappCoexistenceStatus,
  isValidWhatsappRegistrationPin,
  registerWhatsappPhone,
  registrationRequiresExistingPin,
} from '../_shared/whatsappPhoneRegistration.ts';
import {
  resolveWhatsappWebhookCallbackUrl,
  subscribeWhatsappWabaWithWebhookOverride,
} from '../_shared/whatsappWebhookSubscription.ts';

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

const DEFAULT_GRAPH_API_VERSION = 'v25.0'; // fallback only — re-verify at deploy time, see docs/whatsapp/deployment.md
const COEXISTENCE_INCOMPLETE_MESSAGE =
  'Meta todavía no confirmó la coexistencia con WhatsApp Business. Vuelve a completar la conexión desde Melosoft y acepta la vinculación en el celular.';

interface OnboardingRequest {
  storeId: string;
  code: string;
  wabaId?: string | null;
  // Optional: Meta's FINISH_ONLY_WABA postMessage event (sent when the
  // WABA already has a verified number registered before running
  // Embedded Signup) carries no phone_number_id — resolved from the
  // WABA's own phone number list below when absent (step 6).
  phoneNumberId?: string | null;
  businessId?: string;
  coexistence?: boolean;
}

interface MetaErrorShape {
  error?: MetaOAuthError;
}

async function metaFetch(url: string): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch {
    clearTimeout(timeout);
    return { ok: false, status: 0, body: {} };
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const metaAppId = Deno.env.get('META_APP_ID') ?? '';
  const metaAppSecret = Deno.env.get('META_WHATSAPP_APP_SECRET') ?? '';
  const webhookVerifyToken = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN') ?? '';
  const graphApiVersion = Deno.env.get('META_GRAPH_API_VERSION') || DEFAULT_GRAPH_API_VERSION;
  const webhookCallbackUrl = resolveWhatsappWebhookCallbackUrl({
    supabaseUrl,
    configuredUrl: Deno.env.get('META_WHATSAPP_WEBHOOK_URL'),
  });

  if (!supabaseUrl || !serviceRoleKey || !anonKey || !metaAppId || !metaAppSecret || !webhookVerifyToken) {
    console.error('[whatsapp-embedded-signup] missing required configuration');
    return json({ error: 'Server misconfiguration' }, 500, cors);
  }

  // ── 1. Verify the caller's JWT ────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401, cors);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerUser) return json({ error: 'Unauthorized' }, 401, cors);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 2. Parse and minimally validate the payload ────────────────
  let payload: OnboardingRequest;
  try {
    payload = await req.json() as OnboardingRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors);
  }

  const { storeId, code, businessId, coexistence } = payload;
  const requestedWabaId = typeof payload.wabaId === 'string' && payload.wabaId.trim()
    ? payload.wabaId.trim()
    : null;
  // phoneNumberId is intentionally NOT required here — see the interface
  // comment above and step 6 below.
  const requestedPhoneNumberId = payload.phoneNumberId || null;
  if (!storeId || !code) {
    return json({ error: 'Missing required fields: storeId, code' }, 400, cors);
  }

  // ── 3. storeId is NEVER trusted alone — verify real ownership ──
  const { data: membership, error: membershipErr } = await adminClient
    .from('store_members')
    .select('role, status')
    .eq('store_id', storeId)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (membershipErr) {
    console.error('[whatsapp-embedded-signup] membership lookup failed:', membershipErr.message);
    return json({ error: 'Internal error' }, 500, cors);
  }
  if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
    return json({ error: 'Forbidden: only the store owner or an admin can connect WhatsApp' }, 403, cors);
  }

  const eventLog = async (eventType: string, detail?: string) => {
    await adminClient.from('store_whatsapp_connection_events').insert({
      store_id: storeId,
      event_type: eventType,
      actor_user_id: callerUser.id,
      detail: detail ?? null,
    });
  };

  await eventLog('connect_started', `onboarding_type=${coexistence ? 'coexistence' : 'unspecified'}`);

  // ── 4. Do not reject a browser-provided phone_number_id as a duplicate
  //      yet. Meta/WhatsApp Business can move or disconnect a number while
  //      our historical row remains present. Only after the OAuth code is
  //      exchanged and Meta proves the WABA↔phone relationship do we have
  //      enough authority to reconcile that stale local claim safely.

  // ── 5. Exchange the temporary code for an access token (server-side
  //      only — this is the one call that needs META_WHATSAPP_APP_SECRET) ──
  const tokenUrl = buildMetaEmbeddedSignupTokenUrl({
    graphApiVersion,
    appId: metaAppId,
    appSecret: metaAppSecret,
    code,
  });

  const tokenResult = await metaFetch(tokenUrl);
  if (!tokenResult.ok || typeof tokenResult.body.access_token !== 'string') {
    const err = (tokenResult.body as MetaErrorShape).error;
    const diagnostic = buildMetaTokenExchangeDiagnostic(tokenResult.status, err);
    console.error('[whatsapp-embedded-signup] token exchange failed:', diagnostic);
    await eventLog(
      'connect_failed',
      `token_exchange_failed code=${diagnostic.metaCode ?? diagnostic.upstreamStatus}` +
        ` subcode=${diagnostic.metaSubcode ?? 'none'}` +
        ` trace_id=${diagnostic.traceId ?? 'none'}`,
    );
    return json({
      error: 'META_TOKEN_EXCHANGE_FAILED',
      message: 'No se pudo completar la conexión con Meta. Intenta de nuevo.',
      diagnostic,
    }, 502, cors);
  }
  const accessToken = tokenResult.body.access_token as string;

  // ── 6. Resolve the WABA if Meta completed OAuth but omitted the
  //      browser-side WA_EMBEDDED_SIGNUP event. /debug_token returns
  //      granular permission targets for this app-issued token. We only
  //      auto-resolve an unambiguous single WhatsApp Business target;
  //      otherwise we fail closed instead of connecting the wrong WABA.
  let wabaId = requestedWabaId;
  if (!wabaId) {
    const appAccessToken = `${metaAppId}|${metaAppSecret}`;
    const debugTokenResult = await metaFetch(
      `https://graph.facebook.com/${graphApiVersion}/debug_token` +
      `?input_token=${encodeURIComponent(accessToken)}` +
      `&access_token=${encodeURIComponent(appAccessToken)}`,
    );
    const debugData = debugTokenResult.body.data as MetaDebugTokenData | undefined;

    if (!debugTokenResult.ok) {
      const err = (debugTokenResult.body as MetaErrorShape).error;
      console.error('[whatsapp-embedded-signup] token introspection failed:', err?.message ?? `HTTP ${debugTokenResult.status}`);
      await eventLog('connect_failed', `token_introspection_failed code=${err?.code ?? debugTokenResult.status}`);
      return json({
        error: 'META_WABA_RESOLUTION_FAILED',
        message: 'Meta autorizó la cuenta, pero no fue posible identificar la cuenta de WhatsApp seleccionada.',
      }, 502, cors);
    }

    const resolution = resolveSingleWhatsappWaba(debugData, metaAppId);
    if (!resolution.ok) {
      console.error(
        '[whatsapp-embedded-signup] WABA token targets could not be resolved:',
        resolution.reason,
        resolution.candidateCount,
      );
      await eventLog(
        'connect_failed',
        `waba_resolution_${resolution.reason} count=${resolution.candidateCount}`,
      );
      return json({
        error: resolution.reason === 'multiple_targets' ? 'MULTIPLE_WABAS_FOUND' : 'META_WABA_RESOLUTION_FAILED',
        message: resolution.reason !== 'multiple_targets'
          ? 'Meta no indicó qué cuenta de WhatsApp fue autorizada. Revisa la configuración de Embedded Signup.'
          : 'Meta autorizó más de una cuenta de WhatsApp y no fue posible determinar cuál seleccionaste.',
      }, 422, cors);
    }

    wabaId = resolution.wabaId;
    await eventLog('waba_auto_resolved', 'source=token_granular_scopes');
  }

  // ── 7. Resolve/verify the phone number for this WABA — never trust
  //      the frontend's phoneNumberId/wabaId blindly. When the frontend
  //      DID send a phoneNumberId (the common FINISH case), verify it
  //      really belongs to this WABA. When it didn't (FINISH_ONLY_WABA —
  //      the WABA already had a verified number before Embedded Signup
  //      ran), resolve it directly from the WABA's own phone number
  //      list: exactly one number is the expected, unambiguous case;
  //      zero or more than one cannot be auto-resolved safely.
  const phoneListResult = await metaFetch(
    `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(wabaId)}/phone_numbers?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!phoneListResult.ok) {
    const err = (phoneListResult.body as MetaErrorShape).error;
    console.error('[whatsapp-embedded-signup] WABA phone list fetch failed:', err?.message ?? `HTTP ${phoneListResult.status}`);
    await eventLog('connect_failed', `waba_verification_failed code=${err?.code ?? phoneListResult.status}`);
    return json({ error: 'META_WABA_VERIFICATION_FAILED', message: 'No se pudo verificar la cuenta de WhatsApp Business con Meta.' }, 502, cors);
  }
  const wabaPhones = (phoneListResult.body.data as Array<{ id: string }> | undefined) ?? [];

  let phoneNumberId: string;
  if (requestedPhoneNumberId) {
    const belongsToWaba = wabaPhones.some((p) => p.id === requestedPhoneNumberId);
    if (!belongsToWaba) {
      console.error('[whatsapp-embedded-signup] phone_number_id does not belong to the claimed waba_id');
      await eventLog('connect_failed', 'phone_number_id_not_in_waba');
      return json({ error: 'PHONE_NOT_IN_WABA', message: 'El número indicado no pertenece a esa cuenta de WhatsApp Business.' }, 422, cors);
    }
    phoneNumberId = requestedPhoneNumberId;
  } else if (wabaPhones.length === 1) {
    phoneNumberId = wabaPhones[0].id;
    await eventLog('phone_auto_resolved', `phone_number_id=${phoneNumberId}`);
  } else if (wabaPhones.length === 0) {
    console.error('[whatsapp-embedded-signup] WABA has no phone numbers to resolve');
    await eventLog('connect_failed', 'no_phone_number_found_in_waba');
    return json({ error: 'NO_PHONE_NUMBER_FOUND', message: 'La cuenta de WhatsApp Business no tiene ningún número registrado.' }, 422, cors);
  } else {
    console.error('[whatsapp-embedded-signup] WABA has multiple phone numbers, cannot auto-resolve');
    await eventLog('connect_failed', `ambiguous_phone_selection count=${wabaPhones.length}`);
    return json({
      error: 'MULTIPLE_PHONE_NUMBERS_FOUND',
      message: 'Esta cuenta de WhatsApp Business tiene más de un número. Selecciona uno específico e intenta de nuevo.',
    }, 422, cors);
  }

  // ── 8. Fetch display name/number for this specific phone ──
  const phoneDetailResult = await metaFetch(
    `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(phoneNumberId)}` +
    `?fields=display_phone_number,verified_name,code_verification_status,platform_type,is_on_biz_app` +
    `&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!phoneDetailResult.ok) {
    const err = (phoneDetailResult.body as MetaErrorShape).error;
    console.error('[whatsapp-embedded-signup] phone detail fetch failed:', err?.message ?? `HTTP ${phoneDetailResult.status}`);
    await eventLog('connect_failed', `phone_detail_fetch_failed code=${err?.code ?? phoneDetailResult.status}`);
    return json({ error: 'META_PHONE_DETAIL_FAILED', message: 'No se pudo obtener el número verificado desde Meta.' }, 502, cors);
  }
  const displayPhoneNumber = (phoneDetailResult.body.display_phone_number as string | undefined) ?? null;
  const verifiedName = (phoneDetailResult.body.verified_name as string | undefined) ?? null;
  const coexistenceStatus = getWhatsappCoexistenceStatus(phoneDetailResult.body);
  // The browser flag selects the requested flow, but it is not proof
  // that Meta completed it. Reject false-positive coexistence before
  // subscribing or persisting anything. A normal OAuth completion must
  // never be stored as WhatsApp Business App coexistence.
  if (coexistence && !coexistenceStatus.ready) {
    await eventLog(
      'connect_failed',
      `coexistence_not_confirmed is_on_biz_app=${coexistenceStatus.isOnBizApp} platform_type=${coexistenceStatus.platformType ?? 'null'}`,
    );
    return json({
      error: 'COEXISTENCE_NOT_AVAILABLE',
      message: 'Meta no confirmó el flujo oficial de coexistencia. El número no fue modificado.',
      coexistenceStatus,
    }, 409, cors);
  }
  // If Meta itself reports is_on_biz_app, protect that number with the
  // coexistence path even if an old or modified client omitted the flag.
  const isCoexistenceFlow = coexistenceStatus.isOnBizApp;

  // ── 9. Subscribe this Commerce WABA with its own callback override.
  //      The app-level callback remains assigned to Melosoft Citas.
  const subscriptionResult = await subscribeWhatsappWabaWithWebhookOverride({
    graphApiVersion,
    wabaId,
    accessToken,
    callbackUrl: webhookCallbackUrl,
    verifyToken: webhookVerifyToken,
  });
  if (!subscriptionResult.ok) {
    const error = (subscriptionResult.body as MetaErrorShape).error;
    console.error(
      '[whatsapp-embedded-signup] Commerce webhook override failed:',
      error?.message ?? subscriptionResult.status,
    );
    await eventLog('connect_failed', `app_subscription_failed status=${subscriptionResult.status}`);
    return json({
      error: 'META_APP_SUBSCRIPTION_FAILED',
      message: 'La conexión con Meta se validó, pero no se pudo configurar el seguimiento de mensajes. Intenta reconectar.',
    }, 502, cors);
  }

  // ── 10. Persist — the only call in this whole function that writes a
  //      real token, via the SECURITY DEFINER function that also
  //      re-checks the phone_number_id uniqueness under the DB's own
  //      UNIQUE index as the final guarantee ──
  const onboardingType = isCoexistenceFlow ? 'coexistence' : 'new_number';

  const { data: rawSaveResult, error: saveErr } = await adminClient.rpc('store_whatsapp_connection_save', {
    p_store_id: storeId,
    p_meta_business_id: businessId ?? null,
    p_waba_id: wabaId,
    p_phone_number_id: phoneNumberId,
    p_display_phone_number: displayPhoneNumber,
    p_verified_name: verifiedName,
    p_onboarding_type: onboardingType,
    p_coexistence_enabled: isCoexistenceFlow,
    p_access_token: accessToken,
    p_connected_by: callerUser.id,
  });

  if (saveErr) {
    const isDuplicate = saveErr.message.includes('PHONE_NUMBER_ALREADY_CONNECTED');
    console.error('[whatsapp-embedded-signup] connection save failed:', saveErr.message);
    return json(
      isDuplicate
        ? { error: 'PHONE_NUMBER_ALREADY_CONNECTED', message: 'Este número de WhatsApp ya está conectado a otra tienda de Melosoft.' }
        : { error: 'CONNECTION_SAVE_FAILED', message: 'No se pudo guardar la conexión.' },
      isDuplicate ? 409 : 500,
      cors,
    );
  }

  const saveResult = rawSaveResult && typeof rawSaveResult === 'object'
    ? rawSaveResult as Record<string, unknown>
    : {};
  const phoneReassigned = saveResult.phone_reassigned === true;
  const transferredRegistrationPin = typeof saveResult.transferred_registration_pin === 'string' &&
      isValidWhatsappRegistrationPin(saveResult.transferred_registration_pin)
    ? saveResult.transferred_registration_pin
    : null;

  // ── 11. Coexistence numbers are already registered in the WhatsApp
  //      Business mobile app. Meta explicitly requires skipping
  //      /register for this flow. The phone is send-ready only when Meta
  //      reports both is_on_biz_app=true and platform_type=CLOUD_API.
  if (isCoexistenceFlow) {
    const registrationStatus = coexistenceStatus.ready ? 'registered' : 'failed';
    const { error: coexistenceSaveError } = await adminClient.rpc('store_whatsapp_registration_mark', {
      p_store_id: storeId,
      p_status: registrationStatus,
      p_registration_pin: null,
      p_error_code: coexistenceStatus.ready ? null : 'COEXISTENCE_ONBOARDING_INCOMPLETE',
      p_error_message: coexistenceStatus.ready ? null : COEXISTENCE_INCOMPLETE_MESSAGE,
      p_actor_user_id: callerUser.id,
    });
    if (coexistenceSaveError) {
      console.error('[whatsapp-embedded-signup] coexistence status save failed:', coexistenceSaveError.message);
      return json({
        error: 'REGISTRATION_SAVE_FAILED',
        message: 'No se pudo guardar el estado de coexistencia del número.',
      }, 500, cors);
    }

    return json({
      ok: true,
      connectionStatus: 'connected',
      registrationStatus,
      displayPhoneNumber,
      verifiedName,
      onboardingType,
      phoneReassigned,
      coexistenceStatus,
    }, 200, cors);
  }

  // New numbers do require explicit Cloud API registration. The common
  // path is automatic: generate a PIN, let Meta accept it, then store it
  // only in Vault. If the number already has a PIN, the UI requests that
  // existing value once.
  await adminClient.rpc('store_whatsapp_registration_mark', {
    p_store_id: storeId,
    p_status: 'registering',
    p_registration_pin: null,
    p_error_code: null,
    p_error_message: null,
    p_actor_user_id: callerUser.id,
  });

  const { data: rawRegistrationContext } = await adminClient.rpc(
    'get_store_whatsapp_registration_context',
    { p_store_id: storeId },
  );
  const storedRegistrationPin = rawRegistrationContext &&
      typeof rawRegistrationContext === 'object' &&
      'registration_pin' in rawRegistrationContext &&
      typeof rawRegistrationContext.registration_pin === 'string' &&
      isValidWhatsappRegistrationPin(rawRegistrationContext.registration_pin)
    ? rawRegistrationContext.registration_pin
    : null;
  const registrationPin = storedRegistrationPin ?? transferredRegistrationPin ?? generateWhatsappRegistrationPin();
  const registrationResult = await registerWhatsappPhone({
    graphApiVersion,
    phoneNumberId,
    accessToken,
    pin: registrationPin,
  });

  let registrationStatus: 'registered' | 'requires_pin' | 'failed';
  if (registrationResult.ok) {
    const { error: registrationSaveError } = await adminClient.rpc('store_whatsapp_registration_mark', {
      p_store_id: storeId,
      p_status: 'registered',
      p_registration_pin: registrationPin,
      p_error_code: null,
      p_error_message: null,
      p_actor_user_id: callerUser.id,
    });
    if (registrationSaveError) {
      console.error('[whatsapp-embedded-signup] registration PIN save failed:', registrationSaveError.message);
      return json({
        error: 'REGISTRATION_SAVE_FAILED',
        message: 'Meta registró el número, pero no se pudo guardar su configuración segura.',
      }, 500, cors);
    }
    registrationStatus = 'registered';
  } else {
    const diagnostic = buildMetaPhoneRegistrationDiagnostic(registrationResult);
    const requiresPin = registrationRequiresExistingPin(diagnostic);
    registrationStatus = requiresPin ? 'requires_pin' : 'failed';
    const diagnosticCode = diagnostic.metaSubcode ?? diagnostic.metaCode ?? diagnostic.upstreamStatus;
    await adminClient.rpc('store_whatsapp_registration_mark', {
      p_store_id: storeId,
      p_status: registrationStatus,
      p_registration_pin: null,
      p_error_code: String(diagnosticCode || 'META_ERROR'),
      p_error_message: diagnostic.metaUserMessage ?? diagnostic.metaMessage ?? 'Meta rechazó el registro del número.',
      p_actor_user_id: callerUser.id,
    });
    console.error('[whatsapp-embedded-signup] phone registration failed:', diagnostic);
  }

  return json({
    ok: true,
    connectionStatus: 'connected',
    registrationStatus,
    displayPhoneNumber,
    verifiedName,
    onboardingType,
    phoneReassigned,
  }, 200, cors);
});
