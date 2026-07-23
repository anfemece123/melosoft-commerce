export interface MetaOAuthError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export interface MetaTokenExchangeDiagnostic {
  stage: 'token_exchange';
  upstreamStatus: number;
  metaCode: number | null;
  metaSubcode: number | null;
  metaType: string | null;
  metaMessage: string | null;
  traceId: string | null;
}

const MAX_META_ERROR_MESSAGE_LENGTH = 500;

// Meta's OAuth errors normally contain only a human-readable explanation,
// but keep this response safe even if an upstream message unexpectedly
// echoes one of the credentials submitted in the query string.
export function sanitizeMetaOAuthErrorMessage(message: string | undefined): string | null {
  if (!message) return null;

  return message
    .replace(
      /([?&](?:client_secret|access_token|code)=)[^&\s]+/gi,
      '$1[redacted]',
    )
    .replace(
      /\b(client_secret|access_token|code)\b(\s*[:=]\s*)["']?[^,\s"']+["']?/gi,
      '$1$2[redacted]',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_META_ERROR_MESSAGE_LENGTH);
}

export function buildMetaTokenExchangeDiagnostic(
  upstreamStatus: number,
  error: MetaOAuthError | undefined,
): MetaTokenExchangeDiagnostic {
  return {
    stage: 'token_exchange',
    upstreamStatus,
    metaCode: typeof error?.code === 'number' ? error.code : null,
    metaSubcode: typeof error?.error_subcode === 'number' ? error.error_subcode : null,
    metaType: typeof error?.type === 'string' ? error.type.slice(0, 100) : null,
    metaMessage: sanitizeMetaOAuthErrorMessage(error?.message),
    traceId: typeof error?.fbtrace_id === 'string' ? error.fbtrace_id.slice(0, 200) : null,
  };
}
