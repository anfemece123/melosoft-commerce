import type { AsyncStatus, PaymentEnvironment, TransactionStatus } from '@/types/common.types';

export interface PaymentProvider {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
}

// StorePaymentSettings — the raw private_key/integrity_secret/events_secret
// are NEVER included here. The DB (migration 086) revokes SELECT on those
// columns for `authenticated`, so the frontend only ever sees whether each
// secret is configured (hasX) and a masked last-4 preview computed by
// Postgres (xPreview) — never the real value. To set a NEW secret, write
// through StorePaymentSettingsUpsert/Update; there is no way to read one
// back once saved.
export interface StorePaymentSettings {
  id: string;
  storeId: string;
  providerId: string;
  publicKey: string | null;
  hasPrivateKey: boolean;
  privateKeyPreview: string | null;
  hasIntegritySecret: boolean;
  integritySecretPreview: string | null;
  hasEventsSecret: boolean;
  eventsSecretPreview: string | null;
  environment: PaymentEnvironment;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  storeId: string;
  orderId: string | null;
  providerId: string | null;
  providerTransactionId: string | null;
  providerReference: string | null;
  amount: number;
  amountInCents: number | null;
  currency: string;
  status: TransactionStatus;
  paymentMethod: string | null;
  checkoutUrl: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Payload sent to the server when creating/updating payment settings
export interface StorePaymentSettingsUpsert {
  storeId: string;
  providerId: string;
  publicKey: string | null;
  privateKey: string | null;
  integritySecret: string | null;
  eventsSecret: string | null;
  environment: PaymentEnvironment;
  isActive: boolean;
}

export type StorePaymentSettingsUpdate = Partial<Omit<StorePaymentSettingsUpsert, 'storeId' | 'providerId'>>;

export interface PaymentsState {
  providers: PaymentProvider[];
  settings: StorePaymentSettings | null;
  transactions: PaymentTransaction[];
  status: AsyncStatus;
  error: string | null;
}

// Payload sent to create-wompi-payment Edge Function.
// No order_id — no order exists yet. The order is created only
// after the Wompi webhook confirms APPROVED.
export interface WompiCheckoutPayload {
  storeSlug: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  fulfillmentMethod: string;
  shippingAddress?: string | null;
  city?: string | null;
  department?: string | null;
  deliveryNeighborhood?: string | null;
  deliveryReference?: string | null;
  notes?: string | null;
  storeLocationId?: string | null;
  whatsappConsent?: boolean;
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    customizationNotes?: string | null;
    customizations: Array<{ optionGroupId: string; optionItemId: string }>;
  }>;
}

// Response from create-wompi-payment Edge Function (new architecture)
export interface WompiCheckoutInitResult {
  checkoutUrl: string;
  reference: string;
  sessionId: string;
  amountInCents: number;
  environment: PaymentEnvironment;
}

// Response from get_payment_result RPC — no PII, safe for anon
export interface PaymentResultData {
  sessionStatus: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
}

// A Wompi payment Wompi confirmed as APPROVED after its stock reservation
// had already been released (migration 092) — flagged for manual
// review/refund instead of silently creating an order. See wompi-webhook's
// "reservation freshness check".
export interface StockUnavailablePayment {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  currency: string;
  providerReference: string;
}
