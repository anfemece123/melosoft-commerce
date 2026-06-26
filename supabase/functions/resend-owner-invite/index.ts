import { createClient } from 'jsr:@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'https://melosoftapp.com',
  'https://www.melosoftapp.com',
]);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '';
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

function jsonOk(data: Record<string, unknown>, cors: Record<string, string>): Response {
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonError('Server misconfiguration', 500, cors);
  }

  // Verify caller JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('Unauthorized: missing Authorization header', 401, cors);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerUser) {
    return jsonError('Unauthorized: invalid token', 401, cors);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify platform_admin
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('platform_role, status')
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (profileError) {
    return jsonError(`Profile lookup failed: ${profileError.message}`, 500, cors);
  }
  if (!callerProfile) {
    return jsonError('Unauthorized: profile not found', 403, cors);
  }
  if (callerProfile.platform_role !== 'platform_admin' || callerProfile.status !== 'active') {
    return jsonError('Forbidden: only platform_admin can resend invitations', 403, cors);
  }

  // Parse payload
  let payload: { ownerEmail: string };
  try {
    payload = await req.json() as { ownerEmail: string };
  } catch {
    return jsonError('Invalid JSON body', 400, cors);
  }

  if (!payload.ownerEmail) {
    return jsonError('Missing required field: ownerEmail', 400, cors);
  }

  // Build redirect URL based on caller's origin
  const requestOrigin = req.headers.get('Origin') ?? '';
  const appOrigin = ALLOWED_ORIGINS.has(requestOrigin)
    ? requestOrigin
    : 'https://melosoftapp.com';
  const redirectTo = `${appOrigin}/auth/callback?next=/set-password`;

  // Resend invitation — Supabase will send a new invite email
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    payload.ownerEmail,
    { redirectTo }
  );

  if (inviteError) {
    return jsonError(`Failed to resend invitation: ${inviteError.message}`, 500, cors);
  }

  return jsonOk({ message: 'Invitation sent', redirectTo }, cors);
});
