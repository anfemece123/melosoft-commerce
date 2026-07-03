export type MovementType =
  | 'stock_in'
  | 'stock_out'
  | 'manual_adjustment'
  | 'damaged'
  | 'lost'
  | 'returned'
  | 'correction';

export interface InventoryMovement {
  id: string;
  storeId: string;
  productId: string;
  storeLocationId: string | null;
  movementType: MovementType;
  reason: string;
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  notes: string | null;
  createdBy: string;
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
