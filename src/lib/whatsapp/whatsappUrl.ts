const COLOMBIA_CALLING_CODE = '57';

function isColombianCountry(country: string | null | undefined): boolean {
  if (!country) return true;
  const normalized = country.trim().toLowerCase();
  return normalized === 'co' || normalized === 'col' || normalized === 'colombia' || normalized === 'columbia';
}

/** Returns the digits-only international number required by wa.me.
 *
 * Store contact fields currently accept Colombian national numbers. A local
 * `3185839777` must therefore become `573185839777`; numbers already saved as
 * `57...`, `+57...` or `0057...` remain idempotent. Unknown international
 * numbers are preserved only when they already include a plausible country
 * code, avoiding accidental links such as +31 for a Colombian mobile. */
export function normalizePhoneForWhatsApp(
  phone: string | null | undefined,
  country: string | null | undefined = 'CO',
): string | null {
  const raw = phone?.trim() ?? '';
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) return null;

  if (isColombianCountry(country)) {
    if (digits.startsWith(COLOMBIA_CALLING_CODE) && digits.length === 12) return digits;
    if (digits.length === 10 && (/^3/.test(digits) || /^60/.test(digits))) {
      return `${COLOMBIA_CALLING_CODE}${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      const national = digits.slice(1);
      if (/^3/.test(national) || /^60/.test(national)) {
        return `${COLOMBIA_CALLING_CODE}${national}`;
      }
    }
  }

  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

export function buildWhatsAppContactUrl(
  phone: string | null | undefined,
  message?: string | null,
  country: string | null | undefined = 'CO',
): string | null {
  const normalized = normalizePhoneForWhatsApp(phone, country);
  if (!normalized) return null;
  const baseUrl = `https://wa.me/${normalized}`;
  return message?.trim() ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}
