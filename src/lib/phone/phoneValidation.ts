export const COLOMBIAN_PHONE_LOCAL_DIGITS = 10;
export const COLOMBIAN_PHONE_WITH_COUNTRY_CODE_DIGITS = 12;

export const PHONE_DIGITS_ONLY_MESSAGE = 'Usa únicamente números, sin letras ni símbolos';
export const COLOMBIAN_MOBILE_MESSAGE =
  'Ingresa un celular colombiano válido de 10 dígitos, por ejemplo 3001234567';
export const COLOMBIAN_CONTACT_PHONE_MESSAGE =
  'Ingresa un teléfono colombiano válido de 10 dígitos';

/**
 * Keeps phone controls deterministic on desktop and mobile. Browsers do not
 * enforce digits-only input for type="tel", so every controlled field must
 * sanitize before updating form state.
 */
export function sanitizePhoneInput(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, COLOMBIAN_PHONE_WITH_COUNTRY_CODE_DIGITS);
}

/** Returns the canonical 10-digit Colombian mobile, or null when uncertain. */
export function normalizeColombianMobile(value: string | null | undefined): string | null {
  const candidate = value?.trim() ?? '';
  if (!/^\d+$/.test(candidate)) return null;

  if (/^3\d{9}$/.test(candidate)) return candidate;
  if (/^573\d{9}$/.test(candidate)) return candidate.slice(2);
  return null;
}

export function isValidColombianMobile(value: string | null | undefined): boolean {
  return normalizeColombianMobile(value) !== null;
}

/**
 * Contact numbers may be either a mobile or a Colombian fixed line in the
 * current 60 + area-code + 7-digit format. A leading country code is accepted
 * but storage can still normalize it to the national 10-digit representation.
 */
export function normalizeColombianContactPhone(value: string | null | undefined): string | null {
  const candidate = value?.trim() ?? '';
  if (!/^\d+$/.test(candidate)) return null;

  const national = candidate.startsWith('57') && candidate.length === 12
    ? candidate.slice(2)
    : candidate;

  if (/^3\d{9}$/.test(national) || /^60[1-8]\d{7}$/.test(national)) {
    return national;
  }
  return null;
}

export function isValidColombianContactPhone(value: string | null | undefined): boolean {
  return normalizeColombianContactPhone(value) !== null;
}
