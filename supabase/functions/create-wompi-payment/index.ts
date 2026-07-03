// Edge Function: create-wompi-payment
//
// Receives a full cart payload from the public storefront.
// Does NOT receive or create an order_id — the real order is created
// only after the Wompi webhook confirms APPROVED.
//
// Steps:
//   1. Validate store (active + web_order_enabled + online_checkout_enabled)
//   2. Validate Wompi settings (active + all required keys present)
//   3. Validate store location (if provided)
//   4. Validate each product server-side (active, available, belongs to store)
//   5. Calculate total amount server-side — never trust client total
//   6. Generate unique payment reference
//   7. Compute SHA-256 integrity signature (never sent to browser)
//   8. Build Wompi Web Checkout URL
//   9. Create checkout_session record with items_snapshot
//  10. Return {checkoutUrl, reference, sessionId, amountInCents, environment}
//
// Security:
//   - private_key and integrity_secret are never returned to the browser.
//   - redirect_url MUST be HTTPS (Wompi rejects HTTP URLs).
//   - Total is computed from DB prices, not from the client payload.

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

async function buildIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  integritySecret: string,
): Promise<string> {
  const raw = `${reference}${amountInCents}${currency}${integritySecret}`;
  return sha256Hex(raw);
}

interface CartItem {
  product_id: string;
  quantity: number;
  customization_notes?: string | null;
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

interface RequestBody {
  store_slug?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string | null;
  fulfillment_method?: string;
  shipping_address?: string | null;
  city?: string | null;
  department?: string | null;
  delivery_neighborhood?: string | null;
  delivery_reference?: string | null;
  notes?: string | null;
  store_location_id?: string | null;
  items?: CartItem[];
  redirect_url?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const {
    store_slug,
    customer_name,
    customer_phone,
    customer_email = null,
    fulfillment_method = 'delivery',
    shipping_address = null,
    city = null,
    department = null,
    delivery_neighborhood = null,
    delivery_reference = null,
    notes = null,
    store_location_id = null,
    items = [],
    redirect_url,
  } = body;

