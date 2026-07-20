import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { logout } from '@/features/auth/authSlice';
import type { Store, StoreMember, StoreLimit, StoreLocation, StoreBusinessHour, StoresState } from './stores.types';
import type { StoreCommerceSettings } from './storeCommerce.types';

const initialState: StoresState = {
  items: [],
  current: null,
  currentMembers: [],
  currentLimits: null,
  currentLocation: null,
  currentBusinessHours: [],
  currentCommerceSettings: null,
  myMemberships: [],
  status: 'idle',
  error: null,
};

const storesSlice = createSlice({
  name: 'stores',
  initialState,
  reducers: {
    setStores(state, action: PayloadAction<Store[]>) {
      state.items = action.payload;
      state.status = 'succeeded';
    },
    setCurrentStore(state, action: PayloadAction<Store | null>) {
      state.current = action.payload;
    },
    addStore(state, action: PayloadAction<Store>) {
      state.items.unshift(action.payload);
    },
    updateStore(state, action: PayloadAction<Store>) {
      const index = state.items.findIndex((s) => s.id === action.payload.id);
      if (index !== -1) state.items[index] = action.payload;
      if (state.current?.id === action.payload.id) state.current = action.payload;
    },
    removeStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((s) => s.id !== action.payload);
    },
    setCurrentMembers(state, action: PayloadAction<StoreMember[]>) {
      state.currentMembers = action.payload;
    },
    addMember(state, action: PayloadAction<StoreMember>) {
      state.currentMembers.push(action.payload);
    },
    updateMember(state, action: PayloadAction<StoreMember>) {
      const index = state.currentMembers.findIndex((m) => m.id === action.payload.id);
      if (index !== -1) state.currentMembers[index] = action.payload;
    },
    removeMember(state, action: PayloadAction<string>) {
      state.currentMembers = state.currentMembers.filter((m) => m.id !== action.payload);
    },
    setCurrentLimits(state, action: PayloadAction<StoreLimit | null>) {
      state.currentLimits = action.payload;
    },
    setCurrentLocation(state, action: PayloadAction<StoreLocation | null>) {
      state.currentLocation = action.payload;
    },
    setCurrentBusinessHours(state, action: PayloadAction<StoreBusinessHour[]>) {
      state.currentBusinessHours = action.payload;
    },
    setCurrentCommerceSettings(state, action: PayloadAction<StoreCommerceSettings | null>) {
      state.currentCommerceSettings = action.payload;
    },
    setMyMemberships(state, action: PayloadAction<StoreMember[]>) {
      state.myMemberships = action.payload;
    },
    setStoresStatus(state, action: PayloadAction<StoresState['status']>) {
      state.status = action.payload;
    },
    setStoresError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = 'failed';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, (state) => {
      state.items = [];
      state.current = null;
      state.currentMembers = [];
      state.currentLimits = null;
      state.currentLocation = null;
      state.currentBusinessHours = [];
      state.currentCommerceSettings = null;
      state.myMemberships = [];
      state.status = 'idle';
      state.error = null;
    });
  },
});

export const {
  setStores,
  setCurrentStore,
  addStore,
  updateStore,
  removeStore,
  setCurrentMembers,
  addMember,
  updateMember,
  removeMember,
  setCurrentLimits,
  setCurrentLocation,
  setCurrentBusinessHours,
  setCurrentCommerceSettings,
  setMyMemberships,
  setStoresStatus,
  setStoresError,
} = storesSlice.actions;

export default storesSlice.reducer;
