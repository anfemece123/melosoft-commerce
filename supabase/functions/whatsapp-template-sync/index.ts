// Edge Function: whatsapp-template-sync
//
// Creates (if missing) and checks the status of the transactional order-
// confirmation template inside ONE store's own WABA — Modelo B
// (migration 096): templates live per-WABA in Meta, so this cannot be a
// one-time global setup step like it would be under a single central
// number. Called by the owner/admin from the WhatsApp settings page
// after connecting, and safe to call again any time to refresh status
// (e.g. after Meta finishes reviewing a pending template).
//
// Why this exists instead of asking every store owner to create the
// template by hand in Meta's UI: Melosoft's own app already holds
// whatsapp_business_management access on every connected WABA (granted
// during Embedded Signup), so creating/querying templates via the Graph
// API on the owner's behalf is both possible and a much better multi-
// tenant experience than sending every store into Meta Business Manager.
//
// Never sends a real message. Never returns a token to the frontend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders as corsHeaders } from '../_shared/allowedOrigins.ts';
import {
  buildMetaTemplateSyncDiagnostic,
  type MetaTemplateSyncDiagnostic,
} from '../_shared/metaGraphDiagnostics.ts';
import type { MetaOAuthError } from '../_shared/metaOAuthDiagnostics.ts';
import {
  buildWhatsappTemplateCreatePayload,
  type WhatsappTemplateDefinition,
} from '../_shared/whatsappTemplatePayload.ts';

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

const DEFAULT_GRAPH_API_VERSION = 'v25.0'; // fallback only — see docs/whatsapp/deployment.md

// Body text mirrors docs/whatsapp/templates.md exactly — keep both in sync.
const ORDER_CONFIRMATION_TEMPLATE = {
  name: 'melosoft_order_confirmation_v1',
  category: 'utility',
  language: 'es_CO',
  bodyText:
    'Hola {{1}} 👋\n\nTu pedido en *{{2}}* fue recibido correctamente.\n\nPedido: *{{3}}*\nResumen: {{4}}\nTotal: *{{5}}*\nPago: {{6}}\nEntrega: {{7}}\nEstado: {{8}}\n\n{{9}}\n\nConserva este mensaje para consultar la información de tu compra.',
  bodyExample: [
    'María García', 'Panadería Dulce Hogar', 'ORD-20260720-A1B2C3',
    '2x Pan francés, 1x Torta chocolate (mediana), +1 más', '$ 85.000',
    'Pago contraentrega', 'Domicilio a Bogotá — Calle 10 # 20-30', 'Recibido', '¡Gracias por tu compra!',
  ],
} satisfies WhatsappTemplateDefinition;

const TEST_TEMPLATE = {
  name: 'melosoft_whatsapp_test_v1',
  category: 'utility',
  language: 'es_CO',
  bodyText: 'Este es un mensaje de prueba de {{1}} enviado desde Melosoft Commerce. Si lo recibiste, la configuración de WhatsApp está funcionando correctamente.',
  bodyExample: ['Melosoft Commerce'],
} satisfies WhatsappTemplateDefinition;

interface MetaErrorShape {
  error?: MetaOAuthError;
}

type TemplateStatus = ReturnType<typeof mapTemplateStatus>;

interface TemplateSyncResult {
  status: TemplateStatus;
  rejectedReason: string | null;
  diagnostic: MetaTemplateSyncDiagnostic | null;
}

async function metaGet(
  url: string,
  accessToken: string,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  } catch {
    clearTimeout(timeout);
    return { ok: false, status: 0, body: {} };
  }
}

async function metaPost(
  url: string,
  accessToken: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  } catch {
    clearTimeout(timeout);
    return { ok: false, status: 0, body: {} };
  }
}

// Meta's template status strings are UPPERCASE; our DB enum is lowercase.
function mapTemplateStatus(metaStatus: string | undefined): 'not_created' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled' {
  switch ((metaStatus ?? '').toUpperCase()) {
    case 'APPROVED': return 'approved';
    case 'PENDING': return 'pending';
    case 'REJECTED': return 'rejected';
    case 'PAUSED': return 'paused';
    case 'DISABLED': return 'disabled';
    default: return 'not_created';
  }
}

