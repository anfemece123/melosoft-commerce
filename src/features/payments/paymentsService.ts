import { supabase } from '@/lib/supabase';
import type {
  PaymentProvider,
  StorePaymentSettings,
  StorePaymentSettingsUpsert,
  StorePaymentSettingsUpdate,
  PaymentTransaction,
  WompiCheckoutPayload,
  WompiCheckoutInitResult,
  PaymentResultData,
} from './payments.types';
import {
  mapPaymentProviderRowToPaymentProvider,
  mapStorePaymentSettingsRowToStorePaymentSettings,
  mapStorePaymentSettingsUpsertToRow,
  mapStorePaymentSettingsUpdateToRow,
  mapPaymentTransactionRowToPaymentTransaction,
} from './payments.mapper';

export const paymentsService = {
  async getPaymentProviders(): Promise<PaymentProvider[]> {
    const { data, error } = await supabase
      .from('payment_providers')
      .select('*')
      .eq('status', 'active')
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapPaymentProviderRowToPaymentProvider);
  },

  async getWompiProviderId(): Promise<string | null> {
    const { data } = await supabase
      .from('payment_providers')
      .select('id')
      .eq('code', 'wompi')
      .single();
    return data?.id ?? null;
  },

  async getStorePaymentSettings(storeId: string): Promise<StorePaymentSettings | null> {
    const { data, error } = await supabase
      .from('store_payment_settings')
      .select('*, payment_providers!inner(code)')
      .eq('store_id', storeId)
      .eq('payment_providers.code', 'wompi')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapStorePaymentSettingsRowToStorePaymentSettings(
      data as Parameters<typeof mapStorePaymentSettingsRowToStorePaymentSettings>[0]
    );
  },

  async upsertStorePaymentSettings(payload: StorePaymentSettingsUpsert): Promise<StorePaymentSettings> {
    const row = mapStorePaymentSettingsUpsertToRow(payload);
    const { data, error } = await supabase
      .from('store_payment_settings')
      .upsert(row, { onConflict: 'store_id,provider_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after upsert');
    return mapStorePaymentSettingsRowToStorePaymentSettings(
      data as Parameters<typeof mapStorePaymentSettingsRowToStorePaymentSettings>[0]
    );
  },

  async updateStorePaymentSettings(
    storeId: string,
    providerId: string,
    payload: StorePaymentSettingsUpdate,
  ): Promise<StorePaymentSettings> {
    const row = mapStorePaymentSettingsUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_payment_settings')
      .update(row)
      .eq('store_id', storeId)
      .eq('provider_id', providerId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapStorePaymentSettingsRowToStorePaymentSettings(
      data as Parameters<typeof mapStorePaymentSettingsRowToStorePaymentSettings>[0]
    );
  },

  async getTransactionsByOrder(orderId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(r =>
      mapPaymentTransactionRowToPaymentTransaction(
        r as Parameters<typeof mapPaymentTransactionRowToPaymentTransaction>[0]
      )
    );
  },

  async getTransactionsByStore(storeId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map(r =>
      mapPaymentTransactionRowToPaymentTransaction(
        r as Parameters<typeof mapPaymentTransactionRowToPaymentTransaction>[0]
      )
    );
  },

  // Initiates a Wompi checkout session.
  // Sends the full cart to the Edge Function — NO order_id.
  // The Edge Function validates products server-side, calculates the total,
  // creates a checkout_session record, and returns the Wompi checkout URL.
  // The real order is only created after the webhook confirms APPROVED.
  async initiateWompiCheckout(
    payload: WompiCheckoutPayload,
    redirectUrl: string,
  ): Promise<WompiCheckoutInitResult> {
    const { data, error } = await supabase.functions.invoke('create-wompi-payment', {
      body: {
        store_slug:            payload.storeSlug,
        customer_name:         payload.customerName,
        customer_phone:        payload.customerPhone,
        customer_email:        payload.customerEmail ?? null,
        fulfillment_method:    payload.fulfillmentMethod,
        shipping_address:      payload.shippingAddress ?? null,
        city:                  payload.city ?? null,
        department:            payload.department ?? null,
        delivery_neighborhood: payload.deliveryNeighborhood ?? null,
        delivery_reference:    payload.deliveryReference ?? null,
        notes:                 payload.notes ?? null,
        store_location_id:     payload.storeLocationId ?? null,
        items: payload.items.map(i => ({
          product_id:          i.productId,
          quantity:            i.quantity,
          customization_notes: i.customizationNotes ?? null,
        })),
        redirect_url: redirectUrl,
      },
    });
    if (error) throw new Error(error.message ?? 'Failed to create Wompi checkout session');
    if (!data?.checkoutUrl) throw new Error('Invalid response from payment service');
    return data as WompiCheckoutInitResult;
  },

  // Queries the get_payment_result RPC (SECURITY DEFINER, safe for anon).
  // Returns session status + order number — no PII.
  // Used by PaymentResultPage to poll for order creation after Wompi redirect.
  async getPaymentResult(reference: string): Promise<PaymentResultData | null> {
    const { data, error } = await supabase.rpc('get_payment_result', {
      p_reference: reference,
    });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const row = rows[0];
    if (!row) return null;
    return {
      sessionStatus: row.session_status ?? null,
      orderNumber:   row.order_number ?? null,
      orderStatus:   row.order_status ?? null,
    };
  },
};
