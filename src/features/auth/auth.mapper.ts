import type { ProfileRow } from '@/types/database.types';
import type { PlatformRole, UserStatus } from '@/types/common.types';
import type { Profile } from './auth.types';

export function mapProfileRowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone ?? null,
    documentType: row.document_type ?? null,
    documentNumber: row.document_number ?? null,
    platformRole: row.platform_role as PlatformRole,
    status: row.status as UserStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
