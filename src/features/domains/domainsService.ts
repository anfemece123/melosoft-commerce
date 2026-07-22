import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { normalizeStorefrontRootDomain } from '@/lib/storefront/storefrontSubdomains';
import type {
  DomainManagementResponse,
  PublicDomainResolution,
  StoreDomain,
} from './domains.types';

interface FunctionErrorWithContext extends Error {
  context?: Response;
}

function hasResponseContext(error: unknown): error is FunctionErrorWithContext {
  if (!(error instanceof Error) || typeof error !== 'object' || error === null) return false;
  return 'context' in error && (error as FunctionErrorWithContext).context instanceof Response;
}

async function domainFunction(
  body: Record<string, string>,
): Promise<DomainManagementResponse> {
  const { data, error } = await supabase.functions.invoke<DomainManagementResponse>(
    'manage-store-domain',
    { body },
  );

  if (error) {
    if (hasResponseContext(error) && error.context) {
      let contextMessage: string | null = null;
      try {
        const payload = await error.context.clone().json() as { error?: string };
        contextMessage = payload.error ?? null;
      } catch {
        // Fall back to the SDK error below if the response is not JSON.
      }
      if (contextMessage) throw new Error(contextMessage);
    }
    throw new Error(error.message);
  }

  return data ?? {};
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '');
}

export const domainsService = {
  async list(storeId: string): Promise<StoreDomain[]> {
    const response = await domainFunction({ action: 'list', storeId });
    return response.domains ?? [];
  },

  async connect(storeId: string, hostname: string): Promise<StoreDomain> {
    const response = await domainFunction({
      action: 'connect',
      storeId,
      hostname: normalizeHostname(hostname),
    });
    if (!response.domain) throw new Error('No se recibió la configuración del dominio.');
    return response.domain;
  },

  async refresh(domainId: string): Promise<StoreDomain> {
    const response = await domainFunction({ action: 'refresh', domainId });
    if (!response.domain) throw new Error('No se recibió el estado del dominio.');
    return response.domain;
  },

  async remove(domainId: string): Promise<void> {
    await domainFunction({ action: 'remove', domainId });
  },

  async resolvePublicHostname(hostname: string): Promise<PublicDomainResolution | null> {
    const { data, error } = await supabase.rpc('resolve_store_domain', {
      p_hostname: normalizeHostname(hostname),
    });
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) return null;
    return {
      storeId: row.store_id,
      storeSlug: row.store_slug,
      storeName: row.store_name,
      hostname: row.hostname,
    };
  },

  async resolvePublicSubdomain(
    storeSlug: string,
    hostname: string,
  ): Promise<PublicDomainResolution | null> {
    const { data, error } = await supabase.rpc('resolve_store_subdomain', {
      p_slug: storeSlug.trim().toLowerCase(),
    });
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) return null;
    return {
      storeId: row.store_id,
      storeSlug: row.store_slug,
      storeName: row.store_name,
      hostname: normalizeHostname(hostname),
    };
  },

  getPlatformStoreUrl(storeSlug: string): string {
    const rootDomain = normalizeStorefrontRootDomain(env.storefrontRootDomain);
    if (rootDomain) return `https://${storeSlug}.${rootDomain}`;
    const baseUrl = env.publicSiteUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
    return `${baseUrl.replace(/\/$/, '')}/s/${storeSlug}`;
  },

  // Single place that decides the preferred public URL for a store: an
  // active, verified custom domain wins over the included subdomain/`/s/`
  // fallback. Callers should stop building `https://${hostname}` inline —
  // pass the domains list already loaded for the store instead.
  getStorePublicUrl(storeSlug: string, domains?: StoreDomain[] | null): string {
    const activePrimary = domains?.find((domain) => domain.isPrimary && domain.status === 'active');
    if (activePrimary) return `https://${activePrimary.hostname}`;
    return this.getPlatformStoreUrl(storeSlug);
  },
};
