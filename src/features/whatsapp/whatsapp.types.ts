export type WhatsappSenderMode = 'central' | 'dedicated';

export interface StoreWhatsappSettings {
  id: string;
  storeId: string;
  enabled: boolean;
  senderMode: WhatsappSenderMode;
  customerOrderConfirmationEnabled: boolean;
  orderConfirmedEnabled: boolean;
  paymentApprovedEnabled: boolean;
  paymentDeclinedEnabled: boolean;
  orderPreparingEnabled: boolean;
  orderReadyForPickupEnabled: boolean;
  orderShippedEnabled: boolean;
  orderDeliveredEnabled: boolean;
  orderCancelledEnabled: boolean;
  locale: string;
  timezone: string;
  finalMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StoreWhatsappSettingsUpsert = Omit<StoreWhatsappSettings, 'id' | 'createdAt' | 'updatedAt'>;
export type StoreWhatsappSettingsUpdate = Partial<Omit<StoreWhatsappSettingsUpsert, 'storeId'>>;

export type WhatsappNotificationEventType =
  | 'order_received'
  | 'order_confirmed'
  | 'payment_approved'
  | 'payment_declined'
  | 'order_preparing'
  | 'order_ready_for_pickup'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'test_message';

export type WhatsappNotificationStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'invalid_recipient'
  | 'blocked';

export interface WhatsappNotification {
  id: string;
  storeId: string;
  orderId: string | null;
  eventType: WhatsappNotificationEventType;
  recipientPhone: string;
  templateName: string;
  status: WhatsappNotificationStatus;
  attempts: number;
  isPermanentFailure: boolean;
  lastErrorMessage: string | null;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

// ── Modelo B — per-store Meta connection (migration 096) ──────────

export type WhatsappConnectionStatus =
  | 'not_connected'
  | 'connecting'
  | 'connected'
  | 'requires_attention'
  | 'disconnected';

export type WhatsappOnboardingType = 'coexistence' | 'new_number' | 'existing_cloud_api' | null;

export type WhatsappTemplateStatus = 'not_created' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';

export interface StoreWhatsappConnection {
  id: string;
  storeId: string;
  metaBusinessId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  connectionStatus: WhatsappConnectionStatus;
  onboardingType: WhatsappOnboardingType;
  coexistenceEnabled: boolean;
  templateName: string;
  templateLanguage: string;
  templateStatus: WhatsappTemplateStatus;
  templateRejectedReason: string | null;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  disconnectedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformWhatsappConnectionOverview {
  storeId: string;
  storeName: string;
  connectionStatus: WhatsappConnectionStatus;
  displayPhoneNumberMasked: string | null;
  wabaId: string | null;
  templateStatus: WhatsappTemplateStatus;
  onboardingType: WhatsappOnboardingType;
  coexistenceEnabled: boolean;
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
}
