export type MetaManagementPermissionStatus =
  | 'granted'
  | 'declined'
  | 'expired'
  | 'missing'
  | 'unknown';

export interface MetaTemplatePermissionContext {
  managementPermission: MetaManagementPermissionStatus;
  permissionQueryStatus: number;
  wabaQueryStatus: number;
  waba: {
    accountReviewStatus: string | null;
    businessVerificationStatus: string | null;
    ownershipType: string | null;
    country: string | null;
  };
}

interface MetaPermissionEntry {
  permission?: unknown;
  status?: unknown;
}

function boundedString(value: unknown, maxLength = 100): string | null {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) || null : null;
}

function managementPermissionStatus(
  permissionsBody: Record<string, unknown>,
  querySucceeded: boolean,
): MetaManagementPermissionStatus {
  if (!querySucceeded) return 'unknown';

  const permissions = Array.isArray(permissionsBody.data)
    ? permissionsBody.data as MetaPermissionEntry[]
    : [];
  const managementPermission = permissions.find(
    (entry) => entry.permission === 'whatsapp_business_management',
  );
  if (!managementPermission) return 'missing';

  const status = boundedString(managementPermission.status)?.toLowerCase();
  if (status === 'granted') return 'granted';
  if (status === 'declined') return 'declined';
  if (status === 'expired') return 'expired';
  return 'unknown';
}

export function buildMetaTemplatePermissionContext(
  permissionsResult: {
    ok: boolean;
    status: number;
    body: Record<string, unknown>;
  },
  wabaResult: {
    ok: boolean;
    status: number;
    body: Record<string, unknown>;
  },
): MetaTemplatePermissionContext {
  return {
    managementPermission: managementPermissionStatus(
      permissionsResult.body,
      permissionsResult.ok,
    ),
    permissionQueryStatus: permissionsResult.status,
    wabaQueryStatus: wabaResult.status,
    waba: {
      accountReviewStatus: wabaResult.ok
        ? boundedString(wabaResult.body.account_review_status)
        : null,
      businessVerificationStatus: wabaResult.ok
        ? boundedString(wabaResult.body.business_verification_status)
        : null,
      ownershipType: wabaResult.ok
        ? boundedString(wabaResult.body.ownership_type)
        : null,
      country: wabaResult.ok
        ? boundedString(wabaResult.body.country)
        : null,
    },
  };
}
