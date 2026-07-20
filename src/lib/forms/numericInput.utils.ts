/**
 * Shared parsing/validation for every "type as you go" numeric form field
 * in the app (IntegerInput, MoneyInput's raw-digit stripping, Home Builder
 * wizard limits, stock/quantity inputs, modifier price deltas). The single
 * rule this file exists to enforce: an empty field is `''`, never `0` —
 * `Number('')` is `0` in JS, so every call site that used to write
 * `Number(e.target.value) || 0` or relied on `Number.isFinite` alone was
 * silently turning "cleared the input" into "set it to zero".
 */
export type NumericFieldValue = number | '';

/** Strips non-digits and collapses leading zeros ("0008" -> "8", "000" ->
 * "0", a lone "0" is preserved). Never returns a value with a leading zero
 * followed by another digit. */
export function normalizeIntegerDigits(raw: string): string {
  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (digitsOnly === '') return '';
  return digitsOnly.replace(/^0+(?=\d)/, '');
}

/** Raw input text -> field value. Empty/non-numeric text becomes `''`,
 * never `0` — the field simply has no value yet, which is a distinct state
 * from "the user typed zero". */
export function parseIntegerFieldValue(raw: string): NumericFieldValue {
  const normalized = normalizeIntegerDigits(raw);
  return normalized === '' ? '' : Number(normalized);
}

export interface IntegerRangeOptions {
  min?: number;
  max?: number;
  /** @default true */
  required?: boolean;
  /** Used in the generated message, e.g. "Límite debe ser al menos 4." */
  label?: string;
}

/** Returns a human-readable error, or null when the value is valid. Used at
 * save/blur time — never silently clamps, since a silent clamp hides the
 * mistake a required-field error would otherwise surface (e.g. typing 25
 * for a 4-24 range should tell the owner "máximo 24", not quietly become
 * 24 behind their back). */
export function validateIntegerField(value: NumericFieldValue, options: IntegerRangeOptions = {}): string | null {
  const { min, max, required = true, label = 'Este campo' } = options;
  if (value === '') return required ? `${label} es obligatorio.` : null;
  if (!Number.isFinite(value)) return `${label} no es válido.`;
  if (min !== undefined && value < min) return `${label} debe ser mayor o igual a ${min}.`;
  if (max !== undefined && value > max) return `${label} debe ser menor o igual a ${max}.`;
  return null;
}

/** Only for fields that genuinely want a silent clamp instead of a visible
 * error (rare — prefer validateIntegerField's message wherever the user
 * can plausibly type an out-of-range number on purpose). Falls back to
 * `fallback` (default `min`) for '' or non-finite input. */
export function clampIntegerField(value: NumericFieldValue, min: number, max: number, fallback = min): number {
  if (value === '' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
