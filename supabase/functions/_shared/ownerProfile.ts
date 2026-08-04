export interface OwnerProfileInput {
  userId: string;
  email: string;
  fullName: string;
  phone: string;
  documentType: string | null;
  documentNumber: string | null;
}

export function buildOwnerProfileUpsert(
  input: OwnerProfileInput,
  hasExistingProfile: boolean,
): Record<string, string | null> | null {
  // A profile belongs to the person, not to one store. Creating another store
  // for the same login must never overwrite their name/contact data or global
  // platform role/status.
  if (hasExistingProfile) return null;

  return {
    user_id: input.userId,
    email: input.email,
    full_name: input.fullName,
    phone: input.phone,
    document_type: input.documentType,
    document_number: input.documentNumber,
    updated_at: new Date().toISOString(),
  };
}
