const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';
const PG_CHECK_VIOLATION = '23514';

const CONSTRAINT_MESSAGES: Record<string, string> = {
  stores_slug_global_unique:
    'Esa dirección pública ya está siendo usada por otra empresa. Elige una diferente.',
  stores_slug_subdomain_safe:
    'La dirección debe usar letras minúsculas, números o guiones, sin guiones al inicio o al final.',
  stores_slug_not_reserved:
    'Esa dirección está reservada por la plataforma. Elige una diferente.',
  products_store_slug_unique:
    'Ya existe un producto o plato con ese slug en esta tienda. Cambia el nombre o usa un slug diferente.',
  offers_store_slug_unique:
    'Ya existe una oferta con ese slug en esta tienda.',
  store_members_unique:
    'Este usuario ya es miembro de la tienda.',
};

interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

function isSupabaseError(err: unknown): err is SupabaseError {
  return typeof err === 'object' && err !== null && 'message' in err;
}

export function mapSupabaseError(err: unknown): string {
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'Sin conexión. Verifica tu internet e intenta de nuevo.';
  }

  if (!isSupabaseError(err)) {
    if (err instanceof Error) return err.message;
    return 'Error desconocido.';
  }

  const { message, code, details } = err;

  if (code === PG_UNIQUE_VIOLATION) {
    const searchIn = `${message} ${details ?? ''}`;
    for (const [constraint, msg] of Object.entries(CONSTRAINT_MESSAGES)) {
      if (searchIn.includes(constraint)) return msg;
    }
    return 'Este valor ya existe. Usa uno diferente.';
  }

  if (code === PG_FOREIGN_KEY_VIOLATION) {
    return 'No se puede completar la operación porque hay datos relacionados.';
  }

  if (code === PG_NOT_NULL_VIOLATION) {
    return 'Faltan campos obligatorios. Revisa el formulario.';
  }

  if (code === PG_CHECK_VIOLATION) {
    const searchIn = `${message} ${details ?? ''}`;
    for (const [constraint, msg] of Object.entries(CONSTRAINT_MESSAGES)) {
      if (searchIn.includes(constraint)) return msg;
    }
    return 'Uno de los valores ingresados no es válido. Revisa los campos.';
  }

  if (message.includes('JWT') || message.includes('token') || message.includes('session')) {
    return 'Tu sesión ha expirado. Por favor vuelve a iniciar sesión.';
  }

  if (
    message.includes('permission denied') ||
    message.includes('violates row-level security') ||
    message.includes('new row violates row-level security')
  ) {
    return 'No tienes permisos para realizar esta acción.';
  }

  if (message.includes('Bucket not found')) {
    return 'El almacenamiento no está configurado correctamente.';
  }
  if (message.includes('The resource already exists')) {
    return 'Ya existe un archivo con ese nombre. Intenta subir de nuevo.';
  }
  if (message.includes('Payload too large') || message.includes('exceeded')) {
    return 'El archivo es demasiado grande.';
  }
  if (message.toLowerCase().includes('invalid mime type') || message.toLowerCase().includes('mime')) {
    return 'Tipo de archivo no permitido. Usa JPG, PNG o WebP.';
  }

  if (message.includes('PGRST116')) {
    return 'No se encontró el recurso solicitado.';
  }

  if (message.includes('products_store_slug_unique') ||
      (message.includes('duplicate key') && message.includes('slug'))) {
    return CONSTRAINT_MESSAGES['products_store_slug_unique'];
  }

  const cleaned = message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[ID]')
    .replace(/duplicate key value violates unique constraint "[^"]+"/gi, 'Este valor ya existe.')
    .replace(/null value in column "[^"]+" of relation "[^"]+" violates not-null constraint/gi, 'Campo obligatorio vacío.')
    .trim();

  return cleaned || 'Ocurrió un error inesperado. Intenta de nuevo.';
}
