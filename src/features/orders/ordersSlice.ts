import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Order, OrdersState } from './orders.types';

const initialState: OrdersState = {
  items: [],
  current: null,
  status: 'idle',
  error: null,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrders(state, action: PayloadAction<Order[]>) {
      state.items = action.payload;
      state.status = 'succeeded';
    },
    setCurrentOrder(state, action: PayloadAction<Order | null>) {
      state.current = action.payload;
    },
    addOrder(state, action: PayloadAction<Order>) {
      state.items.unshift(action.payload);
    },
    updateOrder(state, action: PayloadAction<Order>) {
      const index = state.items.findIndex((o) => o.id === action.payload.id);
      if (index !== -1) state.items[index] = action.payload;
      if (state.current?.id === action.payload.id) state.current = action.payload;
    },
    setOrdersStatus(state, action: PayloadAction<OrdersState['status']>) {
      state.status = action.payload;
    },
    setOrdersError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = 'failed';
    },
  },
});

export const {
  setOrders,
  setCurrentOrder,
  addOrder,
  updateOrder,
  setOrdersStatus,
  setOrdersError,
} = ordersSlice.actions;

export default ordersSlice.reducer;
