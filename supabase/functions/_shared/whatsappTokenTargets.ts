export interface MetaDebugTokenData {
  app_id?: string | number;
  is_valid?: boolean;
  granular_scopes?: Array<{ scope?: string; target_ids?: Array<string | number> }>;
}

export type WhatsappWabaResolution =
  | { ok: true; wabaId: string }
  | { ok: false; reason: 'invalid_token' | 'missing_targets' | 'multiple_targets'; candidateCount: number };

export function resolveSingleWhatsappWaba(
  data: MetaDebugTokenData | undefined,
  expectedAppId: string,
): WhatsappWabaResolution {
  if (!data || data.is_valid !== true || String(data.app_id ?? '') !== expectedAppId) {
    return { ok: false, reason: 'invalid_token', candidateCount: 0 };
  }

  const scopes = data.granular_scopes ?? [];
  const targetsFor = (scopeName: string) => scopes
    .filter((scope) => scope.scope === scopeName)
    .flatMap((scope) => scope.target_ids ?? [])
    .map(String)
    .map((target) => target.trim())
    .filter(Boolean);

  // Management targets identify the WABA. Messaging targets are the
  // fallback for Meta responses that omit management targets.
  const managementTargets = targetsFor('whatsapp_business_management');
  const messagingTargets = targetsFor('whatsapp_business_messaging');
  const candidates = [...new Set(managementTargets.length > 0 ? managementTargets : messagingTargets)];

  if (candidates.length === 1) return { ok: true, wabaId: candidates[0] };
  return {
    ok: false,
    reason: candidates.length === 0 ? 'missing_targets' : 'multiple_targets',
    candidateCount: candidates.length,
  };
}
