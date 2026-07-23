import {
  sanitizeMetaOAuthErrorMessage,
  type MetaOAuthError,
} from './metaOAuthDiagnostics.ts';

export type MetaTemplateSyncStage = 'template_lookup' | 'template_create';

export interface MetaTemplateSyncDiagnostic {
  stage: MetaTemplateSyncStage;
  templateName: string;
  upstreamStatus: number;
  metaCode: number | null;
  metaSubcode: number | null;
  metaType: string | null;
  metaMessage: string | null;
  traceId: string | null;
}

export function buildMetaTemplateSyncDiagnostic(
  stage: MetaTemplateSyncStage,
  templateName: string,
  upstreamStatus: number,
  error: MetaOAuthError | undefined,
): MetaTemplateSyncDiagnostic {
  return {
    stage,
    templateName: templateName.slice(0, 512),
    upstreamStatus,
    metaCode: typeof error?.code === 'number' ? error.code : null,
    metaSubcode: typeof error?.error_subcode === 'number' ? error.error_subcode : null,
    metaType: typeof error?.type === 'string' ? error.type.slice(0, 100) : null,
    metaMessage: sanitizeMetaOAuthErrorMessage(error?.message),
    traceId: typeof error?.fbtrace_id === 'string' ? error.fbtrace_id.slice(0, 200) : null,
  };
}
