import { createClient } from 'jsr:@supabase/supabase-js@2';

// ── Request / Response shapes ────────────────────────────────

interface BusinessHourInput {
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  breakStartsAt: string | null;
  breakEndsAt: string | null;
}

interface LocationInput {
  addressLine: string | null;
  neighborhood: string | null;
  city: string | null;
  department: string | null;
  country: string;
  postalCode: string | null;
  isPublic: boolean;
}

interface PoliciesInput {
  shippingPolicy: string | null;
  returnsPolicy: string | null;
  warrantyPolicy: string | null;
  privacyPolicy: string | null;
  termsAndConditions: string | null;
}

interface CreateStoreWithOwnerPayload {
  // Owner
  ownerFullName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerDocumentType: string | null;
  ownerDocumentNumber: string | null;
  // Store
  name: string;
  slug: string;
  slogan: string | null;
  businessVertical: string;
  businessSubcategory: string;
  description: string;
  logoUrl: string | null;
  supportEmail: string | null;
  whatsappNumber: string;
  country: string;
  city: string;
  currency: string;
  // Theme
  mode: 'light' | 'dark';
  themePreset: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonRadius: string;
  // Subtables
  location: LocationInput;
  businessHours: BusinessHourInput[];
  policies: PoliciesInput;
}

interface CreateStoreWithOwnerResponse {
  storeId: string;
  storeSlug: string;
  ownerUserId: string;
  ownerIsNew: boolean;
}

const STORE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const RESERVED_STORE_SLUGS = new Set([
  'admin', 'api', 'app', 'assets', 'auth', 'blog', 'cdn', 'dashboard',
  'docs', 'help', 'mail', 'static', 'status', 'store', 'stores', 'support', 'www',
]);

// ── Commerce defaults ─────────────────────────────────────────

interface CommerceDefaults {
  business_category: string;
  catalog_type: string;
  commerce_mode: string;
  delivery_mode: string;
  allows_pickup: boolean;
  allows_local_delivery: boolean;
  allows_national_shipping: boolean;
  whatsapp_checkout_enabled: boolean;
  web_order_enabled: boolean;
  online_checkout_enabled: boolean;
  cash_on_delivery_enabled: boolean;
  default_order_method: string;
  order_flow_type: string;
  has_inventory: boolean;
  has_variants: boolean;
  has_leads: boolean;
}

function getCommerceDefaults(businessVertical: string): CommerceDefaults {
  switch (businessVertical) {
    case 'food_restaurant':
      return {
        business_category: 'restaurant',
        catalog_type: 'menu',
        commerce_mode: 'local_delivery_and_pickup',
        delivery_mode: 'local_delivery',
        allows_pickup: true,
        allows_local_delivery: true,
        allows_national_shipping: false,
        whatsapp_checkout_enabled: true,
        web_order_enabled: true,
        online_checkout_enabled: false,
        cash_on_delivery_enabled: true,
        default_order_method: 'whatsapp',
        order_flow_type: 'restaurant',
        has_inventory: false,
        has_variants: false,
        has_leads: false,
      };
    case 'catalog_quote':
      return {
        business_category: 'other',
        catalog_type: 'physical_products',
        commerce_mode: 'catalog_only',
        delivery_mode: 'none',
        allows_pickup: false,
        allows_local_delivery: false,
        allows_national_shipping: false,
        whatsapp_checkout_enabled: true,
        web_order_enabled: false,
        online_checkout_enabled: false,
        cash_on_delivery_enabled: false,
        default_order_method: 'whatsapp',
        order_flow_type: 'quote',
        has_inventory: false,
        has_variants: false,
        has_leads: true,
      };
    case 'real_estate':
      return {
        business_category: 'other',
        catalog_type: 'physical_products',
        commerce_mode: 'catalog_only',
        delivery_mode: 'none',
        allows_pickup: false,
        allows_local_delivery: false,
        allows_national_shipping: false,
        whatsapp_checkout_enabled: true,
        web_order_enabled: false,
        online_checkout_enabled: false,
        cash_on_delivery_enabled: false,
        default_order_method: 'whatsapp',
        order_flow_type: 'lead',
        has_inventory: false,
        has_variants: false,
        has_leads: true,
      };
    default: // retail_products
      return {
        business_category: 'retail',
        catalog_type: 'physical_products',
        commerce_mode: 'national_shipping',
        delivery_mode: 'national_shipping',
        allows_pickup: true,
        allows_local_delivery: true,
        allows_national_shipping: true,
        whatsapp_checkout_enabled: true,
        web_order_enabled: true,
        online_checkout_enabled: false,
        cash_on_delivery_enabled: false,
        default_order_method: 'whatsapp',
        order_flow_type: 'ecommerce',
        has_inventory: true,
        has_variants: false,
        has_leads: false,
      };
  }
}

