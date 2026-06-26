import type { AsyncStatus, PlatformRole, UserStatus } from '@/types/common.types';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  platformRole: PlatformRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  status: AsyncStatus;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
