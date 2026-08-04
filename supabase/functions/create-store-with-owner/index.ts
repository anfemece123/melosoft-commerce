import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders, resolveAppOrigin } from '../_shared/allowedOrigins.ts';
import { ownerPasswordValidationError } from '../_shared/ownerAccess.ts';
import { buildOwnerProfileUpsert } from '../_shared/ownerProfile.ts';
import { getStoreCreationCommerceDefaults } from '../_shared/storeCreationDefaults.ts';

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
  ownerAccessMode: 'invitation' | 'password';
  ownerPassword: string | null;
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
  ownerAccessResult: 'invitation_sent' | 'password_assigned' | 'existing_account';
}

const STORE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
// Keep in sync with public.is_reserved_store_slug() in
// supabase/migrations/097_store_slug_availability.sql (the enforced
// authority) and RESERVED_STOREFRONT_SUBDOMAINS in
// src/lib/storefront/storefrontSubdomains.ts (the frontend mirror).
const RESERVED_STORE_SLUGS = new Set([
  'admin', 'administrator', 'api', 'app', 'assets', 'auth',
  'beta', 'blog', 'callback', 'callbacks', 'cdn', 'commerce',
  'dashboard', 'demo', 'dev', 'development', 'docs', 'email',
  'files', 'ftp', 'help', 'localhost', 'login', 'logout', 'mail',
  'media', 'panel', 'preview', 'register', 'signup', 'soporte',
  'staging', 'static', 'status', 'store', 'stores', 'supabase',
  'support', 'test', 'testing', 'webhook', 'webhooks', 'www',
]);

function verticalToLegacyBusinessType(vertical: string): string {
  switch (vertical) {
    case 'food_restaurant': return 'restaurante';
    case 'catalog_quote': return 'otro';
    case 'real_estate': return 'otro';
    default: return 'otro'; // retail_products → no single legacy type; use 'otro'
  }
}

// ── Helpers ──────────────────────────────────────────────────

