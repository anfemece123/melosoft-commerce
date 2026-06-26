import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, AuthUser, Profile } from './auth.types';

const initialState: AuthState = {
  user: null,
  profile: null,
  isAuthenticated: false,
  isBootstrapping: true,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.isAuthenticated = action.payload !== null;
      state.status = 'succeeded';
      state.error = null;
    },
    setProfile(state, action: PayloadAction<Profile | null>) {
      state.profile = action.payload;
    },
    setBootstrapping(state, action: PayloadAction<boolean>) {
      state.isBootstrapping = action.payload;
    },
    setAuthStatus(state, action: PayloadAction<AuthState['status']>) {
      state.status = action.payload;
    },
    setAuthError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = 'failed';
    },
    logout(state) {
      state.user = null;
      state.profile = null;
      state.isAuthenticated = false;
      state.status = 'idle';
      state.error = null;
      state.isBootstrapping = false;
    },
  },
});

export const {
  setUser,
  setProfile,
  setBootstrapping,
  setAuthStatus,
  setAuthError,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
