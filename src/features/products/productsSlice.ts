import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Product, ProductsState } from './products.types';

const initialState: ProductsState = {
  items: [],
  current: null,
  status: 'idle',
  error: null,
};

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setProducts(state, action: PayloadAction<Product[]>) {
      state.items = action.payload;
      state.status = 'succeeded';
    },
    setCurrentProduct(state, action: PayloadAction<Product | null>) {
      state.current = action.payload;
    },
    addProduct(state, action: PayloadAction<Product>) {
      state.items.unshift(action.payload);
    },
    updateProduct(state, action: PayloadAction<Product>) {
      const index = state.items.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
      if (state.current?.id === action.payload.id) {
        state.current = action.payload;
      }
    },
    removeProduct(state, action: PayloadAction<string>) {
      state.items = state.items.filter((p) => p.id !== action.payload);
    },
    setProductsStatus(state, action: PayloadAction<ProductsState['status']>) {
      state.status = action.payload;
    },
    setProductsError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = 'failed';
    },
  },
});

export const {
  setProducts,
  setCurrentProduct,
  addProduct,
  updateProduct,
  removeProduct,
  setProductsStatus,
  setProductsError,
} = productsSlice.actions;

export default productsSlice.reducer;