function jsonError(message: string, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// If any step after the store row is created fails, undo the whole
// partial attempt instead of leaving a half-built company behind.
// Every store-owned table (theme, policies, locations, hours,
// store_members, store_limits, ...) has `store_id ... on delete
// cascade`, so deleting the store row alone reverses all of them. If the
// owner user was invited fresh in THIS request (not a pre-existing
// user), it is removed too — auth.users deletion cascades to profiles.
// Pre-existing owners (ownerIsNew === false) are never touched.
async function rollbackStoreCreation(
  adminClient: SupabaseClient<any, any, any, any, any>,
  storeId: string,
  ownerUserId: string,
  ownerIsNew: boolean,
): Promise<void> {
  await adminClient.from('stores').delete().eq('id', storeId);
  if (ownerIsNew) {
    await adminClient.auth.admin.deleteUser(ownerUserId).catch(() => undefined);
  }
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
    'ownerFullName', 'ownerEmail', 'ownerPhone', 'ownerAccessMode',
    'name', 'slug', 'businessVertical', 'businessSubcategory', 'description', 'whatsappNumber',
    'country', 'currency', 'mode', 'themePreset',
  ];
  for (const field of required) {
    if (!payload[field]) {
      return jsonError(`Missing required field: ${field}`, 400, cors);
    }
  }

  payload.ownerEmail = payload.ownerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.ownerEmail) || payload.ownerEmail.length > 254) {
    return jsonError('El correo de acceso del propietario no es válido.', 400, cors);
  }
  if (!['invitation', 'password'].includes(payload.ownerAccessMode)) {
    return jsonError('El método de acceso del propietario no es válido.', 400, cors);
  }
  if (payload.ownerAccessMode === 'password') {
    const passwordError = ownerPasswordValidationError(payload.ownerPassword ?? '');
    if (passwordError) return jsonError(passwordError, 400, cors);
  }

  const supportedVerticals = new Set([
    'food_restaurant',
    'retail_products',
    'catalog_quote',
    'real_estate',
  ]);
  if (!supportedVerticals.has(payload.businessVertical)) {
    return jsonError('El tipo de empresa no es válido.', 400, cors);
  }
  if (payload.country !== 'CO' || payload.currency !== 'COP') {
    return jsonError('Melosoft Commerce admite nuevas empresas únicamente en Colombia y en pesos COP.', 400, cors);
  }
  if (
    !payload.location
    || payload.location.country !== 'CO'
    || !payload.location.department?.trim()
    || !payload.location.city?.trim()
  ) {
    return jsonError('La sede principal debe tener un departamento y una ciudad válidos de Colombia.', 400, cors);
  }
  if (!Array.isArray(payload.businessHours) || !payload.policies) {
    return jsonError('La configuración inicial de horarios o políticas no es válida.', 400, cors);
  }
  const primaryLocationCity = payload.location.city.trim();
  const primaryLocationDepartment = payload.location.department.trim();

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
  if (/^[0-9]+$/.test(payload.slug)) {
    return jsonError('La dirección de la empresa no puede ser solo números.', 400, cors);
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
  let ownerHadProfileBefore = false;
  let ownerAccessResult: CreateStoreWithOwnerResponse['ownerAccessResult'];

  // Auth is the authority for login email. A profile can be missing on a
  // legacy account or contain an older email after an Auth email change.
  const { data: existingAuthUserId, error: ownerLookupError } = await adminClient
    .rpc('resolve_auth_user_id_by_email', { p_email: payload.ownerEmail });
  if (ownerLookupError) {
    return jsonError(`No se pudo verificar el correo de acceso: ${ownerLookupError.message}`, 500, cors);
  }

  if (typeof existingAuthUserId === 'string' && existingAuthUserId) {
    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from('profiles')
      .select('user_id, status')
      .eq('user_id', existingAuthUserId)
      .maybeSingle();
    if (existingProfileError) {
      return jsonError(`No se pudo verificar el perfil del propietario: ${existingProfileError.message}`, 500, cors);
    }
    if (existingProfile?.status === 'inactive') {
      return jsonError(
        'La cuenta asociada a este correo está inactiva. Reactívala explícitamente antes de asignarle una empresa.',
        409,
        cors,
      );
    }
    ownerHadProfileBefore = Boolean(existingProfile);

    // Never overwrite an existing account password: the same person may own
    // other stores. Reuse is safe for invitation mode because they already
    // have credentials; direct-password mode must use a new email instead.
    if (payload.ownerAccessMode === 'password') {
      return jsonError(
        'Ya existe una cuenta con este email. Usa la opción de invitación o registra otro correo.',
        409,
        cors,
      );
    }
    ownerUserId = existingAuthUserId;
    ownerAccessResult = 'existing_account';
  } else {
    const userMetadata = {
      full_name: payload.ownerFullName,
      role: 'owner',
      store_slug: payload.slug,
    };

    if (payload.ownerAccessMode === 'invitation') {
      // redirectTo sends the owner to /auth/callback?next=/set-password so
      // they land on SetPasswordPage after clicking the email link.
      const appOrigin = resolveAppOrigin(req);
      const redirectTo = `${appOrigin}/auth/callback?next=/set-password`;
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        payload.ownerEmail,
        { redirectTo, data: userMetadata }
      );

      if (inviteError || !inviteData.user) {
        return jsonError(
          `No se pudo enviar la invitación al propietario: ${inviteError?.message ?? 'error desconocido'}`,
          500,
          cors,
        );
      }
      ownerUserId = inviteData.user.id;
      ownerAccessResult = 'invitation_sent';
    } else {
      // Supabase Auth hashes the password. It is never stored in application
      // tables, included in logs, or returned by this function.
      const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
        email: payload.ownerEmail,
        password: payload.ownerPassword as string,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (createError || !createData.user) {
        const alreadyExists = /already|registered|exists/i.test(createError?.message ?? '');
        return jsonError(
          alreadyExists
            ? 'Ya existe una cuenta de acceso con este email. Usa la opción de invitación o registra otro correo.'
            : `No se pudo crear el acceso del propietario: ${createError?.message ?? 'error desconocido'}`,
          alreadyExists ? 409 : 500,
          cors,
        );
      }
      ownerUserId = createData.user.id;
      ownerAccessResult = 'password_assigned';
    }
    ownerIsNew = true;
  }

  // Only populate personal data for a new/missing profile. An existing
  // profile belongs to the person across every store, so creating another
  // company must not overwrite it or alter platform_role/status.
  const ownerProfileRow = buildOwnerProfileUpsert({
    userId: ownerUserId,
    email: payload.ownerEmail,
    fullName: payload.ownerFullName,
    phone: payload.ownerPhone,
    documentType: payload.ownerDocumentType ?? null,
    documentNumber: payload.ownerDocumentNumber ?? null,
  }, ownerHadProfileBefore);

  if (ownerProfileRow) {
    const { error: profileUpsertError } = await adminClient
      .from('profiles')
      .upsert(ownerProfileRow, { onConflict: 'user_id' });

    if (profileUpsertError) {
      if (ownerIsNew) {
        await adminClient.auth.admin.deleteUser(ownerUserId).catch(() => undefined);
      }
      return jsonError(`Failed to create owner profile: ${profileUpsertError.message}`, 500, cors);
    }
  }

  const commerceDefaults = getStoreCreationCommerceDefaults(payload.businessVertical);

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
      city: primaryLocationCity,
      currency: payload.currency,
      status: 'active',
    })
    .select('id, slug')
    .single();

  if (storeError || !store) {
    // 23505 = unique_violation. The pre-check above already rejects an
    // obviously-taken slug, but two concurrent requests for the same
    // slug can both pass it — the database's unique index
    // (stores_slug_global_unique, migration 083) is what actually
    // decides the race, so translate its raw error into the same
    // friendly message instead of a generic 500.
    if (storeError?.code === '23505') {
      if (ownerIsNew) await adminClient.auth.admin.deleteUser(ownerUserId).catch(() => undefined);
      return jsonError(`La dirección "${payload.slug}" ya está en uso.`, 409, cors);
    }
    if (ownerIsNew) await adminClient.auth.admin.deleteUser(ownerUserId).catch(() => undefined);
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
    await rollbackStoreCreation(adminClient, storeId, ownerUserId, ownerIsNew);
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
    await rollbackStoreCreation(adminClient, storeId, ownerUserId, ownerIsNew);
    return jsonError(`Failed to create policies: ${policiesError.message}`, 500, cors);
  }

  // ── Create location (sede principal always created) ─────
  let primaryLocationId: string;
  {
    const { data: location, error: locationError } = await adminClient
      .from('store_locations')
      .insert({
        store_id: storeId,
        name: 'Sede principal',
        is_primary: true,
        is_active: true,
        is_public: payload.location.isPublic,
        allows_pickup: commerceDefaults.allows_pickup,
        allows_local_delivery: commerceDefaults.allows_local_delivery,
        sort_order: 0,
        address_line: payload.location.addressLine ?? null,
        neighborhood: payload.location.neighborhood ?? null,
        city: primaryLocationCity,
        department: primaryLocationDepartment,
        country: payload.location.country || payload.country,
        postal_code: payload.location.postalCode ?? null,
        timezone: 'America/Bogota',
        order_schedule_mode: payload.businessVertical === 'food_restaurant'
          ? 'same_as_business'
          : 'always_open',
      })
      .select('id')
      .single();

    if (locationError || !location) {
      await rollbackStoreCreation(adminClient, storeId, ownerUserId, ownerIsNew);
      return jsonError(`Failed to create location: ${locationError?.message ?? 'no data returned'}`, 500, cors);
    }
    primaryLocationId = location.id as string;
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
      await rollbackStoreCreation(adminClient, storeId, ownerUserId, ownerIsNew);
      return jsonError(`Failed to create business hours: ${hoursError.message}`, 500, cors);
    }

    // Keep the legacy rows for backwards compatibility and also populate the
    // new per-location model. A break is represented as two intervals.
    const scheduleRows = payload.businessHours.flatMap((h) => {
      if (!h.isOpen || !h.opensAt || !h.closesAt) return [];
      const hasValidBreak = Boolean(
        h.breakStartsAt
        && h.breakEndsAt
        && h.opensAt < h.breakStartsAt
        && h.breakStartsAt < h.breakEndsAt
        && h.breakEndsAt < h.closesAt
      );

      if (hasValidBreak) {
        return [
          {
            store_id: storeId,
            location_id: primaryLocationId,
            schedule_kind: 'business',
            day_of_week: h.dayOfWeek,
            starts_at: h.opensAt,
            ends_at: h.breakStartsAt,
            sort_order: 0,
          },
          {
            store_id: storeId,
            location_id: primaryLocationId,
            schedule_kind: 'business',
            day_of_week: h.dayOfWeek,
            starts_at: h.breakEndsAt,
            ends_at: h.closesAt,
            sort_order: 1,
          },
        ];
      }

      return [{
        store_id: storeId,
        location_id: primaryLocationId,
        schedule_kind: 'business',
        day_of_week: h.dayOfWeek,
        starts_at: h.opensAt,
        ends_at: h.closesAt,
        sort_order: 0,
      }];
    });

    if (scheduleRows.length > 0) {
      const { error: scheduleError } = await adminClient
        .from('location_schedule_intervals')
        .insert(scheduleRows);

      if (scheduleError) {
        await rollbackStoreCreation(adminClient, storeId, ownerUserId, ownerIsNew);
        return jsonError(`Failed to create location schedule: ${scheduleError.message}`, 500, cors);
      }
    }
  }

  // Note: store_members (owner) and store_limits are created automatically
  // by the on_store_created trigger (migration 004).

  // ── Create commerce settings ─────────────────────────────
  const { error: commerceError } = await adminClient
    .from('store_commerce_settings')
    .insert({
      store_id: storeId,
      ...commerceDefaults,
    });

  if (commerceError) {
    await rollbackStoreCreation(adminClient, storeId, ownerUserId, ownerIsNew);
    return jsonError(`Failed to create commerce settings: ${commerceError.message}`, 500, cors);
  }

  return jsonOk({
    storeId,
    storeSlug: store.slug as string,
    ownerUserId,
    ownerIsNew,
    ownerAccessResult,
  }, cors);
});
