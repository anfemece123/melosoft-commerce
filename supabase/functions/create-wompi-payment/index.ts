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

interface ModifierSelection {
  option_group_id: string;
  option_item_id: string;
}

interface CartItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  customization_notes?: string | null;
  customizations?: ModifierSelection[];
}

// Snapshot of a validated, priced modifier — this is what gets stored in
// checkout_sessions.items_snapshot and later copied verbatim into
// order_item_customizations by wompi-webhook once the payment is
// confirmed. Text fields are the source of truth for display.
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
  customizations: ValidatedCustomization[];
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
  whatsapp_consent?: boolean;
}

function calculateShippingAmount(
  subtotal: number,
  fulfillmentMethod: string,
  config: {
    local_delivery_base_fee?: number | null;
    local_delivery_free_from?: number | null;
    national_shipping_base_fee?: number | null;
    national_shipping_free_from?: number | null;
  },
): number {
  if (fulfillmentMethod === 'pickup') return 0;

  if (fulfillmentMethod === 'national_shipping') {
    const threshold = config.national_shipping_free_from;
    if (threshold != null && subtotal >= Number(threshold)) return 0;
    return Number(config.national_shipping_base_fee ?? 0);
  }

  const threshold = config.local_delivery_free_from;
  if (threshold != null && subtotal >= Number(threshold)) return 0;
  return Number(config.local_delivery_base_fee ?? 0);
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
    whatsapp_consent = false,
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

  // Re-validates and re-prices every modifier from product_option_groups/
  // product_option_items — mirrors create_store_order's logic exactly, so
  // a Wompi checkout and a cash-on-delivery order are never priced
  // differently for the same selections. Never trusts a client-sent label
  // or price_delta, only the ids. Defined here (closure over `supabase`)
  // rather than taking it as a typed parameter — supabase-js's overloaded
  // `createClient` makes a standalone `SupabaseClient<...>` parameter type
  // resolve to a different generic instantiation than this call site's,
  // which breaks inference on every `.from(...).select(...)` inside it.
  async function validateAndPriceModifiers(
    storeId: string,
    productId: string,
    selections: ModifierSelection[],
  ): Promise<{ customizations: ValidatedCustomization[]; total: number; error?: undefined } | { error: string }> {
    const { data: groups, error: groupsErr } = await supabase
      .from('product_option_groups')
      .select('id, name, is_required, min_select, max_select')
      .eq('product_id', productId)
      .eq('store_id', storeId)
      .eq('is_active', true);

    if (groupsErr) return { error: 'Error validating product modifiers' };

    if (selections.length > 0 && (!groups || groups.length === 0)) {
      return { error: `Product does not support modifiers: ${productId}` };
    }

    const validated: ValidatedCustomization[] = [];
    let total = 0;

    for (const sel of selections) {
      if (!sel.option_group_id || !sel.option_item_id) {
        return { error: 'Invalid modifier payload' };
      }

      const { data: item, error: itemErr } = await supabase
        .from('product_option_items')
        .select('id, label, price_delta, product_option_groups!inner(id, name, product_id, store_id, is_active)')
        .eq('id', sel.option_item_id)
        .eq('group_id', sel.option_group_id)
        .eq('store_id', storeId)
        .eq('is_active', true)
        .eq('product_option_groups.id', sel.option_group_id)
        .eq('product_option_groups.product_id', productId)
        .eq('product_option_groups.store_id', storeId)
        .eq('product_option_groups.is_active', true)
        .maybeSingle();

      if (itemErr || !item) {
        return { error: `Invalid modifier: ${sel.option_item_id}` };
      }

      // Same array-vs-object typing quirk as the variant selected-values
      // query below — PostgREST returns a single object for this to-one
      // embed at runtime.
      const groupName = (item.product_option_groups as unknown as { name: string } | null)?.name ?? '';

      validated.push({
        option_group_id: sel.option_group_id,
        option_item_id: sel.option_item_id,
        option_group_name: groupName,
        option_item_label: item.label,
        price_delta: Number(item.price_delta),
      });
      total += Number(item.price_delta);
    }

    // Group-level required/min/max — checked against ALL active groups for
    // this product, not just the ones the client selected, so a required
    // group with zero selections is rejected even though the loop above
    // never saw it.
    for (const group of groups ?? []) {
      const count = selections.filter((s) => s.option_group_id === group.id).length;
      const minRequired = group.is_required ? Math.max(group.min_select, 1) : group.min_select;
      if (minRequired > 0 && count < minRequired) {
        return { error: `Modifier group requires a selection: ${group.name}` };
      }
      if (group.max_select != null && count > group.max_select) {
        return { error: `Modifier group allows at most ${group.max_select} selection(s): ${group.name}` };
      }
    }

    return { customizations: validated, total };
  }

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
    .select('web_order_enabled, online_checkout_enabled, local_delivery_base_fee, local_delivery_free_from, national_shipping_base_fee, national_shipping_free_from')
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
    .select('id, public_key, integrity_secret_reference, events_secret, environment, is_active, payment_providers!inner(code)')
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
  // Without events_secret, wompi-webhook fails closed on every event for
  // this store (by design — see that function). Refusing to start a
  // checkout here prevents the worse outcome: a customer paying Wompi
  // successfully while the order never gets created because the webhook
  // that would have confirmed it gets rejected.
  if (!settingsRow.events_secret) {
    return json({ error: 'Wompi events secret is not configured for this store' }, 422);
  }

  // ── 4. Validate location and ordering schedule ─────────────
  let operationalLocationId = store_location_id;
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
  } else {
    const { data: primaryLocation } = await supabase
      .from('store_locations')
      .select('id')
      .eq('store_id', storeId)
      .eq('is_primary', true)
      .eq('is_active', true)
      .maybeSingle();
    operationalLocationId = primaryLocation?.id ?? null;
  }

  if (!operationalLocationId) {
    return json({ error: 'No active store location is available' }, 422);
  }

  const { data: orderStatus, error: orderStatusError } = await supabase.rpc(
    'get_location_order_status',
    { p_location_id: operationalLocationId },
  );
  if (orderStatusError) {
    console.error('Failed to validate ordering schedule:', orderStatusError.message);
    return json({ error: 'Could not validate ordering schedule' }, 500);
  }
  if (orderStatus?.is_accepting_orders !== true) {
    const paused = orderStatus?.status_code === 'paused';
    return json({
      error: paused
        ? 'Los pedidos están pausados en este momento.'
        : 'La tienda no está recibiendo pedidos en este momento.',
      code: paused ? 'ORDERING_PAUSED' : 'ORDERING_CLOSED',
    }, 409);
  }

  // ── 5. Validate products + calculate total server-side ──────
  const validatedItems: ValidatedItem[] = [];
  let subtotalAmount = 0;

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

    // ── Backend must not trust the frontend alone: if this product has
    // any active variant, a bare product_id with no variant_id is
    // rejected outright — same guard as create_store_order (migration
    // 090), reimplemented here since this is a separate runtime. ──
    if (!item.variant_id) {
      const { data: activeVariants } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', product.id)
        .eq('store_id', storeId)
        .eq('status', 'active')
        .limit(1);

      if (activeVariants && activeVariants.length > 0) {
        return json({ error: 'Selecciona una variante disponible antes de pagar.', code: 'VARIANT_REQUIRED' }, 422);
      }
    }

    let activePrice: number = product.sale_price ?? product.regular_price;
    let variantId: string | null = null;
    let variantSku: string | null = null;
    let variantLabel: string | null = null;

    // ── Validate variant (if provided) ─────────────────────────
    if (item.variant_id) {
      const { data: variant, error: variantErr } = await supabase
        .from('product_variants')
        .select('id, product_id, price, sku, status')
        .eq('id', item.variant_id)
        .eq('product_id', product.id)
        .eq('store_id', storeId)
        .single();

      if (variantErr || !variant || variant.status !== 'active') {
        return json({ error: `Variant not found or inactive: ${item.variant_id}` }, 422);
      }

      variantId = variant.id;
      variantSku = variant.sku ?? null;
      activePrice = variant.price ?? activePrice;

      const { data: selectedValues } = await supabase
        .from('product_variant_selected_values')
        .select('option_value_id, option_id, product_variant_options(sort_order), product_variant_option_values(value)')
        .eq('variant_id', variant.id)
        .order('option_id', { ascending: true });

      if (selectedValues && selectedValues.length > 0) {
        variantLabel = selectedValues
          .slice()
          .sort((a, b) => {
            // supabase-js infers embedded to-one relations as arrays here
            // (no generated Database types in this Edge Function), but
            // PostgREST actually returns a single object at runtime for
            // this FK — going through `unknown` doesn't change that
            // runtime shape, it only satisfies the type checker.
            const aOrder = (a.product_variant_options as unknown as { sort_order: number } | null)?.sort_order ?? 0;
            const bOrder = (b.product_variant_options as unknown as { sort_order: number } | null)?.sort_order ?? 0;
            return aOrder - bOrder;
          })
          .map((row) => (row.product_variant_option_values as unknown as { value: string } | null)?.value ?? '')
          .filter((value) => value.length > 0)
          .join(' / ');
      }
    }

    // ── Validate + price modifiers (never trust client price/label) ────
    const modifierSelections = item.customizations ?? [];
    const modifierResult = await validateAndPriceModifiers(storeId, product.id, modifierSelections);
    if ('error' in modifierResult) {
      return json({ error: modifierResult.error }, 422);
    }
    activePrice += modifierResult.total;

    // Capture image at checkout time — variant image takes priority
    // (same resolution order as create_store_order does).
    let imageUrl: string | null = null;
    if (variantId) {
      const { data: variantImageRow } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('variant_id', variantId)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      imageUrl = variantImageRow?.image_url ?? null;
    }
    if (!imageUrl) {
      const { data: imageRow } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', product.id)
        .is('variant_id', null)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      imageUrl = imageRow?.image_url ?? product.main_image_url ?? null;
    }

    const lineTotal = activePrice * qty;
    subtotalAmount += lineTotal;

    validatedItems.push({
      product_id:          product.id,
      variant_id:          variantId,
      product_name:        product.name,
      product_slug:        product.slug,
      product_image_url:   imageUrl,
      variant_label:       variantLabel,
      variant_sku:         variantSku,
      quantity:            qty,
      unit_price:          activePrice,
      total_price:         lineTotal,
      customization_notes: item.customization_notes ?? null,
      customizations:      modifierResult.customizations,
    });
  }

  if (subtotalAmount <= 0) {
    return json({ error: 'Order total must be greater than zero' }, 422);
  }

  const shippingAmount = calculateShippingAmount(subtotalAmount, fulfillment_method, commerceRow);
  const totalAmount = subtotalAmount + shippingAmount;
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
      store_location_id:     operationalLocationId,
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
      subtotal_amount:       subtotalAmount,
      shipping_amount:       shippingAmount,
      total_amount:          totalAmount,
      checkout_url:          checkoutUrl,
      expires_at:            twoHoursFromNow,
      whatsapp_consent:        Boolean(whatsapp_consent),
      whatsapp_consent_at:     whatsapp_consent ? new Date().toISOString() : null,
      whatsapp_consent_source: whatsapp_consent ? 'checkout_web' : null,
      whatsapp_consent_version: whatsapp_consent ? 'v1' : null,
    })
    .select('id')
    .single();

  if (sessionErr || !session) {
    console.error('Failed to create checkout_session:', sessionErr?.message);
    return json({ error: 'Could not create checkout session' }, 500);
  }

  // ── 9.5. Reserve stock atomically for every item, all-or-nothing ────
  // A single RPC call (not separate SELECT/UPDATE from here) — stock
  // validation + decrement must happen inside one transaction to be
  // race-safe, which a sequence of PostgREST calls from this Edge
  // Function cannot guarantee (each is its own auto-committed request).
  // If this fails, the checkout_session already exists (needed its real
  // id for the reservation's checkout_session_id FK) but is marked
  // 'error' and its checkoutUrl is never handed to the client — the
  // customer never reaches Wompi's payment page for something that
  // isn't actually available.
  const { error: reservationErr } = await supabase.rpc('create_wompi_checkout_reservation', {
    p_checkout_session_id: session.id,
    p_store_id:            storeId,
    p_items: validatedItems.map((i) => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      quantity:   i.quantity,
    })),
  });

  if (reservationErr) {
    await supabase
      .from('checkout_sessions')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('id', session.id);

    const message = reservationErr.message ?? '';
    if (message.includes('INSUFFICIENT_STOCK')) {
      return json({ error: 'No hay unidades suficientes disponibles.', code: 'INSUFFICIENT_STOCK' }, 422);
    }
    if (message.includes('INVALID_VARIANT')) {
      return json({ error: 'La variante seleccionada ya no está disponible.', code: 'INVALID_VARIANT' }, 422);
    }
    if (message.includes('INVALID_PRODUCT')) {
      return json({ error: 'Uno de los productos ya no está disponible.', code: 'INVALID_PRODUCT' }, 422);
    }
    console.error('Failed to reserve Wompi checkout stock:', message);
    return json({ error: 'No se pudo completar la reserva de inventario.', code: 'CHECKOUT_RESERVATION_FAILED' }, 500);
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
