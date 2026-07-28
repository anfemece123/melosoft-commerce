// Edge Function: send-order-email
//
// Durable Brevo worker for the email_notifications outbox created by
// migration 108. It is intentionally invoked by a scheduler with the
// service-role bearer token; checkout only enqueues rows and never waits for
// Brevo. Every request carries the queue row UUID as Brevo's idempotency key,
// making short-window retries safe from duplicate sends.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  renderOrderEmail,
  type OrderEmailData,
  type OrderEmailEvent,
  type OrderEmailItem,
} from '../_shared/orderEmailTemplates.ts';
import { readVerifiedJwtRole } from '../_shared/verifiedServiceRoleJwt.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };
const FETCH_TIMEOUT_MS = 15_000;
const RETRY_BASE_SECONDS = 30;
const RETRY_MAX_SECONDS = 900;

interface EmailNotificationRow {
  id: string;
  store_id: string;
  order_id: string;
  event_type: OrderEmailEvent;
  recipient_type: 'customer' | 'merchant';
  recipient_email: string;
  recipient_name: string | null;
  attempts: number;
  max_attempts: number;
}

interface OrderRow {
  id: string;
  order_number: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  subtotal: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  fulfillment_method: string;
  shipping_address: string | null;
  city: string | null;
  department: string | null;
  delivery_neighborhood: string | null;
  delivery_reference: string | null;
  notes: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  estimated_delivery_at: string | null;
  created_at: string;
  order_items?: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    variant_label_snapshot: string | null;
  }>;
}

interface StoreRow {
  name: string;
  logo_url: string | null;
  support_email: string | null;
  owner_id: string;
}

