// Edge Function: wompi-webhook
//
// Receives Wompi payment events (transaction.updated) and:
//   - APPROVED → creates a real order from the checkout_session.items_snapshot,
//                creates order_items, creates payment_transaction, marks session approved
//   - DECLINED / ERROR → marks checkout_session declined/error (no order created)
//
// Security:
//   - Validates the per-store events_secret signature (SHA-256).
//   - FAILS CLOSED: if events_secret is missing, or the signature is
//     absent/invalid, the event is rejected (401) before any DB write
//     that could mark a payment as paid or create an order. A store with
//     no events_secret configured cannot receive webhook-confirmed orders
//     until one is set — this is intentional, not a degraded fallback.
//   - Uses service_role key — bypasses RLS for all DB writes.
//   - Idempotent: if session already has an order_id, skips order creation.
//   - Never trusts client-sent totals — order is built from the locked-in items_snapshot.
//
// Register this URL in the Wompi dashboard:
//   https://<project-ref>.supabase.co/functions/v1/wompi-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison — both inputs are hex SHA-256 digests here, so a
// naive `!==` leaks byte-by-byte timing information an attacker could use to
// forge a valid checksum without knowing events_secret.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Extracts a nested value using dot-notation path.
// Wompi signature properties are listed as e.g. "transaction.id", "transaction.status".
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[part];
  }
  return String(cur ?? '');
}

function mapWompiStatus(wompiStatus: string): string {
  switch (wompiStatus.toUpperCase()) {
    case 'APPROVED': return 'approved';
    case 'DECLINED': return 'declined';
    case 'ERROR':    return 'error';
    case 'VOIDED':   return 'voided';
    default:         return 'pending';
  }
}

interface WompiTransaction {
  id: string;
  reference: string;
  status: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type: string;
  [key: string]: unknown;
}

