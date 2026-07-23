// Edge Function: send-whatsapp-notification
//
// Worker for the whatsapp_notifications queue (migration 094). Claims a
// batch of due rows (claim_pending_whatsapp_notifications — atomic,
// FOR UPDATE SKIP LOCKED) and, for each one, builds the WhatsApp Cloud
// API template payload fresh from the order's *current* state and sends
// it through THAT ROW'S OWN STORE'S connected number.
//
// Modelo B (migration 096): there is no global Meta credential anymore.
// Per claimed row, this function calls get_store_whatsapp_send_context
// (SECURITY DEFINER, service_role-only — see 096) to fetch that specific
// store's phone_number_id and access token from Vault. Every Meta call
// below therefore always targets /{that store's phone_number_id}/messages
// — never any other store's number, and never a Melosoft-wide fallback.
// A store with no connection, or a connection whose template isn't
// approved, gets its notification marked 'blocked' — it is never sent
// from any other store's or Melosoft's own number.
//
// Why template_params is built HERE and not by the orders trigger that
// enqueues the row: order_items for a brand-new order may not exist yet
// at the instant the row is enqueued (create_store_order inserts
// order_items in statements after the orders INSERT; wompi-webhook does
// it in a separate REST call after its own orders INSERT). By the time
// this function claims a row — driven by pg_cron on a fixed interval,
// never faster than the order's own transaction — everything the order
// needs has always been committed.
//
// Invocation: intended to run on a schedule (pg_cron + pg_net, or any
// external scheduler) hitting this endpoint with the Supabase
// service_role key as the bearer token. Only service_role may call it —
// checked explicitly below, not just "any valid Supabase JWT" — because
// claim_pending_whatsapp_notifications and every notification row are
// invisible to every other role by RLS anyway, but this function also
// reads customer PII (phone, name, address) and, per store, a real
// access token that must never be reachable by a plain authenticated
// user's token.
//
// Register the cron job manually (see the deployment report) — this
// migration set intentionally does not embed pg_cron/pg_net wiring
// inside a migration file, since that would require a shared secret
// baked into a checked-in SQL file.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveWhatsappTemplateSelection } from '../_shared/whatsappTemplateSelection.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Fallback only — always prefer setting META_GRAPH_API_VERSION as a
// Supabase secret. Re-verify this default against the official sources
// listed in docs/whatsapp/deployment.md before every deploy.
const DEFAULT_GRAPH_API_VERSION = 'v25.0';

const RETRY_BASE_SECONDS = 30;
const RETRY_MAX_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 15_000;

interface WhatsappNotificationRow {
  id: string;
  store_id: string;
  order_id: string | null;
  event_type: string;
  recipient_phone: string;
  template_name: string;
  template_language: string;
  attempts: number;
  max_attempts: number;
}

// Shape of get_store_whatsapp_send_context's return value (migration 096).
type SendContext =
  | { connected: false }
  | {
      connected: true;
      phone_number_id: string;
      access_token: string;
      template_name: string;
      template_language: string;
      template_status: string;
    };

