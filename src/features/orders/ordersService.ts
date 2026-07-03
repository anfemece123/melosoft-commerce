import { supabase } from '@/lib/supabase';
import type { Order, OrderInsert, OrderItemInsert, CreateWebOrderPayload, WebOrderResult } from './orders.types';
import type { OrderStatus, PaymentStatus } from '@/types/common.types';

export interface OrdersDateParams {
  dateFrom?: string;
  dateTo?: string;
}
import {
  mapOrderRowToOrder,
  mapOrderInsertToRow,
  mapOrderUpdateToRow,
  mapOrderItemInsertToRow,
} from './orders.mapper';

export const ordersService = {
  async getOrdersByStore(storeId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapOrderRowToOrder);
  },

  async getOrdersWithItems(storeId: string, params?: OrdersDateParams): Promise<Order[]> {
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (params?.dateFrom) query = query.gte('created_at', params.dateFrom);
    if (params?.dateTo) query = query.lt('created_at', params.dateTo);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    type RowWithItems = Parameters<typeof mapOrderRowToOrder>[0];
    return (data ?? []).map(row => mapOrderRowToOrder(row as unknown as RowWithItems));
  },

  async getOrderById(id: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapOrderRowToOrder(data);
  },

  async getOrderWithItems(id: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    type RowWithItems = Parameters<typeof mapOrderRowToOrder>[0];
    return mapOrderRowToOrder(data as unknown as RowWithItems);
  },

  async createOrder(payload: OrderInsert): Promise<Order> {
    const row = mapOrderInsertToRow(payload);
    const { data, error } = await supabase
      .from('orders')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after insert');
    return mapOrderRowToOrder(data);
  },

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const row = mapOrderUpdateToRow({ status });
    const { data, error } = await supabase
      .from('orders')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapOrderRowToOrder(data);
  },

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order> {
    const row = mapOrderUpdateToRow({ paymentStatus });
    const { data, error } = await supabase
      .from('orders')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapOrderRowToOrder(data);
  },

  async addOrderItem(payload: OrderItemInsert): Promise<void> {
    const row = mapOrderItemInsertToRow(payload);
    const { error } = await supabase.from('order_items').insert(row);
    if (error) throw new Error(error.message);
  },

  async createWebOrder(payload: CreateWebOrderPayload): Promise<WebOrderResult> {
    const { data, error } = await supabase.rpc('create_store_order', {
      p_store_slug:            payload.storeSlug,
      p_customer_name:         payload.customerName,
      p_customer_phone:        payload.customerPhone,
      p_customer_email:        payload.customerEmail,
      p_fulfillment_method:    payload.fulfillmentMethod,
      p_shipping_address:      payload.shippingAddress,
      p_city:                  payload.city,
      p_department:            payload.department,
      p_delivery_neighborhood: payload.deliveryNeighborhood,
      p_delivery_reference:    payload.deliveryReference,
      p_notes:                 payload.notes,
      p_store_location_id:     payload.storeLocationId ?? null,
      p_payment_method:        payload.paymentMethod ?? 'cash_on_delivery',
      p_items: payload.items.map((item) => ({
        product_id:          item.productId,
        quantity:            item.quantity,
        customization_notes: item.customizationNotes,
      })),
    });
    if (error) throw new Error(error.message);
    const result = data as {
      order_id: string;
      order_number: string;
      total_amount: number;
      payment_method: string;
      status: string;
    };
    return {
      orderId:       result.order_id,
      orderNumber:   result.order_number,
      totalAmount:   Number(result.total_amount),
      paymentMethod: result.payment_method as 'cash_on_delivery' | 'online',
      status:        result.status,
    };
  },
};