async function syncOneTemplate(
  graphApiVersion: string,
  wabaId: string,
  accessToken: string,
  template: WhatsappTemplateDefinition,
): Promise<TemplateSyncResult> {
  const lookup = await metaGet(
    `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(wabaId)}/message_templates` +
    `?name=${encodeURIComponent(template.name)}`,
    accessToken,
  );

  if (!lookup.ok) {
    const diagnostic = buildMetaTemplateSyncDiagnostic(
      'template_lookup',
      template.name,
      lookup.status,
      (lookup.body as MetaErrorShape).error,
    );
    console.error('[whatsapp-template-sync] template lookup failed:', diagnostic);
    return { status: 'not_created', rejectedReason: null, diagnostic };
  }

  const existing = (lookup.body.data as Array<{ status?: string; rejected_reason?: string }> | undefined)?.[0];
  if (existing) {
    return {
      status: mapTemplateStatus(existing.status),
      rejectedReason: existing.rejected_reason ? String(existing.rejected_reason).slice(0, 300) : null,
      diagnostic: null,
    };
  }

  // The lookup succeeded and returned no match, so it is safe to create.
  const createResult = await metaPost(
    `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(wabaId)}/message_templates`,
    accessToken,
    buildWhatsappTemplateCreatePayload(template),
  );

  if (!createResult.ok) {
    const diagnostic = buildMetaTemplateSyncDiagnostic(
      'template_create',
      template.name,
      createResult.status,
      (createResult.body as MetaErrorShape).error,
    );
    console.error('[whatsapp-template-sync] template creation failed:', diagnostic);
    return { status: 'not_created', rejectedReason: null, diagnostic };
  }

  // A freshly created template starts in review.
  return {
    status: mapTemplateStatus((createResult.body.status as string | undefined) ?? 'PENDING'),
    rejectedReason: null,
    diagnostic: null,
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const graphApiVersion = Deno.env.get('META_GRAPH_API_VERSION') || DEFAULT_GRAPH_API_VERSION;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server misconfiguration' }, 500, cors);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401, cors);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerUser) return json({ error: 'Unauthorized' }, 401, cors);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload: { storeId?: string };
  try {
    payload = await req.json() as { storeId?: string };
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors);
  }
  const storeId = payload.storeId;
  if (!storeId) return json({ error: 'Missing storeId' }, 400, cors);

  const { data: membership } = await adminClient
    .from('store_members')
    .select('role, status')
    .eq('store_id', storeId)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
    return json({ error: 'Forbidden' }, 403, cors);
  }

  // service_role-only RPC — safe to call here because this whole
  // function always runs as service_role internally, regardless of who
  // the calling user is (already authorized above).
  const { data: contextData, error: contextErr } = await adminClient.rpc('get_store_whatsapp_send_context', {
    p_store_id: storeId,
  });
  if (contextErr) {
    console.error('[whatsapp-template-sync] send-context lookup failed:', contextErr.message);
    return json({ error: 'Internal error' }, 500, cors);
  }
  const context = contextData as { connected: boolean; access_token?: string } & Record<string, unknown>;
  if (!context.connected || !context.access_token) {
    return json({ error: 'NOT_CONNECTED', message: 'Conecta primero un número de WhatsApp para esta tienda.' }, 409, cors);
  }

  const { data: connectionRow } = await adminClient
    .from('store_whatsapp_connections')
    .select('waba_id')
    .eq('store_id', storeId)
    .single();
  const wabaId = connectionRow?.waba_id as string | undefined;
  if (!wabaId) {
    return json({ error: 'NOT_CONNECTED', message: 'No se encontró la cuenta de WhatsApp Business de esta tienda.' }, 409, cors);
  }

  const accessToken = context.access_token as string;

  const [orderTemplateResult, testTemplateResult] = await Promise.all([
    syncOneTemplate(graphApiVersion, wabaId, accessToken, ORDER_CONFIRMATION_TEMPLATE),
    syncOneTemplate(graphApiVersion, wabaId, accessToken, TEST_TEMPLATE),
  ]);

  const { error: updateErr } = await adminClient.rpc('store_whatsapp_connection_update_template_status', {
    p_store_id: storeId,
    p_template_status: orderTemplateResult.status,
    p_rejected_reason: orderTemplateResult.rejectedReason,
  });
  if (updateErr) {
    console.error('[whatsapp-template-sync] failed to persist template status:', updateErr.message);
  }

  await adminClient.from('store_whatsapp_connection_events').insert({
    store_id: storeId,
    event_type: orderTemplateResult.diagnostic || testTemplateResult.diagnostic
      ? 'template_status_changed'
      : 'template_created',
    actor_user_id: callerUser.id,
    detail: `order_template=${orderTemplateResult.status} test_template=${testTemplateResult.status}`,
  });

  const diagnostics = [orderTemplateResult.diagnostic, testTemplateResult.diagnostic]
    .filter((item): item is MetaTemplateSyncDiagnostic => item !== null);
  if (diagnostics.length > 0) {
    const upstreamMessage = diagnostics[0].metaDetails ||
      diagnostics[0].metaUserMessage ||
      diagnostics[0].metaMessage;
    return json({
      error: 'META_TEMPLATE_SYNC_FAILED',
      message: upstreamMessage
        ? `Meta no pudo crear o consultar las plantillas: ${upstreamMessage}`
        : 'Meta no pudo crear o consultar las plantillas de WhatsApp.',
      diagnostics,
    }, 502, cors);
  }

  return json({
    ok: true,
    orderConfirmationTemplate: { name: ORDER_CONFIRMATION_TEMPLATE.name, status: orderTemplateResult.status, rejectedReason: orderTemplateResult.rejectedReason },
    testTemplate: { name: TEST_TEMPLATE.name, status: testTemplateResult.status },
  }, 200, cors);
});
