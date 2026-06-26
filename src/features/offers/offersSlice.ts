import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Offer, OffersState } from './offers.types';

const initialState: OffersState = {
  items: [],
  current: null,
  status: 'idle',
  error: null,
};

const offersSlice = createSlice({
  name: 'offers',
  initialState,
  reducers: {
    setOffers(state, action: PayloadAction<Offer[]>) {
      state.items = action.payload;
      state.status = 'succeeded';
    },
    setCurrentOffer(state, action: PayloadAction<Offer | null>) {
      state.current = action.payload;
    },
    addOffer(state, action: PayloadAction<Offer>) {
      state.items.unshift(action.payload);
    },
    updateOffer(state, action: PayloadAction<Offer>) {
      const index = state.items.findIndex((o) => o.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
      if (state.current?.id === action.payload.id) {
        state.current = action.payload;
      }
    },
    removeOffer(state, action: PayloadAction<string>) {
      state.items = state.items.filter((o) => o.id !== action.payload);
    },
    setOffersStatus(state, action: PayloadAction<OffersState['status']>) {
      state.status = action.payload;
    },
    setOffersError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = 'failed';
    },
  },
});

export const {
  setOffers,
  setCurrentOffer,
  addOffer,
  updateOffer,
  removeOffer,
  setOffersStatus,
  setOffersError,
} = offersSlice.actions;

export default offersSlice.reducer;