interface WompiEvent {
  event: string;
  data: { transaction: WompiTransaction };
  signature: { properties: string[]; checksum: string };
  timestamp: number;
  sent_at?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let event: WompiEvent;
  try {
    event = await req.json() as WompiEvent;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Only handle transaction.updated; acknowledge everything else silently.
  if (event.event !== 'transaction.updated') {
    return json({ received: true, skipped: true });
  }

  const transaction = event.data?.transaction;
  if (!transaction?.reference) {
    return json({ error: 'Missing transaction reference' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // ── 1. Look up checkout_session by reference ────────────────
  const { data: session, error: sessionFetchErr } = await supabase
    .from('checkout_sessions')
    .select('*')
    .eq('provider_reference', transaction.reference)
    .maybeSingle();

  if (sessionFetchErr) {
    console.error('Error fetching checkout_session:', sessionFetchErr.message);
    return json({ error: 'Internal error looking up session' }, 500);
  }

  if (!session) {
    // Unknown reference — acknowledge so Wompi doesn't retry endlessly.
    console.warn('Wompi webhook: unknown reference', transaction.reference);
    return json({ received: true, unknown_reference: true });
  }

  // ── 2. Validate webhook signature (per-store events_secret) ─
  const { data: settingsRow } = await supabase
    .from('store_payment_settings')
    .select('events_secret, payment_providers!inner(code)')
    .eq('store_id', session.store_id)
    .eq('payment_providers.code', 'wompi')
    .maybeSingle();

  const eventsSecret = settingsRow?.events_secret ?? null;

  // Fail closed: no events_secret means we cannot verify this event came
  // from Wompi, so it must be rejected — never treated as implicitly valid.
  // This also covers stores with no store_payment_settings row at all.
  if (!eventsSecret) {
    console.error(
      '[wompi-webhook] rejected: events_secret not configured for store', session.store_id,
      '— reference:', transaction.reference,
    );
    return json({ error: 'Webhook signature verification is not configured for this store' }, 401);
  }

  const properties = event.signature?.properties ?? [];
  const checksum   = event.signature?.checksum;

  if (properties.length === 0 || !checksum) {
    console.error('[wompi-webhook] rejected: missing signature payload, reference:', transaction.reference);
    return json({ error: 'Missing signature' }, 401);
  }

  const values     = properties.map((prop: string) =>
    getNestedValue(event.data as unknown as Record<string, unknown>, prop)
  );
  const propValues = values.join('');
  const calculated = await sha256Hex(`${propValues}${event.timestamp}${eventsSecret}`);

  if (!timingSafeEqual(calculated, checksum)) {
    console.error('[wompi-webhook] rejected: signature mismatch, reference:', transaction.reference);
    return json({ error: 'Invalid signature' }, 401);
  }

  // ── 3. Map Wompi status ─────────────────────────────────────
  const newStatus = mapWompiStatus(transaction.status);
  const nowIso = new Date().toISOString();

  // ── 4. APPROVED: create order from snapshot ─────────────────
  // The entire read-check-create-update sequence now happens inside a
  // single Postgres function (migration 094, section 9) that locks the
  // checkout_sessions row with SELECT ... FOR UPDATE before doing
  // anything else. That lock — not this Edge Function — is what makes
  // two concurrent APPROVED deliveries for the same session safe: the
  // second call blocks until the first transaction commits, then finds
  // order_id already set and returns the existing order instead of
  // creating a second one. See that function's header comment for the
  // full rationale and for why the previous multi-statement version
  // here was a check-then-act race.
  if (newStatus === 'approved') {
    const { data: result, error: rpcErr } = await supabase.rpc('create_order_from_wompi_approved_session', {
      p_checkout_session_id:  session.id,
      p_wompi_transaction_id: transaction.id,
      p_payment_method_type:  transaction.payment_method_type ?? null,
      p_raw_event:            event as unknown as Record<string, unknown>,
    });

    if (rpcErr) {
      console.error('create_order_from_wompi_approved_session failed:', rpcErr.message);
      return json({ error: 'Failed to process approved payment' }, 500);
    }

    const outcome = (result as { outcome: string } | null)?.outcome;

    switch (outcome) {
      case 'session_not_found':
        // Shouldn't happen — session was already fetched above by the
        // same reference — but handled defensively.
        console.warn('Wompi webhook: session vanished before RPC, ref=', transaction.reference);
        return json({ received: true, unknown_reference: true });

      case 'already_created':
        console.log(`Wompi approved (order already exists): ref=${transaction.reference}, order_id=${(result as { order_id: string }).order_id}`);
        return json({ received: true, order_already_created: true });

      case 'already_flagged':
        console.log(`Wompi approved (already flagged for manual review): ref=${transaction.reference}, session=${session.id}`);
        return json({ received: true, requires_manual_review: true, already_flagged: true });

      case 'requires_manual_review':
        console.error(
          `Wompi approved but reservation already released — requires manual review: ` +
          `ref=${transaction.reference}, session=${session.id}, store=${session.store_id}`,
        );
        return json({ received: true, requires_manual_review: true });

      case 'session_already_resolved': {
        // A late/duplicate/out-of-order APPROVED arrived for a session
        // already terminally marked declined/expired/error/voided by an
        // earlier event — never silently create an order for it.
        const previousStatus = (result as { previous_status?: string }).previous_status;
        console.error(
          `Wompi approved but session was already resolved as '${previousStatus}' — requires manual review: ` +
          `ref=${transaction.reference}, session=${session.id}, store=${session.store_id}`,
        );
        return json({ received: true, requires_manual_review: true, previous_status: previousStatus ?? null });
      }

      case 'created': {
        const { order_id: orderId, order_number: orderNumber } = result as { order_id: string; order_number: string };
        console.log(`Wompi approved: ref=${transaction.reference}, order=${orderNumber}, order_id=${orderId}`);
        return json({ received: true, order_number: orderNumber });
      }

      default:
        console.error('create_order_from_wompi_approved_session returned an unexpected outcome:', outcome);
        return json({ error: 'Unexpected internal state' }, 500);
    }
  }

  // ── 5. Non-approved: update session status, release reserved stock ──
  // No order is created for declined/error/voided payments. 'pending' is
  // deliberately excluded from the release below — it means the
  // transaction is still in progress, not finished, so the reservation
  // must stay in place; releasing here could let someone else take the
  // stock out from under a payment that's about to succeed.
  if (newStatus === 'declined' || newStatus === 'error' || newStatus === 'voided') {
    // Guard against an out-of-order webhook delivery arriving after an
    // approval already turned this session into a real order — never
    // release stock that's already backing a paid order.
    if (!session.order_id) {
      const { error: releaseErr } = await supabase.rpc('release_wompi_reservation_by_session', {
        p_checkout_session_id: session.id,
      });
      if (releaseErr) {
        console.error('Failed to release Wompi checkout reservation:', releaseErr.message);
      }
    }
  }

  await supabase
    .from('checkout_sessions')
    .update({
      status:               newStatus,
      wompi_transaction_id: transaction.id,
      updated_at:           nowIso,
    })
    .eq('id', session.id);

  console.log(`Wompi webhook: ref=${transaction.reference} → ${newStatus}`);
  return json({ received: true });
});
