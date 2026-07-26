import {
  sanitizeMetaOAuthErrorMessage,
  type MetaOAuthError,
} from './metaOAuthDiagnostics.ts';

export interface MetaPhoneRegistrationResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

export interface MetaPhoneRegistrationDiagnostic {
  upstreamStatus: number;
  metaCode: number | null;
  metaSubcode: number | null;
  metaType: string | null;
  metaMessage: string | null;
  metaUserTitle: string | null;
  metaUserMessage: string | null;
  traceId: string | null;
}

interface MetaRegistrationErrorBody {
  error?: MetaOAuthError;
}

export function generateWhatsappRegistrationPin(
  randomValue: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0],
): string {
  const value = randomValue();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid registration PIN entropy');
  }
  return String(100_000 + (value % 900_000));
}

export function isValidWhatsappRegistrationPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function registerWhatsappPhone(params: {
  graphApiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  pin: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaPhoneRegistrationResult> {
  if (!isValidWhatsappRegistrationPin(params.pin)) {
    throw new Error('INVALID_REGISTRATION_PIN');
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/${params.graphApiVersion}/${encodeURIComponent(params.phoneNumberId)}/register`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin: params.pin }),
        signal: controller.signal,
      },
    );
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: {} };
  } finally {
    clearTimeout(timeout);
  }
}

function boundedText(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null;
}

export function buildMetaPhoneRegistrationDiagnostic(
  result: MetaPhoneRegistrationResult,
): MetaPhoneRegistrationDiagnostic {
  const error = (result.body as MetaRegistrationErrorBody).error;
  return {
    upstreamStatus: result.status,
    metaCode: typeof error?.code === 'number' ? error.code : null,
    metaSubcode: typeof error?.error_subcode === 'number' ? error.error_subcode : null,
    metaType: boundedText(error?.type, 100),
    metaMessage: sanitizeMetaOAuthErrorMessage(error?.message),
    metaUserTitle: sanitizeMetaOAuthErrorMessage(error?.error_user_title)?.slice(0, 300) ?? null,
    metaUserMessage: sanitizeMetaOAuthErrorMessage(error?.error_user_msg),
    traceId: boundedText(error?.fbtrace_id, 200),
  };
}

// Meta uses error 133005 for a two-step verification PIN mismatch. Keep
// the text fallback because some Graph API versions expose the same cause
// only through the localized user-facing fields.
export function registrationRequiresExistingPin(
  diagnostic: MetaPhoneRegistrationDiagnostic,
): boolean {
  if (diagnostic.metaCode === 133005 || diagnostic.metaSubcode === 133005) return true;
  const detail = [
    diagnostic.metaMessage,
    diagnostic.metaUserTitle,
    diagnostic.metaUserMessage,
  ].filter(Boolean).join(' ').toLowerCase();
  return detail.includes('pin') && (
    detail.includes('two-step') ||
    detail.includes('two step') ||
    detail.includes('dos pasos') ||
    detail.includes('incorrect') ||
    detail.includes('mismatch')
  );
}
