import { supabase } from '@/lib/supabase';
import type {
  CustomerRow,
  CustomerPreferencesRow,
  CustomerRowUpdate,
  StoreCustomerSettingsRowUpdate,
} from '@/types/database.types';
import {
  mapCustomerPreferencesRow,
  mapCustomerRow,
  mapStoreCustomerSettingsRow,
} from './customers.mapper';
import type {
  CaptureStoreContactInput,
  CreateCustomerInput,
  Customer,
  StoreCustomerSettings,
  StoreCustomerSettingsUpdate,
  UpdateCustomerInput,
} from './customers.types';

function mapCustomerError(message: string): Error {
  const messages: Record<string, string> = {
    CUSTOMER_BOOK_DISABLED: 'El módulo de clientes todavía no está habilitado para esta empresa.',
    CUSTOMER_CAPTURE_DISABLED: 'La captura pública de contactos no está habilitada para esta tienda.',
    PRIVACY_POLICY_REQUIRED: 'La empresa debe publicar su política de privacidad antes de captar contactos.',
    MARKETING_CONSENT_REQUIRED: 'El contacto debe autorizar al menos un canal de comunicación.',
    CUSTOMER_CONTACT_REQUIRED: 'Escribe un correo o un teléfono para guardar el contacto.',
    CUSTOMER_EMAIL_REQUIRED: 'Escribe el correo para autorizar la comunicación por email.',
    CUSTOMER_PHONE_REQUIRED: 'El teléfono es obligatorio para autorizar WhatsApp.',
    INVALID_CUSTOMER_EMAIL: 'Escribe un correo electrónico válido.',
    INVALID_CUSTOMER_PHONE: 'Escribe un teléfono válido.',
    EMAIL_CAPTURE_DISABLED: 'La empresa no tiene habilitada la comunicación comercial por correo.',
    WHATSAPP_CAPTURE_DISABLED: 'La empresa no tiene habilitada la comunicación comercial por WhatsApp.',
    INSUFFICIENT_PERMISSIONS: 'No tienes permisos para administrar los contactos de esta empresa.',
  };
  const key = Object.keys(messages).find((candidate) => message.includes(candidate));
  return new Error(key ? messages[key] : message);
}

export const customersService = {
  async getCustomers(storeId: string): Promise<Customer[]> {
    const [customersResult, preferencesResult] = await Promise.all([
      supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId)
        .order('last_order_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('customer_preferences').select('*'),
    ]);

    if (customersResult.error) throw new Error(customersResult.error.message);
    if (preferencesResult.error) throw new Error(preferencesResult.error.message);

    const preferencesByCustomerId = new Map(
      ((preferencesResult.data ?? []) as CustomerPreferencesRow[])
        .map((row) => [row.customer_id, mapCustomerPreferencesRow(row)]),
    );
    return ((customersResult.data ?? []) as CustomerRow[]).map((row) =>
      mapCustomerRow(row, preferencesByCustomerId.get(row.id) ?? null),
    );
  },

  async getSettings(storeId: string): Promise<StoreCustomerSettings | null> {
    const { data, error } = await supabase
      .from('store_customer_settings')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapStoreCustomerSettingsRow(data) : null;
  },

  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const { data, error } = await supabase.rpc('create_store_customer', {
      p_store_id: input.storeId,
      p_full_name: input.fullName.trim(),
      p_email: input.email?.trim() || null,
      p_phone: input.phone?.trim() || null,
      p_notes: input.notes?.trim() || null,
    });
    if (error) throw mapCustomerError(error.message);
    if (!data) throw new Error('No se pudo crear el contacto.');
    return mapCustomerRow(data as CustomerRow);
  },

  async updateCustomer(customerId: string, input: UpdateCustomerInput): Promise<Customer> {
    const payload: CustomerRowUpdate = {};
    if (input.fullName !== undefined) payload.full_name = input.fullName.trim();
    if (input.email !== undefined) payload.email = input.email?.trim() || null;
    if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
    if (input.status !== undefined) payload.status = input.status;

    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', customerId)
      .select()
      .single();
    if (error) throw mapCustomerError(error.message);
    if (!data) throw new Error('No se pudo actualizar el contacto.');
    return mapCustomerRow(data as CustomerRow);
  },

  async updateSettings(storeId: string, input: StoreCustomerSettingsUpdate): Promise<StoreCustomerSettings> {
    const payload: StoreCustomerSettingsRowUpdate = {};
    if (input.captureEnabled !== undefined) payload.capture_enabled = input.captureEnabled;
    if (input.collectPhone !== undefined) payload.collect_phone = input.collectPhone;
    if (input.captureTitle !== undefined) payload.capture_title = input.captureTitle.trim();
    if (input.captureDescription !== undefined) payload.capture_description = input.captureDescription.trim();
    if (input.incentiveText !== undefined) payload.incentive_text = input.incentiveText?.trim() || null;
    if (input.successMessage !== undefined) payload.success_message = input.successMessage.trim();
    if (input.emailMarketingEnabled !== undefined) payload.email_marketing_enabled = input.emailMarketingEnabled;
    if (input.whatsappMarketingEnabled !== undefined) payload.whatsapp_marketing_enabled = input.whatsappMarketingEnabled;

    const { data, error } = await supabase
      .from('store_customer_settings')
      .update(payload)
      .eq('store_id', storeId)
      .select()
      .single();
    if (error) throw mapCustomerError(error.message);
    if (!data) throw new Error('No se pudo guardar la configuración de contactos.');
    return mapStoreCustomerSettingsRow(data);
  },

  async captureContact(input: CaptureStoreContactInput): Promise<void> {
    const { error } = await supabase.rpc('capture_store_contact', {
      p_store_slug: input.storeSlug,
      p_full_name: input.fullName?.trim() || null,
      p_email: input.email?.trim() || null,
      p_phone: input.phone?.trim() || null,
      p_marketing_email_opt_in: input.marketingEmailOptIn,
      p_marketing_whatsapp_opt_in: input.marketingWhatsappOptIn,
      p_source: 'storefront_form',
    });
    if (error) throw mapCustomerError(error.message);
  },

  async backfillStoreCustomers(storeId: string): Promise<number> {
    const { data, error } = await supabase.rpc('backfill_store_customers', { p_store_id: storeId });
    if (error) throw mapCustomerError(error.message);
    return Number(data ?? 0);
  },
};