// 'ambiguous' is distinct from 'recoverable': it means we genuinely do
// not know whether Meta received and is processing the message (our own
// timeout fired while waiting for a response) — see sendTemplateMessage
// and the main loop below for how it's handled differently (no
// auto-retry, dead-lettered for manual review instead).
interface ClassifiedError {
  category: 'recoverable' | 'permanent' | 'config' | 'ambiguous';
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

function sanitizeTemplateParam(value: string, maxLen = 300): string {
  const collapsed = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  if (collapsed.length <= maxLen) return collapsed || '-';
  return collapsed.slice(0, maxLen - 1).trimEnd() + '…';
}

function formatCurrencyCOP(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? 'COP'} ${Math.round(amount).toLocaleString('es-CO')}`;
  }
}

function paymentMethodLabel(paymentMethod: string): string {
  return paymentMethod === 'online' ? 'Pago en línea' : 'Pago contraentrega';
}

function deliveryLabel(order: {
  fulfillment_method: string;
  city: string | null;
  department: string | null;
  shipping_address: string | null;
}): string {
  switch (order.fulfillment_method) {
    case 'pickup':
      return 'Recoge en tienda';
    case 'national_shipping':
      return `Envío nacional${order.city ? ` a ${order.city}` : ''}${order.department ? `, ${order.department}` : ''}`;
    case 'local_delivery':
    case 'delivery':
    default:
      return `Domicilio${order.city ? ` a ${order.city}` : ''}${order.shipping_address ? ` — ${order.shipping_address}` : ''}`;
  }
}

interface OrderItemRow {
  name: string;
  quantity: number;
  variant_label_snapshot: string | null;
}

function buildItemsSummary(items: OrderItemRow[]): string {
  if (items.length === 0) return 'Ver detalle en tu pedido';
  const shown = items.slice(0, 3);
  const rest = items.length - shown.length;
  const parts = shown.map((i) => {
    const variant = i.variant_label_snapshot ? ` (${i.variant_label_snapshot})` : '';
    return `${i.quantity}x ${i.name}${variant}`;
  });
  if (rest > 0) parts.push(`+${rest} más`);
  return sanitizeTemplateParam(parts.join(', '), 200);
}

async function sendTemplateMessage(params: {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
  to: string;
  templateName: string;
  templateLanguage: string;
  bodyParams: string[];
}): Promise<{ ok: true; providerMessageId: string } | { ok: false; error: ClassifiedError }> {
  const url = `https://graph.facebook.com/${params.graphApiVersion}/${params.phoneNumberId}/messages`;

  // Meta's current guidance (developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers,
  // verified 2026-07): always send the leading '+' with the country calling
  // code. Omitting it lets Meta prepend the sending number's own country
  // code to an ambiguous local number, which can misdeliver the message.
  // `params.to` is already E.164 (leading '+') from normalize_whatsapp_phone.
  const payload = {
    messaging_product: 'whatsapp',
    to: params.to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.templateLanguage },
      components: [
        {
          type: 'body',
          parameters: params.bodyParams.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const bodyJson = await response.json().catch(() => ({}));

    if (response.ok) {
      const messageId = bodyJson?.messages?.[0]?.id;
      if (!messageId) {
        return { ok: false, error: { category: 'recoverable', code: 'NO_MESSAGE_ID', message: 'Respuesta de Meta sin id de mensaje' } };
      }
      return { ok: true, providerMessageId: messageId };
    }

    return { ok: false, error: classifyMetaError(response.status, response.headers, bodyJson) };
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === 'AbortError';

    if (isAbort) {
      // Our own FETCH_TIMEOUT_MS elapsed while waiting for Meta's
      // response — the POST may have been fully transmitted and be
      // processing on Meta's side, or may never have arrived. Fetch
      // gives no way to tell those apart, and Meta's Cloud API has no
      // documented send-side idempotency key (see docs/whatsapp/
      // deployment.md's "Garantías reales" section) to safely retry
      // against. Marked 'ambiguous', not 'recoverable': the caller does
      // NOT auto-retry this — it dead-letters for manual review instead,
      // because a blind retry here risks a real duplicate WhatsApp
      // message to the customer.
      return {
        ok: false,
        error: { category: 'ambiguous', code: 'TIMEOUT', message: 'Tiempo de espera agotado esperando respuesta de Meta' },
      };
    }

    // Any other fetch rejection (DNS failure, connection refused, TLS
    // error) — the common case never reached Meta at all, so this stays
    // 'recoverable' (safe to retry with backoff). This is a judgment
    // call, not a certainty: fetch's error surface doesn't distinguish
    // "never connected" from "connection reset after the request was
    // sent", so a rare true ambiguous case can still be classified here
    // instead of as 'ambiguous' above. Documented as a residual risk in
    // docs/whatsapp/deployment.md rather than papered over.
    return {
      ok: false,
      error: { category: 'recoverable', code: 'NETWORK_ERROR', message: 'Error de red al llamar a Meta' },
    };
  }
}

function classifyMetaError(status: number, headers: Headers, body: Record<string, unknown>): ClassifiedError {
  const retryAfterHeader = headers.get('retry-after');
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;

  const errObj = (body?.error ?? {}) as { code?: number; message?: string; type?: string };
  const code = errObj.code != null ? String(errObj.code) : String(status);
  const message = sanitizeTemplateParam(errObj.message ?? `HTTP ${status}`, 200);

  if (status === 429) {
    return { category: 'recoverable', code, message, retryAfterSeconds: retryAfterSeconds ?? undefined };
  }
  if (status >= 500) {
    return { category: 'recoverable', code, message };
  }
  if (status === 401 || errObj.code === 190 || errObj.code === 10 || errObj.code === 3) {
    return { category: 'config', code, message };
  }
  // Meta's own rate-limit-ish subcodes surfaced as 4xx.
  if (errObj.code === 131056 || errObj.code === 80007) {
    return { category: 'recoverable', code, message };
  }
  // Everything else 4xx: treat as permanent (bad phone, bad template,
  // template not approved, param mismatch, policy violation) — safe
  // default, avoids burning retries on something that will never succeed.
  return { category: 'permanent', code, message };
}

function computeBackoffSeconds(attempts: number, retryAfterSeconds?: number): number {
  const exponential = Math.min(RETRY_BASE_SECONDS * 2 ** Math.max(attempts - 1, 0), RETRY_MAX_SECONDS);
  const jitter = Math.random() * 5;
  const computed = exponential + jitter;
  if (retryAfterSeconds && retryAfterSeconds > computed) return retryAfterSeconds;
  return computed;
}

// Same convention as whatsapp-webhook's signature check — both inputs
// here are the service_role key, so a naive `!==` leaks byte-by-byte
// timing information an attacker probing this endpoint could use.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Only the service_role key, sent as a well-formed Bearer header, may
  // invoke this function — it reads customer PII across every store and
  // dispatches real WhatsApp messages. A plain authenticated user's JWT
  // (even a store owner's) must not pass this check, and neither may a
  // token supplied via the body or query string — only the
  // Authorization header is ever read.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceRoleKey) {
    console.error('[send-whatsapp-notification] rejected: SUPABASE_SERVICE_ROLE_KEY not configured');
    return json({ error: 'Unauthorized' }, 401);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const providedToken = authHeader.slice('Bearer '.length);

