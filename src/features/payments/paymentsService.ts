import { supabase } from '@/lib/supabase';
import type { PaymentProvider, StorePaymentSettings, StorePaymentSettingsInsert, StorePaymentSettingsUpdate, PaymentTransaction } from './payments.types';
import {
  mapPaymentProviderRowToPaymentProvider,
  mapStorePaymentSettingsRowToStorePaymentSettings,
  mapStorePaymentSettingsInsertToRow,
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

  async getStorePaymentSettings(storeId: string): Promise<StorePaymentSettings[]> {
    const { data, error } = await supabase
      .from('store_payment_settings')
      .select('*')
      .eq('store_id', storeId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStorePaymentSettingsRowToStorePaymentSettings);
  },

  async upsertStorePaymentSettings(payload: StorePaymentSettingsInsert): Promise<StorePaymentSettings> {
    const row = mapStorePaymentSettingsInsertToRow(payload);
    const { data, error } = await supabase
      .from('store_payment_settings')
      .upsert(row, { onConflict: 'store_id,provider_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after upsert');
    return mapStorePaymentSettingsRowToStorePaymentSettings(data);
  },

  async updateStorePaymentSettings(
    storeId: string,
    providerId: string,
    payload: StorePaymentSettingsUpdate
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
    return mapStorePaymentSettingsRowToStorePaymentSettings(data);
  },

  async getTransactionsByStore(storeId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapPaymentTransactionRowToPaymentTransaction);
  },

  // Triggers the create-wompi-payment Edge Function.
  // Returns the redirect URL or payment widget data from Wompi.
  // Private keys are never sent from the frontend — the Edge Function reads them from secrets.
  async createWompiPayment(orderId: string): Promise<{ redirectUrl: string }> {
    const { data, error } = await supabase.functions.invoke('create-wompi-payment', {
      body: { order_id: orderId },
    });
    if (error) throw new Error(error.message);
    return data as { redirectUrl: string };
  },
};
