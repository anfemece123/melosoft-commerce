// Edge Function: whatsapp-phone-register
//
// Completes the required Cloud API registration step for a store's
// already-authorized phone number. The common path is zero-touch: a PIN
// is generated server-side, accepted by Meta, and saved only in Vault.
// If the phone already has two-step verification, the owner/admin can
// submit that existing six-digit PIN once; it is never logged or exposed
// back to the browser.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders as corsHeaders } from '../_shared/allowedOrigins.ts';
import {
  buildMetaPhoneRegistrationDiagnostic,
  generateWhatsappRegistrationPin,
  isValidWhatsappRegistrationPin,
  registerWhatsappPhone,
  registrationRequiresExistingPin,
} from '../_shared/whatsappPhoneRegistration.ts';

const DEFAULT_GRAPH_API_VERSION = 'v25.0';

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

interface RegistrationRequest {
  storeId?: string;
  pin?: string;
}

interface RegistrationContext {
  connected?: boolean;
  phone_number_id?: string;
  registration_status?: string;
  registration_pin?: string;
  access_token?: string;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const graphApiVersion = Deno.env.get('META_GRAPH_API_VERSION') || DEFAULT_GRAPH_API_VERSION;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server misconfiguration' }, 500, cors);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401, cors);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !user) return json({ error: 'Unauthorized' }, 401, cors);

  let payload: RegistrationRequest;
  try {
    payload = await req.json() as RegistrationRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors);
  }

  const storeId = typeof payload.storeId === 'string' ? payload.storeId.trim() : '';
  const suppliedPin = typeof payload.pin === 'string' ? payload.pin.trim() : null;
  if (!storeId) return json({ error: 'Missing required field: storeId' }, 400, cors);
  if (suppliedPin !== null && !isValidWhatsappRegistrationPin(suppliedPin)) {
    return json({
      error: 'INVALID_REGISTRATION_PIN',
      message: 'El PIN debe contener exactamente seis números.',
    }, 400, cors);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: membership, error: membershipError } = await adminClient
    .from('store_members')
    .select('role, status')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError) {
    console.error('[whatsapp-phone-register] membership lookup failed:', membershipError.message);
    return json({ error: 'Internal error' }, 500, cors);
  }
  if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
    return json({ error: 'Forbidden' }, 403, cors);
  }

  const { data: rawContext, error: contextError } = await adminClient.rpc(
    'get_store_whatsapp_registration_context',
    { p_store_id: storeId },
  );
  if (contextError) {
    console.error('[whatsapp-phone-register] context lookup failed:', contextError.message);
    return json({ error: 'REGISTRATION_CONTEXT_FAILED' }, 500, cors);
  }

  const context = (rawContext ?? {}) as RegistrationContext;
  if (!context.connected || !context.phone_number_id || !context.access_token) {
    return json({
      error: 'WHATSAPP_NOT_CONNECTED',
      message: 'Conecta el número con Meta antes de registrarlo.',
    }, 409, cors);
  }
  if (context.registration_status === 'registered' && suppliedPin === null) {
    return json({ ok: true, registrationStatus: 'registered', alreadyRegistered: true }, 200, cors);
  }

  await adminClient.rpc('store_whatsapp_registration_mark', {
    p_store_id: storeId,
    p_status: 'registering',
    p_registration_pin: null,
    p_error_code: null,
    p_error_message: null,
    p_actor_user_id: user.id,
  });

  const storedPin = typeof context.registration_pin === 'string' && isValidWhatsappRegistrationPin(context.registration_pin)
    ? context.registration_pin
    : null;
  const pin = suppliedPin ?? storedPin ?? generateWhatsappRegistrationPin();
  const result = await registerWhatsappPhone({
    graphApiVersion,
    phoneNumberId: context.phone_number_id,
    accessToken: context.access_token,
    pin,
  });

  if (result.ok) {
    const { error: markError } = await adminClient.rpc('store_whatsapp_registration_mark', {
      p_store_id: storeId,
      p_status: 'registered',
      p_registration_pin: pin,
      p_error_code: null,
      p_error_message: null,
      p_actor_user_id: user.id,
    });
    if (markError) {
      console.error('[whatsapp-phone-register] secure registration save failed:', markError.message);
      return json({ error: 'REGISTRATION_SAVE_FAILED' }, 500, cors);
    }
    return json({ ok: true, registrationStatus: 'registered', alreadyRegistered: false }, 200, cors);
  }

  const diagnostic = buildMetaPhoneRegistrationDiagnostic(result);
  const requiresPin = registrationRequiresExistingPin(diagnostic);
  const registrationStatus = requiresPin ? 'requires_pin' : 'failed';
  const diagnosticCode = diagnostic.metaCode ?? diagnostic.metaSubcode ?? diagnostic.upstreamStatus;
  const errorCode = String(diagnosticCode || 'META_ERROR');
  const errorMessage = diagnostic.metaUserMessage ?? diagnostic.metaMessage ?? 'Meta rechazó el registro del número.';
  await adminClient.rpc('store_whatsapp_registration_mark', {
    p_store_id: storeId,
    p_status: registrationStatus,
    p_registration_pin: null,
    p_error_code: errorCode,
    p_error_message: errorMessage,
    p_actor_user_id: user.id,
  });
  console.error('[whatsapp-phone-register] Meta registration failed:', diagnostic);

  if (requiresPin) {
    return json({
      error: 'WHATSAPP_REGISTRATION_PIN_REQUIRED',
      message: 'Este número ya tiene verificación en dos pasos. Ingresa su PIN actual de seis dígitos.',
      diagnostic,
    }, 409, cors);
  }
  return json({
    error: 'META_PHONE_REGISTRATION_FAILED',
    message: 'Meta no pudo registrar el número para enviar mensajes.',
    diagnostic,
  }, 502, cors);
});