  if (!providedToken || !timingSafeEqual(providedToken, serviceRoleKey)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const graphApiVersion = Deno.env.get('META_GRAPH_API_VERSION') || DEFAULT_GRAPH_API_VERSION;

  let body: { limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — batch mode with default limit.
  }
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
  );

  // Builds the positional {{1}}..{{9}} params for melosoft_order_confirmation_v1
  // — see docs/whatsapp/templates.md for the exact template body these map
  // to. Defined here as a closure over `supabase` (rather than taking it as
  // a typed parameter) for the same reason create-wompi-payment's
  // validateAndPriceModifiers does — see that function's comment:
  // supabase-js's overloaded `createClient` makes a standalone
  // `SupabaseClient<...>` parameter type resolve to a different generic
  // instantiation than this call site's, which breaks inference on every
  // `.from(...).select(...)` inside it.
  async function buildOrderReceivedParams(
    notification: WhatsappNotificationRow,
  ): Promise<string[] | { error: string }> {
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total_amount, currency, payment_method, fulfillment_method, city, department, shipping_address, status')
      .eq('id', notification.order_id)
      .single();
    if (orderErr || !order) return { error: 'ORDER_NOT_FOUND' };

    const { data: store } = await supabase
      .from('stores')
      .select('name')
      .eq('id', notification.store_id)
      .single();

    const { data: settings } = await supabase
      .from('store_whatsapp_settings')
      .select('final_message')
      .eq('store_id', notification.store_id)
      .maybeSingle();

    const { data: items } = await supabase
      .from('order_items')
      .select('name, quantity, variant_label_snapshot')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    const finalMessage = (settings?.final_message ?? '').trim() || '¡Gracias por tu compra!';

    return [
      sanitizeTemplateParam(order.customer_name, 60),
      sanitizeTemplateParam(store?.name ?? 'la tienda', 60),
      sanitizeTemplateParam(order.order_number ?? order.id.slice(0, 8).toUpperCase(), 30),
      buildItemsSummary((items ?? []) as OrderItemRow[]),
      sanitizeTemplateParam(formatCurrencyCOP(Number(order.total_amount), order.currency), 30),
      sanitizeTemplateParam(paymentMethodLabel(order.payment_method), 40),
      sanitizeTemplateParam(deliveryLabel(order), 120),
      'Recibido',
      sanitizeTemplateParam(finalMessage, 150),
    ];
  }