function verticalToLegacyBusinessType(vertical: string): string {
  switch (vertical) {
    case 'food_restaurant': return 'restaurante';
    case 'catalog_quote': return 'otro';
    case 'real_estate': return 'otro';
    default: return 'otro'; // retail_products → no single legacy type; use 'otro'
  }
}

// ── CORS ──────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'https://melosoftapp.com',
  'https://www.melosoftapp.com',
]);

function getAllowedOrigins(): Set<string> {
  const origins = new Set(ALLOWED_ORIGINS);
  for (const hostname of (Deno.env.get('PLATFORM_HOSTNAMES') ?? '').split(',')) {
    const normalized = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (normalized) origins.add(`https://${normalized}`);
  }
  return origins;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = getAllowedOrigins().has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// ── Helpers ──────────────────────────────────────────────────

function jsonError(message: string, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function jsonOk(data: CreateStoreWithOwnerResponse, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// ── Handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: cors });
  }

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405, cors);
  }

  // ── Environment ─────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonError('Server misconfiguration: missing environment variables', 500, cors);
  }

  // ── Verify caller is platform_admin ─────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('Unauthorized: missing Authorization header', 401, cors);
  }

  // Client with caller's JWT to verify their identity
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerUser) {
    return jsonError('Unauthorized: invalid token', 401, cors);
  }

  // Service role client — bypasses RLS for privileged reads/writes
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check platform_admin role — uses user_id (FK to auth.users.id), not profiles.id
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('platform_role, status')
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (profileError) {
    return jsonError(`Profile lookup failed: ${profileError.message}`, 500, cors);
  }
  if (!callerProfile) {
    return jsonError('Unauthorized: profile not found for this user', 403, cors);
  }

  if (callerProfile.platform_role !== 'platform_admin' || callerProfile.status !== 'active') {
    return jsonError('Forbidden: only platform_admin can create stores', 403, cors);
  }

  // ── Parse and validate payload ───────────────────────────
  let payload: CreateStoreWithOwnerPayload;
  try {
    payload = await req.json() as CreateStoreWithOwnerPayload;
  } catch {
    return jsonError('Invalid JSON body', 400, cors);
  }

  const required: (keyof CreateStoreWithOwnerPayload)[] = [
    'ownerFullName', 'ownerEmail', 'ownerPhone',
    'name', 'slug', 'businessVertical', 'businessSubcategory', 'description', 'whatsappNumber',
    'country', 'city', 'currency', 'mode', 'themePreset',
  ];
  for (const field of required) {
    if (!payload[field]) {
      return jsonError(`Missing required field: ${field}`, 400, cors);
    }
  }

  payload.slug = payload.slug.trim().toLowerCase();
  if (
    payload.slug.length < 2 ||
    payload.slug.length > 60 ||
    !STORE_SLUG_PATTERN.test(payload.slug)
  ) {
    return jsonError(
      'La dirección de la empresa debe usar letras minúsculas, números o guiones, sin guiones al inicio o al final.',
      400,
      cors,
    );
  }
  if (RESERVED_STORE_SLUGS.has(payload.slug)) {
    return jsonError('Esa dirección está reservada por la plataforma. Elige otra.', 409, cors);
  }

  // Check before inviting/creating the owner to avoid orphan users when the
  // public storefront address is already taken.
  const { data: existingStore, error: slugLookupError } = await adminClient
    .from('stores')
    .select('id')
    .ilike('slug', payload.slug)
    .maybeSingle();
  if (slugLookupError) {
    return jsonError(`No se pudo validar la dirección: ${slugLookupError.message}`, 500, cors);
  }
  if (existingStore) {
    return jsonError(`La dirección "${payload.slug}" ya está en uso.`, 409, cors);
  }

  // ── Resolve or create owner in Auth ─────────────────────
  let ownerUserId: string;
  let ownerIsNew = false;

  // Check if a profile already exists with this email
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('user_id')
    .eq('email', payload.ownerEmail)
    .maybeSingle();

  if (existingProfile?.user_id) {
    // User already exists — reuse their user_id
    ownerUserId = existingProfile.user_id;
  } else {
    // Create new user via Admin API with an invitation.
    // redirectTo sends the owner to /auth/callback?next=/set-password so they
    // land on SetPasswordPage after clicking the email link.
    const requestOrigin = req.headers.get('Origin') ?? '';
    const appOrigin = getAllowedOrigins().has(requestOrigin)
      ? requestOrigin
      : 'https://melosoftapp.com';
    const redirectTo = `${appOrigin}/auth/callback?next=/set-password`;

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      payload.ownerEmail,
      {
        redirectTo,
        data: {
          full_name: payload.ownerFullName,
          role: 'owner',
          store_slug: payload.slug,
        },
      }
    );

    if (inviteError || !inviteData.user) {
      return jsonError(`Failed to invite owner user: ${inviteError?.message ?? 'unknown error'}`, 500, cors);
    }

    ownerUserId = inviteData.user.id;
    ownerIsNew = true;
  }

  // ── Upsert owner profile with additional fields ──────────
  const { error: profileUpsertError } = await adminClient
    .from('profiles')
    .upsert(
      {
        user_id: ownerUserId,
        email: payload.ownerEmail,
        full_name: payload.ownerFullName,
        phone: payload.ownerPhone,
        document_type: payload.ownerDocumentType ?? null,
        document_number: payload.ownerDocumentNumber ?? null,
        platform_role: 'platform_member',
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (profileUpsertError) {
    return jsonError(`Failed to upsert owner profile: ${profileUpsertError.message}`, 500, cors);
  }

  // ── Create store ────────────────────────────────────────
  const { data: store, error: storeError } = await adminClient
    .from('stores')
    .insert({
      owner_id: ownerUserId,
      name: payload.name,
      slug: payload.slug,
      slogan: payload.slogan ?? null,
      business_type: verticalToLegacyBusinessType(payload.businessVertical),
      business_vertical: payload.businessVertical,
      business_subcategory: payload.businessSubcategory || null,
      description: payload.description,
      logo_url: payload.logoUrl ?? null,
      support_email: payload.supportEmail ?? null,
      whatsapp_number: payload.whatsappNumber,
      country: payload.country,
      city: payload.city,
      currency: payload.currency,
      status: 'active',
    })
    .select('id, slug')
    .single();

  if (storeError || !store) {
    return jsonError(`Failed to create store: ${storeError?.message ?? 'no data returned'}`, 500, cors);
  }

  const storeId: string = store.id;

  // ── Create theme settings ────────────────────────────────
  const { error: themeError } = await adminClient
    .from('store_theme_settings')
    .insert({
      store_id: storeId,
      mode: payload.mode,
      theme_preset: payload.themePreset,
      primary_color: payload.primaryColor,
      secondary_color: payload.secondaryColor,
      accent_color: payload.accentColor,
      background_color: payload.backgroundColor,
      text_color: payload.textColor,
      button_radius: payload.buttonRadius,
      template_key: 'default',
    });

  if (themeError) {
    return jsonError(`Failed to create theme settings: ${themeError.message}`, 500, cors);
  }

  // ── Create policies ─────────────────────────────────────
  const { error: policiesError } = await adminClient
    .from('store_policies')
    .insert({
      store_id: storeId,
      shipping_policy: payload.policies.shippingPolicy ?? null,
      returns_policy: payload.policies.returnsPolicy ?? null,
      warranty_policy: payload.policies.warrantyPolicy ?? null,
      privacy_policy: payload.policies.privacyPolicy ?? null,
      terms_and_conditions: payload.policies.termsAndConditions ?? null,
    });

  if (policiesError) {
    return jsonError(`Failed to create policies: ${policiesError.message}`, 500, cors);
  }

  // ── Create location (sede principal always created) ─────
  {
    const { error: locationError } = await adminClient
      .from('store_locations')
      .insert({
        store_id: storeId,
        name: 'Sede principal',
        is_primary: true,
        is_active: true,
        is_public: payload.location.isPublic,
        allows_pickup: true,
        allows_local_delivery: false,
        sort_order: 0,
        address_line: payload.location.addressLine ?? null,
        neighborhood: payload.location.neighborhood ?? null,
        city: payload.location.city ?? null,
        department: payload.location.department ?? null,
        country: payload.location.country || payload.country,
        postal_code: payload.location.postalCode ?? null,
      });

    if (locationError) {
      return jsonError(`Failed to create location: ${locationError.message}`, 500, cors);
    }
  }

  // ── Create business hours ────────────────────────────────
  if (payload.businessHours.length > 0) {
    const hoursRows = payload.businessHours.map((h) => ({
      store_id: storeId,
      day_of_week: h.dayOfWeek,
      is_open: h.isOpen,
      opens_at: h.opensAt || null,
      closes_at: h.closesAt || null,
      break_starts_at: h.breakStartsAt || null,
      break_ends_at: h.breakEndsAt || null,
    }));

    const { error: hoursError } = await adminClient
      .from('store_business_hours')
      .insert(hoursRows);

    if (hoursError) {
      return jsonError(`Failed to create business hours: ${hoursError.message}`, 500, cors);
    }
  }

  // Note: store_members (owner) and store_limits are created automatically
  // by the on_store_created trigger (migration 004).

  // ── Create commerce settings ─────────────────────────────
  const commerceDefaults = getCommerceDefaults(payload.businessVertical);
  const { error: commerceError } = await adminClient
    .from('store_commerce_settings')
    .insert({
      store_id: storeId,
      ...commerceDefaults,
    });

  if (commerceError) {
    return jsonError(`Failed to create commerce settings: ${commerceError.message}`, 500, cors);
  }

  return jsonOk({
    storeId,
    storeSlug: store.slug as string,
    ownerUserId,
    ownerIsNew,
  }, cors);
});
