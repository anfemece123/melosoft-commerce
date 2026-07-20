export type MovementType =
  | 'stock_in'
  | 'stock_out'
  | 'manual_adjustment'
  | 'damaged'
  | 'lost'
  | 'returned'
  | 'correction'
  // Automatic movements from the order lifecycle (create_store_order /
  // cancel_store_order) — never inserted directly by the frontend.
  | 'order_placed'
  | 'order_cancelled';

export interface InventoryMovement {
  id: string;
  storeId: string;
  productId: string;
  variantId: string | null;
  storeLocationId: string | null;
  // Only set for 'order_placed'/'order_cancelled' movements.
  orderId: string | null;
  orderItemId: string | null;
  movementType: MovementType;
  reason: string;
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  notes: string | null;
  // Null for 'order_placed' — those come from anonymous storefront
  // checkout, there's no authenticated user to attribute them to.
  createdBy: string | null;
  createdAt: string;
}

export interface AdjustStockPayload {
  storeId: string;
  productId: string;
  movementType: MovementType;
  quantityChange: number;
  reason: string;
  notes?: string | null;
}

export interface AdjustVariantStockPayload {
  storeId: string;
  variantId: string;
  movementType: MovementType;
  quantityChange: number;
  reason: string;
  notes?: string | null;
}
