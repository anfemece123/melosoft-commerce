import type { Profile } from '@/features/auth/auth.types';
import type { StoreMember } from '@/features/stores/stores.types';
import type { StoreMemberRole } from '@/types/common.types';

// ── Platform-level helpers ───────────────────────────────────

export function isPlatformAdmin(profile: Profile | null): boolean {
  return profile?.platformRole === 'platform_admin' && profile.status === 'active';
}

export function canAccessPlatformAdmin(profile: Profile | null): boolean {
  return isPlatformAdmin(profile);
}

// ── Store-level helpers ──────────────────────────────────────

function findMembership(
  memberships: StoreMember[],
  storeId: string
): StoreMember | undefined {
  return memberships.find((m) => m.storeId === storeId && m.status === 'active');
}

function hasRole(
  membership: StoreMember | undefined,
  roles: StoreMemberRole[]
): boolean {
  return membership !== undefined && roles.includes(membership.role);
}

export function canAccessStore(
  profile: Profile | null,
  memberships: StoreMember[],
  storeId: string
): boolean {
  if (isPlatformAdmin(profile)) return true;
  return findMembership(memberships, storeId) !== undefined;
}

export function canManageStore(
  profile: Profile | null,
  memberships: StoreMember[],
  storeId: string
): boolean {
  if (isPlatformAdmin(profile)) return true;
  return hasRole(findMembership(memberships, storeId), ['owner', 'admin']);
}

export function canManageStoreSettings(
  profile: Profile | null,
  memberships: StoreMember[],
  storeId: string
): boolean {
  return canManageStore(profile, memberships, storeId);
}

export function canManageCatalog(
  profile: Profile | null,
  memberships: StoreMember[],
  storeId: string
): boolean {
  if (isPlatformAdmin(profile)) return true;
  return hasRole(findMembership(memberships, storeId), ['owner', 'admin', 'staff']);
}

export function canManageOffers(
  profile: Profile | null,
  memberships: StoreMember[],
  storeId: string
): boolean {
  return canManageCatalog(profile, memberships, storeId);
}

export function canManageOrders(
  profile: Profile | null,
  memberships: StoreMember[],
  storeId: string
): boolean {
  return canManageCatalog(profile, memberships, storeId);
}

export function canManagePayments(
  profile: Profile | null,
  memberships: StoreMember[],
  storeId: string
): boolean {
  return canManageStore(profile, memberships, storeId);
}

export function canManageStoreMembers(
  profile: Profile | null,
  memberships: StoreMember[],
  storeId: string
): boolean {
  return canManageStore(profile, memberships, storeId);
}

export function canViewStore(
  profile: Profile | null,
  memberships: StoreMember[],
  storeId: string
): boolean {
  return canAccessStore(profile, memberships, storeId);
}