  const { data: claimed, error: claimErr } = await supabase.rpc('claim_pending_whatsapp_notifications', {
    p_limit: limit,
    p_worker_id: `edge-${crypto.randomUUID().slice(0, 8)}`,
  });

  if (claimErr) {
    console.error('[send-whatsapp-notification] claim failed:', claimErr.message);
    return json({ error: 'Failed to claim notifications' }, 500);
  }

  const rows = (claimed ?? []) as WhatsappNotificationRow[];
  let sent = 0;
  let failed = 0;
  let retried = 0;
  let ambiguous = 0;
  let blocked = 0;

  for (const notification of rows) {
    const nowIso = new Date().toISOString();

    // ── Per-store connection lookup — this is the entire Modelo B
    //    boundary. A row for store A can never touch store B's token or
    //    phone_number_id: this call only ever asks for notification.store_id,
    //    the value already fixed on the row by the trigger that enqueued
    //    it (migration 094), never something this function chooses.
    const { data: contextData, error: contextErr } = await supabase.rpc('get_store_whatsapp_send_context', {
      p_store_id: notification.store_id,
    });
    if (contextErr) {
      console.error('[send-whatsapp-notification] send-context lookup failed:', contextErr.message);
      // Internal error, not the store's fault — leave it queued for the
      // next run rather than blocking it permanently.
      await supabase.from('whatsapp_notifications').update({
        status: 'queued',
        locked_at: null,
        locked_by: null,
      }).eq('id', notification.id);
      continue;
    }
    const context = contextData as SendContext;

    if (!context.connected) {
      // No usable connection for this store — never fall back to
      // Melosoft's own number or any other store's. Terminal: this
      // specific notification for this specific (already-placed) order
      // will not retroactively un-block itself if the store connects
      // later — a fresh order after connecting gets a fresh, sendable
      // notification instead.
      await supabase.from('whatsapp_notifications').update({
        status: 'blocked',
        is_permanent_failure: false,
        failed_at: nowIso,
        locked_at: null,
        locked_by: null,
        last_error_category: 'not_connected',
        last_error_code: 'STORE_NOT_CONNECTED',
        last_error_message: 'La tienda no tiene un número de WhatsApp conectado.',
      }).eq('id', notification.id);
      blocked++;
      continue;
    }

    if (context.template_status !== 'approved') {
      await supabase.from('whatsapp_notifications').update({
        status: 'blocked',
        is_permanent_failure: false,
        failed_at: nowIso,
        locked_at: null,
        locked_by: null,
        last_error_category: 'template_not_approved',
        last_error_code: 'TEMPLATE_NOT_APPROVED',
        last_error_message: 'La plantilla de WhatsApp de esta tienda todavía no está aprobada por Meta.',
      }).eq('id', notification.id);
      blocked++;
      continue;
    }

    let bodyParams: string[];

    if (notification.event_type === 'test_message') {
      bodyParams = ['Melosoft Commerce'];
    } else {
      const result = await buildOrderReceivedParams(notification);
      if ('error' in result) {
        await supabase.from('whatsapp_notifications').update({
          status: 'failed',
          is_permanent_failure: true,
          last_error_category: 'permanent',
          last_error_code: result.error,
          last_error_message: 'No se encontró el pedido asociado a esta notificación.',
          failed_at: nowIso,
        }).eq('id', notification.id);
        failed++;
        continue;
      }
      bodyParams = result;
    }

    const template = resolveWhatsappTemplateSelection(
      notification.event_type,
      notification.template_name,
      notification.template_language,
      context.template_name,
      context.template_language,
    );

    const sendResult = await sendTemplateMessage({
      accessToken: context.access_token,
      phoneNumberId: context.phone_number_id,
      graphApiVersion,
      to: notification.recipient_phone,
      templateName: template.name,
      templateLanguage: template.language,
      bodyParams,
    });

    if (sendResult.ok) {
      await supabase.from('whatsapp_notifications').update({
        status: 'sent',
        provider_message_id: sendResult.providerMessageId,
        template_params: bodyParams,
        sent_at: nowIso,
        locked_at: null,
        locked_by: null,
        last_error_category: null,
        last_error_code: null,
        last_error_message: null,
      }).eq('id', notification.id);
      sent++;
      continue;
    }

    const { category, code, message, retryAfterSeconds } = sendResult.error;
    const exhausted = notification.attempts >= notification.max_attempts;

    if (category === 'recoverable' && !exhausted) {
      const backoff = computeBackoffSeconds(notification.attempts, retryAfterSeconds);
      await supabase.from('whatsapp_notifications').update({
        status: 'queued',
        next_attempt_at: new Date(Date.now() + backoff * 1000).toISOString(),
        locked_at: null,
        locked_by: null,
        last_error_category: category,
        last_error_code: code,
        last_error_message: message,
        template_params: bodyParams,
      }).eq('id', notification.id);
      retried++;
      continue;
    }

    // Permanent, config error, ambiguous outcome, or retries exhausted —
    // dead-letter (stops further automatic processing either way).
    // is_permanent_failure is deliberately NOT set for 'ambiguous': we
    // don't know that it failed, only that we can't safely retry it
    // automatically — a human checking Meta's own message log is the
    // next step, not an automatic assumption either way. 'recoverable'
    // only reaches here when attempts are exhausted, which genuinely is
    // a permanent give-up.
    await supabase.from('whatsapp_notifications').update({
      status: 'failed',
      is_permanent_failure: category === 'permanent' || category === 'config' || exhausted,
      failed_at: nowIso,
      locked_at: null,
      locked_by: null,
      last_error_category: category,
      last_error_code: code,
      last_error_message: category === 'ambiguous'
        ? 'Resultado incierto: no se pudo confirmar si Meta recibió el mensaje. Requiere revisión manual antes de reintentar.'
        : message,
      template_params: bodyParams,
    }).eq('id', notification.id);
    failed++;
    if (category === 'ambiguous') ambiguous++;

    // 'config' from classifyMetaError means Meta rejected the CREDENTIAL
    // itself (401, or subcode 190/10/3 — expired/invalid/insufficient-
    // scope token), not this particular message. That is a signal about
    // the STORE's connection, not just this one notification — flag it
    // so the owner sees "requiere atención" instead of only a failed
    // history row, and so no further notification for this store is
    // even attempted against a token we already know Meta just rejected.
    if (category === 'config') {
      const { error: attnErr } = await supabase.rpc('store_whatsapp_connection_mark_requires_attention', {
        p_store_id: notification.store_id,
        p_error_code: code,
        p_error_message: message,
      });
      if (attnErr) {
        console.error('[send-whatsapp-notification] failed to flag connection requires_attention:', attnErr.message);
      }
    }
  }

  // attempts > 1 on any row this run touched is a lightweight, always-on
  // indicator of retries happening — surfaced in the response for
  // whoever/whatever invokes this on a schedule to log or alert on, and
  // in the admin history table (WhatsappSettingsPage) per notification.
  const retriedRows = rows.filter((r) => r.attempts > 1).length;

  return json({ claimed: rows.length, sent, failed, retried, ambiguous, blocked, attempts_gt_1: retriedRows });
});
