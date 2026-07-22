import { supabase } from '@/lib/supabase';
import type {
  StoreWhatsappSettings,
  StoreWhatsappSettingsUpsert,
  StoreWhatsappSettingsUpdate,
  WhatsappNotification,
  StoreWhatsappConnection,
  PlatformWhatsappConnectionOverview,
} from './whatsapp.types';
import {
  mapStoreWhatsappSettingsRowToStoreWhatsappSettings,
  mapStoreWhatsappSettingsUpsertToRow,
  mapStoreWhatsappSettingsUpdateToRow,
  mapWhatsappNotificationRowToWhatsappNotification,
  mapStoreWhatsappConnectionRowToStoreWhatsappConnection,
  mapPlatformOverviewRowToPlatformWhatsappConnectionOverview,
} from './whatsapp.mapper';

interface EmbeddedSignupCompletionPayload {
  storeId: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string | null;
  coexistence: boolean;
}

interface EmbeddedSignupCompletionResponse {
  ok: true;
  connectionStatus: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  onboardingType: string;
}

interface TemplateSyncResponse {
  ok: true;
  orderConfirmationTemplate: { name: string; status: string; rejectedReason: string | null };
  testTemplate: { name: string; status: string };
}

export const whatsappService = {
  async getSettings(storeId: string): Promise<StoreWhatsappSettings | null> {
    const { data, error } = await supabase
      .from('store_whatsapp_settings')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapStoreWhatsappSettingsRowToStoreWhatsappSettings(data);
  },

  async upsertSettings(payload: StoreWhatsappSettingsUpsert): Promise<StoreWhatsappSettings> {
    const row = mapStoreWhatsappSettingsUpsertToRow(payload);
    const { data, error } = await supabase
      .from('store_whatsapp_settings')
      .upsert(row, { onConflict: 'store_id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after upsert');
    return mapStoreWhatsappSettingsRowToStoreWhatsappSettings(data);
  },

  async updateSettings(storeId: string, payload: StoreWhatsappSettingsUpdate): Promise<StoreWhatsappSettings> {
    const row = mapStoreWhatsappSettingsUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_whatsapp_settings')
      .update(row)
      .eq('store_id', storeId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapStoreWhatsappSettingsRowToStoreWhatsappSettings(data);
  },

  async getRecentNotifications(storeId: string, limit = 20): Promise<WhatsappNotification[]> {
    const { data, error } = await supabase
      .from('whatsapp_notifications')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapWhatsappNotificationRowToWhatsappNotification);
  },

  // Enqueues a test send — server-side rate limited (max 3/hour/store) and
  // role-checked (owner/admin) inside enqueue_test_whatsapp_notification.
  // Actual delivery happens asynchronously via the queue worker, same as
  // every other notification — this only confirms it was accepted.
  async sendTestMessage(storeId: string, phone: string): Promise<void> {
    const { error } = await supabase.rpc('enqueue_test_whatsapp_notification', {
      p_store_id: storeId,
      p_phone: phone,
    });
    if (error) throw new Error(error.message);
  },

  // ── Modelo B — per-store connection ──────────────────────────────

  async getConnection(storeId: string): Promise<StoreWhatsappConnection | null> {
    const { data, error } = await supabase
      .from('store_whatsapp_connections')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapStoreWhatsappConnectionRowToStoreWhatsappConnection(data);
  },

  // Completes Embedded Signup after the frontend has already run
  // FB.login() (see src/lib/whatsapp/embeddedSignup.ts) and captured the
  // temporary `code` plus the session-logging waba_id/phone_number_id.
  // All Meta verification and the actual token exchange happen in the
  // whatsapp-embedded-signup Edge Function — this call never sees or
  // handles a real access token.
  async completeEmbeddedSignup(payload: EmbeddedSignupCompletionPayload): Promise<EmbeddedSignupCompletionResponse> {
    const { data, error } = await supabase.functions.invoke<EmbeddedSignupCompletionResponse>(
      'whatsapp-embedded-signup',
      {
        body: {
          storeId: payload.storeId,
          code: payload.code,
          wabaId: payload.wabaId,
          phoneNumberId: payload.phoneNumberId,
          businessId: payload.businessId ?? null,
          coexistence: payload.coexistence,
        },
      },
    );
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No response from Edge Function');
    return data;
  },

  async syncTemplate(storeId: string): Promise<TemplateSyncResponse> {
    const { data, error } = await supabase.functions.invoke<TemplateSyncResponse>('whatsapp-template-sync', {
      body: { storeId },
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No response from Edge Function');
    return data;
  },

  // Requires explicit owner/admin confirmation in the UI before calling
  // this — see disconnect_store_whatsapp_connection's own header comment
  // (migration 096) for exactly what this does and does not revoke.
  async disconnect(storeId: string): Promise<void> {
    const { error } = await supabase.rpc('disconnect_store_whatsapp_connection', { p_store_id: storeId });
    if (error) throw new Error(error.message);
  },

  // Platform admin operational view — masked phone number, no tokens,
  // no per-store secrets. See platform_whatsapp_connections_overview
  // (migration 096) for what is and isn't exposed here.
  async getPlatformOverview(): Promise<PlatformWhatsappConnectionOverview[]> {
    const { data, error } = await supabase
      .from('platform_whatsapp_connections_overview')
      .select('*')
      .order('store_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapPlatformOverviewRowToPlatformWhatsappConnectionOverview);
  },
};
