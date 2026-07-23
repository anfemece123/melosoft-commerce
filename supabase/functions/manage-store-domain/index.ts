import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  // Missing until now — without it, the browser rejects the preflight
  // response for the POST call (supabase.functions.invoke always sends
  // one, since it attaches Authorization/apikey/x-client-info/
  // Content-Type headers, all of which trigger a CORS preflight) even
  // though the OPTIONS response itself came back 200.
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };
const HOSTNAME_PATTERN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

type DomainStatus = 'pending_dns' | 'pending_ssl' | 'active' | 'error' | 'disabled';
type DnsRecordType = 'A' | 'CNAME';

interface RequestBody {
  action?: 'list' | 'connect' | 'refresh' | 'remove';
  storeId?: string;
  domainId?: string;
  hostname?: string;
}

interface DomainRow {
  id: string;
  store_id: string;
  hostname: string;
  status: DomainStatus;
  is_primary: boolean;
  dns_record_type: DnsRecordType;
  dns_target: string;
  provider: 'vercel';
  provider_hostname_id: string | null;
  ownership_verification_name: string | null;
  ownership_verification_value: string | null;
  ssl_validation_records: Array<{ type: 'TXT'; name: string; value: string }>;
  failure_reason: string | null;
  last_checked_at: string | null;
  verified_at: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface VercelVerification {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

interface VercelProjectDomain {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  verification?: VercelVerification[];
}

interface VercelDomainConfig {
  configuredBy: 'A' | 'CNAME' | 'http' | 'dns-01' | null;
  recommendedIPv4: Array<{ rank: number; value: string[] }>;
  recommendedCNAME: Array<{ rank: number; value: string }>;
  misconfigured: boolean;
}

class VercelApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'VercelApiError';
    this.status = status;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function normalizeHostname(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '');
}

function domainPayload(row: DomainRow) {
  return {
    id: row.id,
    storeId: row.store_id,
    hostname: row.hostname,
    status: row.status,
    isPrimary: row.is_primary,
    dnsRecord: {
      type: row.dns_record_type,
      name: row.hostname,
      value: row.dns_target,
    },
    dnsTarget: row.dns_target,
    provider: row.provider,
    ownershipVerification:
      row.ownership_verification_name && row.ownership_verification_value
        ? {
            type: 'TXT' as const,
            name: row.ownership_verification_name,
            value: row.ownership_verification_value,
          }
        : null,
    sslValidationRecords: Array.isArray(row.ssl_validation_records)
      ? row.ssl_validation_records
      : [],
    failureReason: row.failure_reason,
    lastCheckedAt: row.last_checked_at,
    verifiedAt: row.verified_at,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function vercelErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }
  }
  return `Vercel respondió con estado ${status}.`;
}

async function vercelRequest<T>(
  path: string,
  init: RequestInit,
  token: string,
  teamId: string,
  query: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set('teamId', teamId);
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const payload = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    throw new VercelApiError(vercelErrorMessage(payload, response.status), response.status);
  }
  return payload as T;
}

function preferredValue<T extends { rank: number }>(values: T[]): T | null {
  return [...values].sort((left, right) => left.rank - right.rank)[0] ?? null;
}

