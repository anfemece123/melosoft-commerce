import type { RootState } from '@/app/store';
import { isPlatformAdmin } from '@/utils/permissions';

export const selectAuthUser = (state: RootState) => state.auth.user;
export const selectAuthProfile = (state: RootState) => state.auth.profile;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectIsBootstrapping = (state: RootState) => state.auth.isBootstrapping;

export const selectIsPlatformAdmin = (state: RootState): boolean =>
  isPlatformAdmin(state.auth.profile);