interface ClassifiedError {
  category: 'recoverable' | 'permanent' | 'config';
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isEmail(value: string | null | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function sanitizeError(value: unknown, maxLen = 240): string {
  const text = typeof value === 'string' ? value : 'Error desconocido de Brevo';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function computeBackoffSeconds(attempts: number, retryAfterSeconds?: number): number {
  const exponential = Math.min(RETRY_BASE_SECONDS * 2 ** Math.max(attempts - 1, 0), RETRY_MAX_SECONDS);
  const withJitter = exponential + Math.random() * 5;
  return retryAfterSeconds && retryAfterSeconds > withJitter ? retryAfterSeconds : withJitter;
}

function classifyBrevoError(status: number, headers: Headers, body: Record<string, unknown>): ClassifiedError {
  const retryAfter = Number(headers.get('retry-after'));
  const code = sanitizeError(body.code ?? `HTTP_${status}`, 80);
  const message = sanitizeError(body.message ?? `Brevo respondió HTTP ${status}`);
  if (status === 429 || status >= 500) {
    return {
      category: 'recoverable',
      code,
      message,
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    };
  }
  if (status === 401 || status === 402 || status === 403) {
    return { category: 'config', code, message };
  }
  return { category: 'permanent', code, message };
}

async function sendWithBrevo(params: {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  notification: EmailNotificationRow;
  order: OrderRow;
  store: StoreRow;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: ClassifiedError }> {
  const { notification, order, store } = params;
  const items: OrderEmailItem[] = (order.order_items ?? []).map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    totalPrice: Number(item.total_price),
    variantLabel: item.variant_label_snapshot,
  }));
  const data: OrderEmailData = {
    eventType: notification.event_type,
    storeName: store.name,
    storeLogoUrl: store.logo_url,
    supportEmail: store.support_email,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    orderNumber: order.order_number ?? order.id.slice(0, 8).toUpperCase(),
    createdAt: order.created_at,
    currency: order.currency,
    subtotal: Number(order.subtotal),
    shippingAmount: Number(order.shipping_amount),
    discountAmount: Number(order.discount_amount),
    totalAmount: Number(order.total_amount),
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    fulfillmentMethod: order.fulfillment_method,
    shippingAddress: order.shipping_address,
    city: order.city,
    department: order.department,
    deliveryNeighborhood: order.delivery_neighborhood,
    deliveryReference: order.delivery_reference,
    notes: order.notes,
    shippingCarrier: order.shipping_carrier,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    estimatedDeliveryAt: order.estimated_delivery_at,
    items,
  };
  const rendered = renderOrderEmail(data);
  const replyTo = notification.recipient_type === 'merchant'
    ? (isEmail(order.customer_email) ? { email: order.customer_email, name: order.customer_name } : undefined)
    : (isEmail(store.support_email) ? { email: store.support_email, name: store.name } : undefined);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': params.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: params.senderEmail, name: params.senderName },
        to: [{ email: notification.recipient_email, name: notification.recipient_name ?? undefined }],
        replyTo,
        subject: rendered.subject,
        htmlContent: rendered.html,
        headers: {
          'Idempotency-Key': notification.id,
          'X-Mailin-custom': `order_id:${notification.order_id}|event:${notification.event_type}`,
        },
        tags: ['melosoft-order', notification.event_type, `store-${notification.store_id}`],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.ok) {
      const messageId = typeof body.messageId === 'string' ? body.messageId : notification.id;
      return { ok: true, messageId };
    }
    // A stable queue-row UUID is reused for every retry. Brevo reports a
    // duplicate idempotency key as a 400 even though the original request was
    // already accepted, so this is a successful terminal outcome, not a send
    // failure and never a reason to generate a new key.
    if (response.status === 400 && body.code === 'duplicate_parameter') {
      return { ok: true, messageId: notification.id };
    }
    return { ok: false, error: classifyBrevoError(response.status, response.headers, body) };
  } catch (error) {
    clearTimeout(timeout);
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      error: {
        category: 'recoverable',
        code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: aborted ? 'Tiempo de espera agotado al llamar a Brevo.' : 'No fue posible conectar con Brevo.',
      },
    };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const exactKey = Boolean(providedToken && serviceRoleKey && timingSafeEqual(providedToken, serviceRoleKey));
  const verifiedRole = providedToken ? readVerifiedJwtRole(providedToken) : null;
  if (!serviceRoleKey || (!exactKey && verifiedRole !== 'service_role')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const apiKey = Deno.env.get('BREVO_API_KEY') ?? '';
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') ?? '';
  const senderName = Deno.env.get('BREVO_SENDER_NAME')?.trim() || 'Melosoft Commerce';
  if (!apiKey || !isEmail(senderEmail)) {
    console.error('[send-order-email] BREVO_API_KEY or BREVO_SENDER_EMAIL is not configured');
    return json({ error: 'Brevo is not configured' }, 503);
  }

  let input: { limit?: number } = {};
  try {
    input = await req.json();
  } catch {
    // Empty body is valid.
  }
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);
  const { data: claimed, error: claimError } = await supabase.rpc('claim_pending_email_notifications', {
    p_limit: limit,
    p_worker_id: `brevo-${crypto.randomUUID().slice(0, 8)}`,
  });
  if (claimError) {
    console.error('[send-order-email] claim failed:', claimError.message);
    return json({ error: 'Failed to claim notifications' }, 500);
  }

  let sent = 0;
  let retried = 0;
  let failed = 0;
  for (const notification of (claimed ?? []) as EmailNotificationRow[]) {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_email, customer_phone, subtotal, shipping_amount, discount_amount, total_amount, currency, payment_method, payment_status, fulfillment_method, shipping_address, city, department, delivery_neighborhood, delivery_reference, notes, shipping_carrier, tracking_number, tracking_url, estimated_delivery_at, created_at, order_items(name, quantity, unit_price, total_price, variant_label_snapshot)')
      .eq('id', notification.order_id)
      .single();
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('name, logo_url, support_email, owner_id')
      .eq('id', notification.store_id)
      .single();

    if (orderError || storeError || !orderData || !storeData) {
      await supabase.from('email_notifications').update({
        status: 'failed',
        is_permanent_failure: true,
        failed_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        last_error_category: 'data',
        last_error_code: orderError ? 'ORDER_NOT_FOUND' : 'STORE_NOT_FOUND',
        last_error_message: 'No fue posible construir el correo porque faltan datos del pedido o la empresa.',
      }).eq('id', notification.id);
      failed++;
      continue;
    }

    let store = storeData as StoreRow;
    if (!isEmail(store.support_email)) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', store.owner_id)
        .maybeSingle();
      if (isEmail(ownerProfile?.email)) store = { ...store, support_email: ownerProfile.email };
    }

    const result = await sendWithBrevo({
      apiKey,
      senderEmail,
      senderName,
      notification,
      order: orderData as unknown as OrderRow,
      store,
    });
    if (result.ok) {
      await supabase.from('email_notifications').update({
        status: 'sent',
        provider_message_id: result.messageId,
        sent_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        last_error_category: null,
        last_error_code: null,
        last_error_message: null,
      }).eq('id', notification.id);
      sent++;
      continue;
    }

    const shouldRetry = result.error.category === 'recoverable' && notification.attempts < notification.max_attempts;
    if (shouldRetry) {
      const delaySeconds = computeBackoffSeconds(notification.attempts, result.error.retryAfterSeconds);
      await supabase.from('email_notifications').update({
        status: 'queued',
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        locked_at: null,
        locked_by: null,
        last_error_category: result.error.category,
        last_error_code: result.error.code,
        last_error_message: result.error.message,
      }).eq('id', notification.id);
      retried++;
    } else {
      await supabase.from('email_notifications').update({
        status: 'failed',
        is_permanent_failure: result.error.category !== 'recoverable',
        failed_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        last_error_category: result.error.category,
        last_error_code: result.error.code,
        last_error_message: result.error.message,
      }).eq('id', notification.id);
      failed++;
    }
  }

  return json({ claimed: (claimed ?? []).length, sent, retried, failed });
});