function domainState(
  domain: VercelProjectDomain,
  config: VercelDomainConfig,
): {
  status: DomainStatus;
  dnsRecordType: DnsRecordType;
  dnsTarget: string;
  ownershipName: string | null;
  ownershipValue: string | null;
  validationRecords: Array<{ type: 'TXT'; name: string; value: string }>;
} {
  const isApex = domain.name === domain.apexName;
  const dnsRecordType: DnsRecordType = isApex ? 'A' : 'CNAME';
  const recommendedIp = preferredValue(config.recommendedIPv4)?.value[0] ?? null;
  const recommendedCname = preferredValue(config.recommendedCNAME)?.value ?? null;
  const dnsTarget = isApex ? recommendedIp : recommendedCname;
  if (!dnsTarget) {
    throw new Error('Vercel no devolvió un destino DNS recomendado para este dominio. Intenta nuevamente.');
  }

  const validationRecords = (domain.verification ?? [])
    .filter((item) => item.type.toUpperCase() === 'TXT' && item.domain && item.value)
    .map((item) => ({
      type: 'TXT' as const,
      name: item.domain,
      value: item.value,
    }));
  const ownership = validationRecords[0] ?? null;

  return {
    status: domain.verified && !config.misconfigured ? 'active' : 'pending_dns',
    dnsRecordType,
    dnsTarget,
    ownershipName: ownership?.name ?? null,
    ownershipValue: ownership?.value ?? null,
    validationRecords,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Debes iniciar sesión para gestionar dominios.' }, 401);

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return json({ error: 'La solicitud no contiene un JSON válido.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const vercelToken = Deno.env.get('VERCEL_ACCESS_TOKEN') ?? '';
  const vercelProjectId = Deno.env.get('VERCEL_PROJECT_ID') ?? '';
  const vercelTeamId = Deno.env.get('VERCEL_TEAM_ID') ?? '';
  const storefrontRootDomain = normalizeHostname(Deno.env.get('STOREFRONT_ROOT_DOMAIN') ?? '');
  const platformHostnames = new Set(
    (Deno.env.get('PLATFORM_HOSTNAMES') ?? '')
      .split(',')
      .map(normalizeHostname)
      .filter(Boolean),
  );
  if (storefrontRootDomain) platformHostnames.add(storefrontRootDomain);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'La sesión no es válida o expiró.' }, 401);

  async function canManageStore(storeId: string): Promise<{ allowed: boolean; isPlatformAdmin: boolean }> {
    const [{ data: profile }, { data: membership }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('platform_role, status')
        .eq('user_id', user.id)
        .maybeSingle(),
      adminClient
        .from('store_members')
        .select('role, status')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);
    const isPlatformAdmin = profile?.platform_role === 'platform_admin' && profile?.status === 'active';
    const isManager = membership?.status === 'active' && ['owner', 'admin'].includes(membership?.role ?? '');
    return { allowed: isPlatformAdmin || isManager, isPlatformAdmin };
  }

  async function loadAuthorizedDomain(domainId: string): Promise<DomainRow | Response> {
    const { data, error } = await adminClient
      .from('store_domains')
      .select('*')
      .eq('id', domainId)
      .maybeSingle();
    if (error || !data) return json({ error: 'Dominio no encontrado.' }, 404);
    const permission = await canManageStore(data.store_id as string);
    if (!permission.allowed) return json({ error: 'No tienes permiso para gestionar este dominio.' }, 403);
    return data as DomainRow;
  }

  function requireVercelConfiguration(): Response | null {
    if (vercelToken && vercelProjectId) return null;
    return json({
      error: 'La infraestructura de dominios aún no está configurada. Define VERCEL_ACCESS_TOKEN y VERCEL_PROJECT_ID en Supabase.',
    }, 503);
  }

  async function getProjectDomain(hostname: string): Promise<VercelProjectDomain> {
    return vercelRequest<VercelProjectDomain>(
      `/v9/projects/${encodeURIComponent(vercelProjectId)}/domains/${encodeURIComponent(hostname)}`,
      { method: 'GET' },
      vercelToken,
      vercelTeamId,
    );
  }

  async function getDomainConfig(hostname: string): Promise<VercelDomainConfig> {
    return vercelRequest<VercelDomainConfig>(
      `/v6/domains/${encodeURIComponent(hostname)}/config`,
      { method: 'GET' },
      vercelToken,
      vercelTeamId,
      { projectIdOrName: vercelProjectId },
    );
  }

  try {
    if (body.action === 'list') {
      if (!body.storeId) return json({ error: 'storeId es obligatorio.' }, 400);
      const permission = await canManageStore(body.storeId);
      if (!permission.allowed) return json({ error: 'No tienes permiso para ver estos dominios.' }, 403);

      const { data, error } = await adminClient
        .from('store_domains')
        .select('*')
        .eq('store_id', body.storeId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return json({ domains: ((data ?? []) as DomainRow[]).map(domainPayload) });
    }

    if (body.action === 'connect') {
      if (!body.storeId || !body.hostname) {
        return json({ error: 'La tienda y el dominio son obligatorios.' }, 400);
      }
      const configurationError = requireVercelConfiguration();
      if (configurationError) return configurationError;

      const permission = await canManageStore(body.storeId);
      if (!permission.allowed) return json({ error: 'No tienes permiso para conectar dominios.' }, 403);

      const { data: limits } = await adminClient
        .from('store_limits')
        .select('can_use_custom_domain')
        .eq('store_id', body.storeId)
        .maybeSingle();
      if (!permission.isPlatformAdmin && !limits?.can_use_custom_domain) {
        return json({ error: 'El plan actual de esta empresa no incluye dominio personalizado.' }, 403);
      }

      const hostname = normalizeHostname(body.hostname);
      if (!HOSTNAME_PATTERN.test(hostname) || hostname.includes('*')) {
        return json({ error: 'Escribe un dominio válido, por ejemplo: www.miempresa.com.' }, 400);
      }
      if (
        platformHostnames.has(hostname) ||
        (storefrontRootDomain && hostname.endsWith(`.${storefrontRootDomain}`))
      ) {
        return json({ error: 'Ese hostname está reservado para la infraestructura de la plataforma.' }, 400);
      }

      const { data: existingForStore } = await adminClient
        .from('store_domains')
        .select('id')
        .eq('store_id', body.storeId)
        .maybeSingle();
      if (existingForStore) {
        return json({ error: 'Esta empresa ya tiene un dominio configurado. Elimínalo antes de conectar otro.' }, 409);
      }

      const { data: hostnameOwner } = await adminClient
        .from('store_domains')
        .select('id')
        .eq('hostname', hostname)
        .maybeSingle();
      if (hostnameOwner) return json({ error: 'Este dominio ya está conectado a otra empresa.' }, 409);

      let addedToVercel = false;
      let projectDomain: VercelProjectDomain;
      try {
        projectDomain = await vercelRequest<VercelProjectDomain>(
          `/v10/projects/${encodeURIComponent(vercelProjectId)}/domains`,
          { method: 'POST', body: JSON.stringify({ name: hostname }) },
          vercelToken,
          vercelTeamId,
        );
        addedToVercel = true;
      } catch (error) {
        if (!(error instanceof VercelApiError) || error.status !== 400) throw error;
        projectDomain = await getProjectDomain(hostname);
      }

      const config = await getDomainConfig(hostname);
      const state = domainState(projectDomain, config);
      const now = new Date().toISOString();
      const { data: created, error: createError } = await adminClient
        .from('store_domains')
        .insert({
          store_id: body.storeId,
          hostname,
          status: state.status,
          is_primary: true,
          dns_record_type: state.dnsRecordType,
          dns_target: state.dnsTarget,
          provider: 'vercel',
          provider_hostname_id: projectDomain.projectId || vercelProjectId,
          ownership_verification_name: state.ownershipName,
          ownership_verification_value: state.ownershipValue,
          ssl_validation_records: state.validationRecords,
          failure_reason: null,
          last_checked_at: now,
          verified_at: projectDomain.verified ? now : null,
          activated_at: state.status === 'active' ? now : null,
        })
        .select('*')
        .single();

      if (createError || !created) {
        if (addedToVercel) {
          await vercelRequest<null>(
            `/v9/projects/${encodeURIComponent(vercelProjectId)}/domains/${encodeURIComponent(hostname)}`,
            { method: 'DELETE' },
            vercelToken,
            vercelTeamId,
          ).catch(() => undefined);
        }
        throw new Error(createError?.message ?? 'No se pudo guardar el dominio.');
      }
      return json({ domain: domainPayload(created as DomainRow) }, 201);
    }

    if (body.action === 'refresh') {
      if (!body.domainId) return json({ error: 'domainId es obligatorio.' }, 400);
      const configurationError = requireVercelConfiguration();
      if (configurationError) return configurationError;
      const loaded = await loadAuthorizedDomain(body.domainId);
      if (loaded instanceof Response) return loaded;
      if (loaded.last_checked_at) {
        const elapsedMs = Date.now() - new Date(loaded.last_checked_at).getTime();
        if (elapsedMs >= 0 && elapsedMs < 10_000) {
          return json({ domain: domainPayload(loaded) });
        }
      }

      await vercelRequest<VercelProjectDomain>(
        `/v9/projects/${encodeURIComponent(vercelProjectId)}/domains/${encodeURIComponent(loaded.hostname)}/verify`,
        { method: 'POST' },
        vercelToken,
        vercelTeamId,
      ).catch(() => undefined);

      const [projectDomain, config] = await Promise.all([
        getProjectDomain(loaded.hostname),
        getDomainConfig(loaded.hostname),
      ]);
      const state = domainState(projectDomain, config);
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await adminClient
        .from('store_domains')
        .update({
          status: state.status,
          dns_record_type: state.dnsRecordType,
          dns_target: state.dnsTarget,
          ownership_verification_name: state.ownershipName,
          ownership_verification_value: state.ownershipValue,
          ssl_validation_records: state.validationRecords,
          failure_reason: null,
          last_checked_at: now,
          verified_at: projectDomain.verified ? (loaded.verified_at ?? now) : loaded.verified_at,
          activated_at: state.status === 'active' ? (loaded.activated_at ?? now) : loaded.activated_at,
        })
        .eq('id', loaded.id)
        .select('*')
        .single();
      if (updateError || !updated) throw new Error(updateError?.message ?? 'No se pudo actualizar el dominio.');
      return json({ domain: domainPayload(updated as DomainRow) });
    }

    if (body.action === 'remove') {
      if (!body.domainId) return json({ error: 'domainId es obligatorio.' }, 400);
      const configurationError = requireVercelConfiguration();
      if (configurationError) return configurationError;
      const loaded = await loadAuthorizedDomain(body.domainId);
      if (loaded instanceof Response) return loaded;

      try {
        await vercelRequest<null>(
          `/v9/projects/${encodeURIComponent(vercelProjectId)}/domains/${encodeURIComponent(loaded.hostname)}`,
          { method: 'DELETE' },
          vercelToken,
          vercelTeamId,
        );
      } catch (error) {
        if (!(error instanceof VercelApiError) || error.status !== 404) throw error;
      }

      const { error: deleteError } = await adminClient
        .from('store_domains')
        .delete()
        .eq('id', loaded.id);
      if (deleteError) throw new Error(deleteError.message);
      return json({ removed: true });
    }

    return json({ error: 'Acción no reconocida.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ocurrió un error gestionando el dominio.';
    const status = error instanceof VercelApiError && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
    return json({ error: message }, status);
  }
});
