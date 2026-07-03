// Edge Function: wompi-webhook
//
// Receives Wompi payment events (transaction.updated) and:
//   - APPROVED → creates a real order from the checkout_session.items_snapshot,
//                creates order_items, creates payment_transaction, marks session approved
//   - DECLINED / ERROR → marks checkout_session declined/error (no order created)
//
// Security:
//   - Validates the per-store events_secret signature (SHA-256).
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

interface ValidatedItem {
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  customization_notes: string | null;
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

  if (eventsSecret) {
    const properties = event.signature?.properties ?? [];
    const checksum   = event.signature?.checksum;

    const values     = properties.map((prop: string) =>
      getNestedValue(event.data as unknown as Record<string, unknown>, prop)
    );
    const propValues = values.join('');
    const calculated = await sha256Hex(`${propValues}${event.timestamp}${eventsSecret}`);

    if (calculated !== checksum) {
      console.error('[wompi-webhook] signature mismatch, reference:', transaction.reference);
      return json({ error: 'Invalid signature' }, 401);
    }
  } else {
    console.warn('[wompi-webhook] no events_secret for store:', session.store_id, '— skipping signature validation');
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
        subtotal:              Number(session.total_amount),
        shipping_amount:       0,
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
      product_name_snapshot:       item.product_name,
      product_slug_snapshot:       item.product_slug,
      product_image_url_snapshot:  item.product_image_url ?? null,
      name:                        item.product_name,
      quantity:                    item.quantity,
      unit_price:                  item.unit_price,
      total_price:                 item.total_price,
      customer_note:               item.customization_notes ?? null,
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItemRows);
    if (itemsErr) {
      // Log but don't fail — the order exists, items can be recovered.
      console.error('Failed to create order_items:', itemsErr.message);
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

  // ── 5. Non-approved: update session status only ─────────────
  // No order is created for declined/error/voided payments.
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
