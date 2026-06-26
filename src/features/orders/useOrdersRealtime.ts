import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { supabase } from '@/lib/supabase';
import { addOrder, updateOrder } from './ordersSlice';
import { ordersService } from './ordersService';
import { mapOrderRowToOrder } from './orders.mapper';
import { notify } from '@/lib/notifications';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Order } from './orders.types';
import type { OrderRow, OrderItemRow } from '@/types/database.types';

type OrderRowWithItems = OrderRow & { order_items?: OrderItemRow[] };

export interface UseOrdersRealtimeOptions {
  storeId: string | undefined;
  /** ISO string for start of visible date range. If both are undefined, no orders are added. */
  dateFrom: string | undefined;
  /** ISO string for end of visible date range (exclusive). */
  dateTo: string | undefined;
  /** Current orders in Redux state — used to deduplicate inserts and preserve items on update. */
  currentOrders: Order[];
}

/**
 * Subscribes to Supabase Realtime postgres_changes for the orders table.
 * On INSERT: fetches the full order with items and dispatches addOrder if in range.
 * On UPDATE: maps the row and dispatches updateOrder, preserving existing items.
 * Cleans up the channel subscription on unmount or storeId change.
 */
export function useOrdersRealtime({
  storeId,
  dateFrom,
  dateTo,
  currentOrders,
}: UseOrdersRealtimeOptions): void {
  const dispatch = useAppDispatch();

  // Refs keep the latest values accessible inside the realtime callback
  // without needing to re-subscribe when they change.
  const dateFromRef = useRef(dateFrom);
  const dateToRef = useRef(dateTo);
  const currentOrdersRef = useRef(currentOrders);

  useEffect(() => { dateFromRef.current = dateFrom; }, [dateFrom]);
  useEffect(() => { dateToRef.current = dateTo; }, [dateTo]);
  useEffect(() => { currentOrdersRef.current = currentOrders; }, [currentOrders]);

  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`orders-realtime:${storeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const row = payload.new as unknown as OrderRow;

          // If no active date range is set (e.g. custom range not yet applied),
          // skip adding to the list — but the badge hook will still reflect this order.
          const from = dateFromRef.current;
          const to = dateToRef.current;
          if (!from && !to) return;

          // Only add the order to the visible list if it falls within the current date range.
          const createdAt = new Date(row.created_at);
          const inRange =
            (!from || createdAt >= new Date(from)) &&
            (!to || createdAt < new Date(to));
          if (!inRange) return;

          // Deduplicate (can happen if fetchOrders + realtime race)
          if (currentOrdersRef.current.some(o => o.id === row.id)) return;

          // Fetch the full order with items since the realtime payload has no joins
          void ordersService.getOrderWithItems(row.id).then(fullOrder => {
            if (!fullOrder) return;
            dispatch(addOrder(fullOrder));
            notify.success(
              `Nuevo pedido de ${row.customer_name} · ${formatCurrency(Number(row.total_amount), 'es-CO', 'COP')}`,
              { duration: 8000 }
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const row = payload.new as unknown as OrderRow;

          // Only update orders that are currently in the visible list
          const existing = currentOrdersRef.current.find(o => o.id === row.id);
          if (!existing) return;

          // Map the row (realtime has no joins, so items will be undefined)
          const updated = mapOrderRowToOrder(row as unknown as OrderRowWithItems);
          // Preserve the already-loaded items from state
          dispatch(updateOrder({ ...updated, items: existing.items }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [storeId, dispatch]);
}