  // ── Validate required fields ──────────────────────────────
  if (!store_slug)    return json({ error: 'store_slug is required' }, 400);
  if (!customer_name) return json({ error: 'customer_name is required' }, 400);
  if (!customer_phone) return json({ error: 'customer_phone is required' }, 400);
  if (!redirect_url)  return json({ error: 'redirect_url is required' }, 400);
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: 'items must be a non-empty array' }, 400);
  }

  // Wompi only accepts HTTPS redirect URLs
  if (!redirect_url.startsWith('https://')) {
    return json({
      error: 'redirect_url must use HTTPS. ' +
             'Wompi rejects HTTP and localhost URLs. ' +
             'Set VITE_PUBLIC_SITE_URL to your public HTTPS URL ' +
             '(use ngrok in development).',
    }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // ── 1. Validate store ─────────────────────────────────────
  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .select('id, status')
    .eq('slug', store_slug)
    .single();

  if (storeErr || !storeRow) return json({ error: 'Store not found' }, 404);
  if (storeRow.status !== 'active') return json({ error: 'Store is not active' }, 422);

  const storeId: string = storeRow.id;

  // ── 2. Validate commerce settings ─────────────────────────
  const { data: commerceRow, error: commerceErr } = await supabase
    .from('store_commerce_settings')
    .select('web_order_enabled, online_checkout_enabled')
    .eq('store_id', storeId)
    .single();

  if (commerceErr || !commerceRow) {
    return json({ error: 'Commerce settings not found for this store' }, 422);
  }
  if (!commerceRow.web_order_enabled) {
    return json({ error: 'Web orders are disabled for this store' }, 422);
  }
  if (!commerceRow.online_checkout_enabled) {
    return json({ error: 'Online checkout is disabled for this store' }, 422);
  }

  // ── 3. Validate Wompi settings ─────────────────────────────
  const { data: settingsRow, error: settingsErr } = await supabase
    .from('store_payment_settings')
    .select('id, public_key, integrity_secret_reference, environment, is_active, payment_providers!inner(code)')
    .eq('store_id', storeId)
    .eq('payment_providers.code', 'wompi')
    .single();

  if (settingsErr || !settingsRow) {
    return json({ error: 'Wompi is not configured for this store' }, 422);
  }
  if (!settingsRow.is_active) {
    return json({ error: 'Wompi is not active for this store' }, 422);
  }
  if (!settingsRow.public_key) {
    return json({ error: 'Wompi public key is not configured' }, 422);
  }
  if (!settingsRow.integrity_secret_reference) {
    return json({ error: 'Wompi integrity secret is not configured' }, 422);
  }

  // ── 4. Validate location ────────────────────────────────────
  if (store_location_id) {
    const { data: locRow } = await supabase
      .from('store_locations')
      .select('id')
      .eq('id', store_location_id)
      .eq('store_id', storeId)
      .eq('is_active', true)
      .maybeSingle();

    if (!locRow) {
      return json({ error: 'Invalid or inactive store location' }, 422);
    }
  }

  // ── 5. Validate products + calculate total server-side ──────
  const validatedItems: ValidatedItem[] = [];
  let totalAmount = 0;

  for (const item of items) {
    if (!item.product_id) {
      return json({ error: 'Missing product_id in one of the items' }, 400);
    }
    const qty = Math.floor(Number(item.quantity));
    if (!qty || qty < 1) {
      return json({ error: `Invalid quantity for product ${item.product_id}` }, 400);
    }

    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id, name, slug, regular_price, sale_price, status, is_available, main_image_url')
      .eq('id', item.product_id)
      .eq('store_id', storeId)
      .single();

    if (productErr || !product) {
      return json({ error: `Product not found: ${item.product_id}` }, 422);
    }
    if (product.status !== 'active' || !product.is_available) {
      return json({ error: `Product is not available: ${product.name}` }, 422);
    }

    // Capture primary image at checkout time (same as create_store_order does)
    const { data: imageRow } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_id', product.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    const activePrice: number = product.sale_price ?? product.regular_price;
    const lineTotal = activePrice * qty;
    totalAmount += lineTotal;

    validatedItems.push({
      product_id:          product.id,
      product_name:        product.name,
      product_slug:        product.slug,
      product_image_url:   imageRow?.image_url ?? product.main_image_url ?? null,
      quantity:            qty,
      unit_price:          activePrice,
      total_price:         lineTotal,
      customization_notes: item.customization_notes ?? null,
    });
  }

  if (totalAmount <= 0) {
    return json({ error: 'Order total must be greater than zero' }, 422);
  }

  const amountInCents = Math.round(totalAmount * 100);

  // ── 6. Generate unique payment reference ────────────────────
  const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const reference = `CS-${dateStr}-${shortId}`;

  // ── 7. Compute integrity signature ──────────────────────────
  // SHA256(reference + amountInCents + currency + integritySecret)
  // The integrity secret never leaves the server.
  const integritySignature = await buildIntegritySignature(
    reference,
    amountInCents,
    'COP',
    settingsRow.integrity_secret_reference,
  );

  // ── 8. Build Wompi Web Checkout URL ─────────────────────────
  const wompiBaseUrl = 'https://checkout.wompi.co/p/';
  const params = new URLSearchParams({
    'public-key':          settingsRow.public_key,
    'currency':            'COP',
    'amount-in-cents':     String(amountInCents),
    'reference':           reference,
    'signature:integrity': integritySignature,
    'redirect-url':        redirect_url,
  });
  const checkoutUrl = `${wompiBaseUrl}?${params.toString()}`;

  // ── 9. Create checkout_session record ───────────────────────
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { data: session, error: sessionErr } = await supabase
    .from('checkout_sessions')
    .insert({
      store_id:              storeId,
      store_slug:            store_slug,
      store_location_id:     store_location_id ?? null,
      provider:              'wompi',
      provider_reference:    reference,
      amount_in_cents:       amountInCents,
      currency:              'COP',
      status:                'created',
      customer_name:         customer_name,
      customer_phone:        customer_phone,
      customer_email:        customer_email ?? null,
      fulfillment_method:    fulfillment_method,
      shipping_address:      shipping_address ?? null,
      city:                  city ?? null,
      department:            department ?? null,
      delivery_neighborhood: delivery_neighborhood ?? null,
      delivery_reference:    delivery_reference ?? null,
      notes:                 notes ?? null,
      items_snapshot:        validatedItems,
      total_amount:          totalAmount,
      checkout_url:          checkoutUrl,
      expires_at:            twoHoursFromNow,
    })
    .select('id')
    .single();

  if (sessionErr || !session) {
    console.error('Failed to create checkout_session:', sessionErr?.message);
    return json({ error: 'Could not create checkout session' }, 500);
  }

  // ── 10. Return safe payload to frontend ─────────────────────
  // integritySignature and the raw secret are NOT returned.
  return json({
    checkoutUrl,
    reference,
    sessionId:    session.id,
    amountInCents,
    environment:  settingsRow.environment,
  });
});
