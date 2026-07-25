export const OWNER_PASSWORD_MIN_LENGTH = 12;
export const OWNER_PASSWORD_MAX_LENGTH = 72;

const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const NUMBERS = '23456789';
const SYMBOLS = '!@#$%&*+-=?';
const ALL_CHARACTERS = `${LOWERCASE}${UPPERCASE}${NUMBERS}${SYMBOLS}`;

function secureRandomIndex(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error('El rango aleatorio debe ser positivo.');
  const uint32Range = 0x100000000;
  const limit = uint32Range - (uint32Range % maxExclusive);
  const value = new Uint32Array(1);

  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);

  return value[0] % maxExclusive;
}

function randomCharacter(characters: string): string {
  return characters[secureRandomIndex(characters.length)];
}

export function getOwnerPasswordValidationError(password: string): string | null {
  if (password.length < OWNER_PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${OWNER_PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (password.length > OWNER_PASSWORD_MAX_LENGTH) {
    return `La contraseña no puede superar ${OWNER_PASSWORD_MAX_LENGTH} caracteres`;
  }
  if (!/[a-z]/.test(password)) return 'Incluye al menos una letra minúscula';
  if (!/[A-Z]/.test(password)) return 'Incluye al menos una letra mayúscula';
  if (!/[0-9]/.test(password)) return 'Incluye al menos un número';
  if (!/[^A-Za-z0-9\s]/.test(password)) return 'Incluye al menos un símbolo';
  return null;
}

export function generateSecureOwnerPassword(length = 16): string {
  if (length < OWNER_PASSWORD_MIN_LENGTH || length > OWNER_PASSWORD_MAX_LENGTH) {
    throw new Error(
      `La longitud debe estar entre ${OWNER_PASSWORD_MIN_LENGTH} y ${OWNER_PASSWORD_MAX_LENGTH} caracteres.`
    );
  }

  const characters = [
    randomCharacter(LOWERCASE),
    randomCharacter(UPPERCASE),
    randomCharacter(NUMBERS),
    randomCharacter(SYMBOLS),
  ];

  while (characters.length < length) {
    characters.push(randomCharacter(ALL_CHARACTERS));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join('');
}
