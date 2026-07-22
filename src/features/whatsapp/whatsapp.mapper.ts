import type { Database } from '@/types/database.types';
import type {
  StoreWhatsappSettings,
  StoreWhatsappSettingsUpsert,
  StoreWhatsappSettingsUpdate,
  WhatsappNotification,
  WhatsappNotificationEventType,
  WhatsappNotificationStatus,
  WhatsappSenderMode,
  StoreWhatsappConnection,
  WhatsappConnectionStatus,
  WhatsappOnboardingType,
  WhatsappTemplateStatus,
  PlatformWhatsappConnectionOverview,
} from './whatsapp.types';

type SettingsRow = Database['public']['Tables']['store_whatsapp_settings']['Row'];
type NotificationRow = Database['public']['Tables']['whatsapp_notifications']['Row'];
type ConnectionRow = Database['public']['Tables']['store_whatsapp_connections']['Row'];
type PlatformOverviewRow = Database['public']['Views']['platform_whatsapp_connections_overview']['Row'];

export function mapStoreWhatsappSettingsRowToStoreWhatsappSettings(row: SettingsRow): StoreWhatsappSettings {
  return {
    id: row.id,
    storeId: row.store_id,
    enabled: row.enabled,
    senderMode: row.sender_mode as WhatsappSenderMode,
    customerOrderConfirmationEnabled: row.customer_order_confirmation_enabled,
    orderConfirmedEnabled: row.order_confirmed_enabled,
    paymentApprovedEnabled: row.payment_approved_enabled,
    paymentDeclinedEnabled: row.payment_declined_enabled,
    orderPreparingEnabled: row.order_preparing_enabled,
    orderReadyForPickupEnabled: row.order_ready_for_pickup_enabled,
    orderShippedEnabled: row.order_shipped_enabled,
    orderDeliveredEnabled: row.order_delivered_enabled,
    orderCancelledEnabled: row.order_cancelled_enabled,
    locale: row.locale,
    timezone: row.timezone,
    finalMessage: row.final_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreWhatsappSettingsUpsertToRow(
  data: StoreWhatsappSettingsUpsert,
): Database['public']['Tables']['store_whatsapp_settings']['Insert'] {
  return {
    store_id: data.storeId,
    enabled: data.enabled,
    sender_mode: data.senderMode,
    customer_order_confirmation_enabled: data.customerOrderConfirmationEnabled,
    order_confirmed_enabled: data.orderConfirmedEnabled,
    payment_approved_enabled: data.paymentApprovedEnabled,
    payment_declined_enabled: data.paymentDeclinedEnabled,
    order_preparing_enabled: data.orderPreparingEnabled,
    order_ready_for_pickup_enabled: data.orderReadyForPickupEnabled,
    order_shipped_enabled: data.orderShippedEnabled,
    order_delivered_enabled: data.orderDeliveredEnabled,
    order_cancelled_enabled: data.orderCancelledEnabled,
    locale: data.locale,
    timezone: data.timezone,
    final_message: data.finalMessage,
  };
}

export function mapStoreWhatsappSettingsUpdateToRow(
  data: StoreWhatsappSettingsUpdate,
): Database['public']['Tables']['store_whatsapp_settings']['Update'] {
  const row: Database['public']['Tables']['store_whatsapp_settings']['Update'] = {};
  if (data.enabled !== undefined) row.enabled = data.enabled;
  if (data.senderMode !== undefined) row.sender_mode = data.senderMode;
  if (data.customerOrderConfirmationEnabled !== undefined) {
    row.customer_order_confirmation_enabled = data.customerOrderConfirmationEnabled;
  }
  if (data.orderConfirmedEnabled !== undefined) row.order_confirmed_enabled = data.orderConfirmedEnabled;
  if (data.paymentApprovedEnabled !== undefined) row.payment_approved_enabled = data.paymentApprovedEnabled;
  if (data.paymentDeclinedEnabled !== undefined) row.payment_declined_enabled = data.paymentDeclinedEnabled;
  if (data.orderPreparingEnabled !== undefined) row.order_preparing_enabled = data.orderPreparingEnabled;
  if (data.orderReadyForPickupEnabled !== undefined) {
    row.order_ready_for_pickup_enabled = data.orderReadyForPickupEnabled;
  }
  if (data.orderShippedEnabled !== undefined) row.order_shipped_enabled = data.orderShippedEnabled;
  if (data.orderDeliveredEnabled !== undefined) row.order_delivered_enabled = data.orderDeliveredEnabled;
  if (data.orderCancelledEnabled !== undefined) row.order_cancelled_enabled = data.orderCancelledEnabled;
  if (data.locale !== undefined) row.locale = data.locale;
  if (data.timezone !== undefined) row.timezone = data.timezone;
  if (data.finalMessage !== undefined) row.final_message = data.finalMessage;
  return row;
}

export function mapWhatsappNotificationRowToWhatsappNotification(row: NotificationRow): WhatsappNotification {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    eventType: row.event_type as WhatsappNotificationEventType,
    recipientPhone: row.recipient_phone,
    templateName: row.template_name,
    status: row.status as WhatsappNotificationStatus,
    attempts: row.attempts,
    isPermanentFailure: row.is_permanent_failure,
    lastErrorMessage: row.last_error_message,
    queuedAt: row.queued_at,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
  };
}

// ── Modelo B — per-store connection (migration 096) ────────────────

export function mapStoreWhatsappConnectionRowToStoreWhatsappConnection(row: ConnectionRow): StoreWhatsappConnection {
  return {
    id: row.id,
    storeId: row.store_id,
    metaBusinessId: row.meta_business_id,
    wabaId: row.waba_id,
    phoneNumberId: row.phone_number_id,
    displayPhoneNumber: row.display_phone_number,
    verifiedName: row.verified_name,
    connectionStatus: row.connection_status as WhatsappConnectionStatus,
    onboardingType: row.onboarding_type as WhatsappOnboardingType,
    coexistenceEnabled: row.coexistence_enabled,
    templateName: row.template_name,
    templateLanguage: row.template_language,
    templateStatus: row.template_status as WhatsappTemplateStatus,
    templateRejectedReason: row.template_rejected_reason,
    connectedAt: row.connected_at,
    lastVerifiedAt: row.last_verified_at,
    disconnectedAt: row.disconnected_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPlatformOverviewRowToPlatformWhatsappConnectionOverview(
  row: PlatformOverviewRow,
): PlatformWhatsappConnectionOverview {
  return {
    storeId: row.store_id,
    storeName: row.store_name,
    connectionStatus: row.connection_status as WhatsappConnectionStatus,
    displayPhoneNumberMasked: row.display_phone_number_masked,
    wabaId: row.waba_id,
    templateStatus: row.template_status as WhatsappTemplateStatus,
    onboardingType: row.onboarding_type as WhatsappOnboardingType,
    coexistenceEnabled: row.coexistence_enabled,
    lastVerifiedAt: row.last_verified_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    connectedAt: row.connected_at,
    disconnectedAt: row.disconnected_at,
  };
}
