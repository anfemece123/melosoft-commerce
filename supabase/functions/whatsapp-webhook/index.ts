// Edge Function: whatsapp-webhook
//
// Meta WhatsApp Cloud API webhook endpoint — MULTI-TENANT (Modelo B,
// migration 096). Every connected store's WABA gets subscribed to this
// SAME Melosoft app during Embedded Signup (see
// whatsapp-embedded-signup's "subscribe app to WABA" step), so Meta
// delivers ALL stores' events to this one endpoint, tagged per event
// with the sending WABA (`entry[].id`) and phone number
// (`value.metadata.phone_number_id`). There is still exactly one App
// Secret (Melosoft's own — signature verification below is unchanged
// and NOT per-store), but every event must be resolved to the correct
// store before it touches any data.
//
// Resolution: status events (value.statuses) are matched to a specific
// whatsapp_notifications row by provider_message_id — Meta's own
// message id (wamid), globally unique regardless of which store's
// number sent it. This is stronger than resolving by phone_number_id
// (a row's own store_id, fixed at enqueue time, is never re-derived
// from anything in the webhook payload), so no store_id from the
// request is ever trusted. phone_number_id/waba_id from the payload are
// still extracted and logged per event for auditability and to satisfy
// defense-in-depth observability — but are never used to decide WHICH
// row gets updated, only logged alongside it. See apply_whatsapp_status_
// event's own header comment (migration 094, extended by 096's
// 'blocked' status) for the update rules themselves.
//
// Handles:
//   - GET  — subscription verification (hub.mode/hub.verify_token/hub.challenge)
//   - POST — message status callbacks (sent/delivered/read/failed), matched
//            back to whatsapp_notifications by provider_message_id.
//
// Security:
//   - POST requests are validated against META_WHATSAPP_APP_SECRET using
//     Meta's X-Hub-Signature-256 header (HMAC-SHA256 over the raw body).
//     FAILS CLOSED — same convention as wompi-webhook: no signature or a
//     mismatch is rejected (401) before any DB write, regardless of the
//     verify token used for GET.
//   - Uses service_role — bypasses RLS for status updates.
//   - Idempotent per event, and never mixes events between stores — see
//     apply_whatsapp_status_event, which only ever touches the single
//     row matching that event's own provider_message_id.
//
// Incoming customer messages (value.messages, as opposed to
// value.statuses) are explicitly out of scope for this phase — this
// endpoint only drives outbound transactional notifications. They are
// acknowledged (200) and dropped without being read or stored, so Meta
// never retries them and no customer-authored text is persisted.
//
// Register this ONE URL in the Meta App Dashboard → WhatsApp →
// Configuration (once, for the Melosoft app — not per store):
//   https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook
// Subscribe to the "messages" webhook field only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: CORS_HEADERS });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface MetaStatusEvent {
  id: string;
  status: string;
  timestamp?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expectedToken = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN') ?? '';

    if (mode === 'subscribe' && expectedToken && token === expectedToken && challenge) {
      return textResponse(challenge, 200);
    }
    return textResponse('Forbidden', 403);
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const rawBody = await req.text();
  const appSecret = Deno.env.get('META_WHATSAPP_APP_SECRET') ?? '';
  const signatureHeader = req.headers.get('x-hub-signature-256') ?? '';

  if (!appSecret) {
    console.error('[whatsapp-webhook] rejected: META_WHATSAPP_APP_SECRET not configured');
    return json({ error: 'Webhook signature verification is not configured' }, 401);
  }
  if (!signatureHeader.startsWith('sha256=')) {
    console.error('[whatsapp-webhook] rejected: missing or malformed X-Hub-Signature-256');
    return json({ error: 'Missing signature' }, 401);
  }

  const providedSignature = signatureHeader.slice('sha256='.length);
  const expectedSignature = await hmacSha256Hex(appSecret, rawBody);

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    console.error('[whatsapp-webhook] rejected: signature mismatch');
    return json({ error: 'Invalid signature' }, 401);
  }

  let payload: {
    entry?: Array<{
      id?: string; // WABA id
      changes?: Array<{
        field?: string;
        value?: { statuses?: MetaStatusEvent[]; messages?: unknown[]; metadata?: { phone_number_id?: string } };
      }>;
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Each event is kept paired with the waba_id/phone_number_id it
  // arrived tagged with — logged per event below, never used to choose
  // which row to update (see header comment).
  const statusEvents: Array<{ event: MetaStatusEvent; wabaId: string | null; phoneNumberId: string | null }> = [];
  let hadIncomingMessages = false;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.field !== 'messages') continue;
      for (const statusEvent of change.value?.statuses ?? []) {
        statusEvents.push({
          event: statusEvent,
          wabaId: entry.id ?? null,
          phoneNumberId: change.value?.metadata?.phone_number_id ?? null,
        });
      }
      // Incoming customer messages: out of scope (see header comment).
      // Not read, not stored — only counted for observability.
      if (change.value?.messages?.length) hadIncomingMessages = true;
    }
  }

  // The transition rules themselves (what can follow what) live in
  // apply_whatsapp_status_event (migration 094, section 10) — this loop
  // just extracts each event and calls it. Moving the state machine into
  // Postgres means it runs under a row lock (SELECT ... FOR UPDATE
  // inside that function), so two webhook deliveries for the same
  // provider_message_id arriving concurrently serialize instead of
  // racing on a read-then-write, and the same rules are directly
  // testable from SQL without a live webhook call.
  for (const { event, wabaId, phoneNumberId } of statusEvents) {
    if (!event.id || !event.status) continue;

    const firstError = event.errors?.[0];
    const errorCode = firstError?.code != null ? String(firstError.code) : null;
    const errorMessage = firstError
      ? (firstError.title ?? firstError.message ?? 'Fallo reportado por WhatsApp').slice(0, 300)
      : null;

    const { data: applyResult, error: rpcErr } = await supabase.rpc('apply_whatsapp_status_event', {
      p_provider_message_id: event.id,
      p_new_status:           event.status,
      p_error_code:           errorCode,
      p_error_message:        errorMessage,
    });

    if (rpcErr) {
      // Log and continue with the next event — one bad event must not
      // fail the whole batch or cause Meta to retry events already
      // applied successfully.
      console.error('[whatsapp-webhook] apply_whatsapp_status_event failed:', rpcErr.message, 'waba=', wabaId, 'phone_number_id=', phoneNumberId);
      continue;
    }

    // Observability only, per event — never gates the update above.
    // 'not_found' here just means this event doesn't correspond to any
    // notification row (e.g. a status for a message this project never
    // sent, or already-cleaned-up history) — expected and harmless.
    const result = applyResult as { matched: boolean; applied: boolean; reason?: string } | null;
    if (result && !result.matched) {
      console.log(`[whatsapp-webhook] event unmatched (${result.reason}): waba=${wabaId}, phone_number_id=${phoneNumberId}, status=${event.status}`);
    }
  }

  return json({ received: true, statuses_processed: statusEvents.length, had_incoming_messages: hadIncomingMessages });
});
