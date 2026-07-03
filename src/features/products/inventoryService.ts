import { supabase } from '@/lib/supabase';
import type { AdjustStockPayload, InventoryMovement, MovementType } from './inventory.types';

type RawMovementRow = {
  id: string;
  store_id: string;
  product_id: string;
  store_location_id: string | null;
  movement_type: string;
  reason: string;
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  notes: string | null;
  created_by: string;
  created_at: string;
};

function mapRow(row: RawMovementRow): InventoryMovement {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    storeLocationId: row.store_location_id,
    movementType: row.movement_type as MovementType,
    reason: row.reason,
    quantityChange: row.quantity_change,
    stockBefore: row.stock_before,
    stockAfter: row.stock_after,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export const inventoryService = {
  async adjustStock(
    payload: AdjustStockPayload
  ): Promise<{ newStock: number; movementId: string }> {
    const { data, error } = await supabase.rpc('adjust_product_stock', {
      p_store_id: payload.storeId,
      p_product_id: payload.productId,
      p_movement_type: payload.movementType,
      p_quantity_change: payload.quantityChange,
      p_reason: payload.reason,
      p_notes: payload.notes ?? null,
    });
    if (error) throw new Error(error.message);
    const result = (data as Array<{ new_stock: number; movement_id: string }>)?.[0];
    if (!result) throw new Error('No result returned from adjust_product_stock');
    return { newStock: result.new_stock, movementId: result.movement_id };
  },

  async getProductMovements(
    productId: string,
    limit = 15
  ): Promise<InventoryMovement[]> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as RawMovementRow));
  },
};
