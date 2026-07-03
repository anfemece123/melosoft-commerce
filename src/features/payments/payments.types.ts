import type { AsyncStatus, PaymentEnvironment, TransactionStatus } from '@/types/common.types';

export interface PaymentProvider {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
}

// StorePaymentSettings — keys are stored server-side.
// The frontend receives them for display purposes but should only show
// masked versions (e.g., ••••••1234) in the UI.
// Never expose these values in public views or anon-accessible endpoints.
export interface StorePaymentSettings {
  id: string;
  storeId: string;
  providerId: string;
  publicKey: string | null;
  // Stored as private_key_reference in DB — contains the actual private key.
  privateKey: string | null;
  // Stored as integrity_secret_reference in DB — contains the actual secret.
  integritySecret: string | null;
  // Stored as events_secret in DB — used to validate Wompi webhooks.
  eventsSecret: string | null;
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
  items: Array<{
    productId: string;
    quantity: number;
    customizationNotes?: string | null;
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
