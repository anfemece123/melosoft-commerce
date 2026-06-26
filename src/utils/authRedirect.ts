import type { Profile } from '@/features/auth/auth.types';
import type { StoreMember } from '@/features/stores/stores.types';
import { isPlatformAdmin } from './permissions';

export function getPostLoginRedirect(
  profile: Profile | null,
  memberships: StoreMember[]
): string {
  if (isPlatformAdmin(profile)) return '/admin';

  const active = memberships.filter((m) => m.status === 'active');
  if (active.length === 0) return '/access-denied';

  // Prefer owner role, fallback to first active membership
  const target = active.find((m) => m.role === 'owner') ?? active[0];
  return `/admin/stores/${target.storeId}`;
}
