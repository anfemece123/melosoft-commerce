import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { PaymentProvider, StorePaymentSettings, PaymentTransaction, PaymentsState } from './payments.types';

const initialState: PaymentsState = {
  providers: [],
  settings: null,
  transactions: [],
  status: 'idle',
  error: null,
};

const paymentsSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {
    setProviders(state, action: PayloadAction<PaymentProvider[]>) {
      state.providers = action.payload;
    },
    setPaymentSettings(state, action: PayloadAction<StorePaymentSettings | null>) {
      state.settings = action.payload;
    },
    setTransactions(state, action: PayloadAction<PaymentTransaction[]>) {
      state.transactions = action.payload;
    },
    setPaymentsStatus(state, action: PayloadAction<PaymentsState['status']>) {
      state.status = action.payload;
    },
    setPaymentsError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = 'failed';
    },
  },
});

export const {
  setProviders,
  setPaymentSettings,
  setTransactions,
  setPaymentsStatus,
  setPaymentsError,
} = paymentsSlice.actions;

export default paymentsSlice.reducer;
