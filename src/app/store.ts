import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import storesReducer from '@/features/stores/storesSlice';
import productsReducer from '@/features/products/productsSlice';
import offersReducer from '@/features/offers/offersSlice';
import ordersReducer from '@/features/orders/ordersSlice';
import paymentsReducer from '@/features/payments/paymentsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    stores: storesReducer,
    products: productsReducer,
    offers: offersReducer,
    orders: ordersReducer,
    payments: paymentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
