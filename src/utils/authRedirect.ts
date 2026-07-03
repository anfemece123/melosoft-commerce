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
  if (active.length === 1) return `/admin/stores/${active[0].storeId}`;

  // Multiple stores → let the user pick
  return '/admin/my-stores';
}
