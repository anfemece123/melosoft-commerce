import type { RootState } from '@/app/store';
import {
  canManageCatalog,
  canManageOrders,
  canManageStoreSettings,
} from '@/utils/permissions';

export const selectCurrentStore = (state: RootState) => state.stores.current;
export const selectCurrentStoreId = (state: RootState) => state.stores.current?.id ?? null;
export const selectCurrentCommerceSettings = (state: RootState) => state.stores.currentCommerceSettings;

// Maps to state.stores.currentLimits — named "BusinessLimits" to match the
// plan-limits concept (max products/staff/offers, Wompi eligibility, etc.).
export const selectCurrentBusinessLimits = (state: RootState) => state.stores.currentLimits;

export const selectMyMemberships = (state: RootState) => state.stores.myMemberships;

export const selectCurrentStoreMembership = (state: RootState, storeId: string | undefined) => {
  if (!storeId) return undefined;
  return state.stores.myMemberships.find(
    (m) => m.storeId === storeId && m.status === 'active'
  );
};

// Permission selectors — thin wrappers around utils/permissions.ts. They do
// not store or duplicate permission state; they just save call sites from
// repeating `useAppSelector(s => s.auth.profile)` + `useAppSelector(s =>
// s.stores.myMemberships)` at every usage.
export const selectCanManageProducts = (state: RootState, storeId: string | undefined): boolean =>
  Boolean(storeId) && canManageCatalog(state.auth.profile, state.stores.myMemberships, storeId as string);

export const selectCanManageOrders = (state: RootState, storeId: string | undefined): boolean =>
  Boolean(storeId) && canManageOrders(state.auth.profile, state.stores.myMemberships, storeId as string);

export const selectCanManageSettings = (state: RootState, storeId: string | undefined): boolean =>
  Boolean(storeId) && canManageStoreSettings(state.auth.profile, state.stores.myMemberships, storeId as string);
