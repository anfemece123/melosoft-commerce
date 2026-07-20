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

// Snapshot of a modifier already validated and priced by create-wompi-
// payment at checkout time — inserted verbatim, never re-validated here
// (the product's option groups could have changed since checkout).
interface ValidatedCustomization {
  option_group_id: string;
  option_item_id: string;
  option_group_name: string;
  option_item_label: string;
  price_delta: number;
}

interface ValidatedItem {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  product_slug: string;
  product_image_url: string | null;
  variant_label: string | null;
  variant_sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  customization_notes: string | null;
  customizations?: ValidatedCustomization[];
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
  if (newStatus === 'approved') {
    // Idempotency: if the order already exists, just update session status.
    if (session.order_id) {
      await supabase
        .from('checkout_sessions')
        .update({
          status:               'approved',
          wompi_transaction_id: transaction.id,
          updated_at:           nowIso,
        })
        .eq('id', session.id);

      console.log(`Wompi approved (order already exists): ref=${transaction.reference}, order_id=${session.order_id}`);
      return json({ received: true, order_already_created: true });
    }

    // Already flagged — acknowledge without repeating the check below
    // (the payment_transaction upsert further down is itself idempotent
    // via ignoreDuplicates, so this is purely a fast path, not a
    // correctness requirement).
    if (session.status === 'paid_stock_unavailable') {
      console.log(`Wompi approved (already flagged for manual review): ref=${transaction.reference}, session=${session.id}`);
      return json({ received: true, requires_manual_review: true, already_flagged: true });
    }

    // ── Reservation freshness check ────────────────────────────
    // A checkout_reserved movement for this session can have been
    // reversed by release_wompi_reservation_by_session — either because
    // the payment was declined/errored/voided earlier (out-of-order
    // webhook delivery: a stale APPROVED arriving after that), or
    // because the checkout expired and a LATER, unrelated checkout for
    // the same product ran the deferred-expiration sweep (091) and
    // released it before this late APPROVED ever showed up. Either way,
    // the stock this payment was supposed to hold may no longer be
    // reserved — it could already be sold to someone else. Never create
    // a normal order on top of that, and never silently re-reserve: a
    // payment Wompi actually captured with nothing safely backing it is
    // a business decision (refund, backorder, contact the customer),
    // not something to paper over automatically.
    const { data: releasedMovements, error: releasedCheckErr } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('checkout_session_id', session.id)
      .eq('movement_type', 'checkout_released')
      .limit(1);

    if (releasedCheckErr) {
      console.error('Failed to check reservation freshness:', releasedCheckErr.message);
      return json({ error: 'Internal error verifying reservation' }, 500);
    }

    if (releasedMovements && releasedMovements.length > 0) {
      const { data: provider } = await supabase
        .from('payment_providers')
        .select('id')
        .eq('code', 'wompi')
        .single();

      // Recorded for audit/reconciliation even though there's no order
      // to attach it to — order_id is nullable on payment_transactions
      // specifically for cases like this. ignoreDuplicates covers a
      // retried webhook hitting this same branch again.
      const { error: txErr } = await supabase
        .from('payment_transactions')
        .upsert(
          {
            store_id:                session.store_id,
            order_id:                null,
            provider_id:             provider?.id ?? null,
            provider_reference:      transaction.reference,
            provider_transaction_id: transaction.id,
            amount:                  Number(session.total_amount),
            amount_in_cents:         session.amount_in_cents,
            currency:                session.currency,
            status:                  'approved',
            payment_method:          transaction.payment_method_type ?? null,
            checkout_url:            session.checkout_url ?? null,
            raw_response:            event as unknown as Record<string, unknown>,
            paid_at:                 nowIso,
          },
          { onConflict: 'provider_reference', ignoreDuplicates: true },
        );
      if (txErr) {
        console.error('Failed to record payment_transaction for released reservation:', txErr.message);
      }

      await supabase
        .from('checkout_sessions')
        .update({
          status:               'paid_stock_unavailable',
          wompi_transaction_id: transaction.id,
          updated_at:           nowIso,
        })
        .eq('id', session.id);

      console.error(
        `Wompi approved but reservation already released — requires manual review: ` +
        `ref=${transaction.reference}, session=${session.id}, store=${session.store_id}`,
      );
      return json({ received: true, requires_manual_review: true });
    }

    // Generate order number
    const orderShortId = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    const orderDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `ORD-${orderDateStr}-${orderShortId}`;

    // Create the order
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert({
        store_id:              session.store_id,
        store_location_id:     session.store_location_id ?? null,
        order_number:          orderNumber,
        customer_name:         session.customer_name,
        customer_phone:        session.customer_phone,
        customer_email:        session.customer_email ?? null,
        fulfillment_method:    session.fulfillment_method,
        shipping_address:      session.shipping_address ?? null,
        city:                  session.city ?? null,
        department:            session.department ?? null,
        delivery_neighborhood: session.delivery_neighborhood ?? null,
        delivery_reference:    session.delivery_reference ?? null,
        notes:                 session.notes ?? null,
        source:                'web',
        payment_method:        'online',
        subtotal:              Number(session.subtotal_amount ?? session.total_amount ?? 0),
        shipping_amount:       Number(session.shipping_amount ?? 0),
        discount_amount:       0,
        total_amount:          Number(session.total_amount),
        currency:              session.currency,
        status:                'pending',
        payment_status:        'paid',
      })
      .select('id')
      .single();

    if (orderErr || !newOrder) {
      console.error('Failed to create order from checkout_session:', orderErr?.message);
      return json({ error: 'Failed to create order' }, 500);
    }

    // Create order_items from the locked-in items_snapshot
    const snapshotItems = (session.items_snapshot ?? []) as ValidatedItem[];
    const orderItemRows = snapshotItems.map((item: ValidatedItem) => ({
      order_id:                    newOrder.id,
      product_id:                  item.product_id,
      variant_id:                  item.variant_id ?? null,
      product_name_snapshot:       item.product_name,
      product_slug_snapshot:       item.product_slug,
      product_image_url_snapshot:  item.product_image_url ?? null,
      variant_label_snapshot:      item.variant_label ?? null,
      variant_sku_snapshot:        item.variant_sku ?? null,
      name:                        item.product_name,
      quantity:                    item.quantity,
      unit_price:                  item.unit_price,
      total_price:                 item.total_price,
      customer_note:               item.customization_notes ?? null,
    }));

    // .select('id') so each inserted row's id can be paired back up with
    // its snapshotItems entry below — Postgres preserves VALUES-list order
    // in a single INSERT ... RETURNING, so a plain index zip is safe here.
    const { data: insertedItems, error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItemRows)
      .select('id');
    if (itemsErr) {
      // Log but don't fail — the order exists, items can be recovered.
      console.error('Failed to create order_items:', itemsErr.message);
    }

    // Snapshot each item's already-validated modifiers (validated and
    // priced by create-wompi-payment at checkout time) — never re-validate
    // against product_option_groups/items here, the product's modifiers
    // could have changed since the customer checked out.
    if (insertedItems && insertedItems.length === snapshotItems.length) {
      const customizationRows = insertedItems.flatMap((row, idx) =>
        (snapshotItems[idx].customizations ?? []).map((c) => ({
          order_item_id:      row.id,
          option_group_id:    c.option_group_id,
          option_item_id:     c.option_item_id,
          option_group_name:  c.option_group_name,
          option_item_label:  c.option_item_label,
          price_delta:        c.price_delta,
        }))
      );
      if (customizationRows.length > 0) {
        const { error: customizationsErr } = await supabase
          .from('order_item_customizations')
          .insert(customizationRows);
        if (customizationsErr) {
          console.error('Failed to create order_item_customizations:', customizationsErr.message);
        }
      }
    } else if (insertedItems) {
      console.error(
        'order_items insert count mismatch — skipping order_item_customizations',
        `expected ${snapshotItems.length}, got ${insertedItems.length}`,
      );
    }

    // Link each item's 'checkout_reserved' movement (from create-wompi-
    // payment, migration 091) to the order it just became — stock was
    // already decremented at checkout time, this never decrements again.
    // Matched by (product_id, variant_id) against the pool of this
    // session's still-unlinked reservation movements; claimed one at a
    // time (splice) so duplicate product/variant combos across different
    // snapshot items — e.g. same variant with different modifiers — each
    // claim a distinct movement instead of all matching the first one.
    // An item with no matching movement simply never had stock tracked
    // for it (track_inventory=false) — nothing to link, not an error.
    if (insertedItems && insertedItems.length === snapshotItems.length) {
      const { data: reservationMovements } = await supabase
        .from('inventory_movements')
        .select('id, product_id, variant_id')
        .eq('checkout_session_id', session.id)
        .eq('movement_type', 'checkout_reserved')
        .is('order_id', null);

      const pool = [...(reservationMovements ?? [])];

      for (let idx = 0; idx < snapshotItems.length; idx++) {
        const item = snapshotItems[idx];
        const orderItemId = insertedItems[idx]?.id;
        if (!orderItemId) continue;

        const poolIdx = pool.findIndex(
          (m) => m.product_id === item.product_id && m.variant_id === (item.variant_id ?? null)
        );
        if (poolIdx === -1) continue;

        const [matched] = pool.splice(poolIdx, 1);
        const { error: linkErr } = await supabase
          .from('inventory_movements')
          .update({ order_id: newOrder.id, order_item_id: orderItemId })
          .eq('id', matched.id);
        if (linkErr) {
          console.error('Failed to link checkout_reserved movement to order:', linkErr.message);
        }
      }
    }

    // Get Wompi provider id for payment_transactions
    const { data: provider } = await supabase
      .from('payment_providers')
      .select('id')
      .eq('code', 'wompi')
      .single();

    // Create payment_transaction (linked to the new order).
    // upsert with ignoreDuplicates guards against retried webhooks.
    const { error: txErr } = await supabase
      .from('payment_transactions')
      .upsert(
        {
          store_id:                session.store_id,
          order_id:                newOrder.id,
          provider_id:             provider?.id ?? null,
          provider_reference:      transaction.reference,
          provider_transaction_id: transaction.id,
          amount:                  Number(session.total_amount),
          amount_in_cents:         session.amount_in_cents,
          currency:                session.currency,
          status:                  'approved',
          payment_method:          transaction.payment_method_type ?? null,
          checkout_url:            session.checkout_url ?? null,
          raw_response:            event as unknown as Record<string, unknown>,
          paid_at:                 nowIso,
        },
        { onConflict: 'provider_reference', ignoreDuplicates: true },
      );

    if (txErr) {
      console.error('Failed to create payment_transaction:', txErr.message);
    }

    // Mark checkout_session approved with the new order_id
    await supabase
      .from('checkout_sessions')
      .update({
        status:               'approved',
        order_id:             newOrder.id,
        wompi_transaction_id: transaction.id,
        updated_at:           nowIso,
      })
      .eq('id', session.id);

    console.log(`Wompi approved: ref=${transaction.reference}, order=${orderNumber}, order_id=${newOrder.id}`);
    return json({ received: true, order_number: orderNumber });
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
