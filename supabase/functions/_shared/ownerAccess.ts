export const OWNER_PASSWORD_MIN_LENGTH = 12;
export const OWNER_PASSWORD_MAX_LENGTH = 72;

export function ownerPasswordValidationError(password: string): string | null {
  if (password.length < OWNER_PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${OWNER_PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > OWNER_PASSWORD_MAX_LENGTH) {
    return `La contraseña no puede superar ${OWNER_PASSWORD_MAX_LENGTH} caracteres.`;
  }
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir una letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir una letra mayúscula.';
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir un número.';
  if (!/[^A-Za-z0-9\s]/.test(password)) return 'La contraseña debe incluir un símbolo.';
  return null;
}
