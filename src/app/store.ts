import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import storesReducer from '@/features/stores/storesSlice';
import ordersReducer from '@/features/orders/ordersSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    stores: storesReducer,
    orders: ordersReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
