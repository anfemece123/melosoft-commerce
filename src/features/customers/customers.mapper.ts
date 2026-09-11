import type {
  CustomerPreferencesRow,
  CustomerRow,
  StoreCustomerSettingsRow,
} from '@/types/database.types';
import type {
  Customer,
  CustomerPreferences,
  StoreCustomerSettings,
} from './customers.types';

export function mapCustomerPreferencesRow(row: CustomerPreferencesRow): CustomerPreferences {
  return {
    customerId: row.customer_id,
    emailMarketingStatus: row.email_marketing_status as CustomerPreferences['emailMarketingStatus'],
    whatsappMarketingStatus: row.whatsapp_marketing_status as CustomerPreferences['whatsappMarketingStatus'],
    emailConsentAt: row.email_consent_at,
    whatsappConsentAt: row.whatsapp_consent_at,
    emailRevokedAt: row.email_revoked_at,
    whatsappRevokedAt: row.whatsapp_revoked_at,
    updatedAt: row.updated_at,
  };
}

export function mapCustomerRow(row: CustomerRow, preferences: CustomerPreferences | null = null): Customer {
  return {
    id: row.id,
    storeId: row.store_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    status: row.status as Customer['status'],
    source: row.source as Customer['source'],
    notes: row.notes,
    firstOrderAt: row.first_order_at,
    lastOrderAt: row.last_order_at,
    orderCount: row.order_count,
    totalSpent: Number(row.total_spent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preferences,
  };
}

export function mapStoreCustomerSettingsRow(row: StoreCustomerSettingsRow): StoreCustomerSettings {
  return {
    id: row.id,
    storeId: row.store_id,
    captureEnabled: row.capture_enabled,
    collectPhone: row.collect_phone,
    captureTitle: row.capture_title,
    captureDescription: row.capture_description,
    incentiveText: row.incentive_text,
    successMessage: row.success_message,
    emailMarketingEnabled: row.email_marketing_enabled,
    whatsappMarketingEnabled: row.whatsapp_marketing_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
