import type {
  PaymentProviderRow,
  StorePaymentSettingsRow,
  StorePaymentSettingsRowUpdate,
  PaymentTransactionRow,
} from '@/types/database.types';
import type { PaymentEnvironment, TransactionStatus } from '@/types/common.types';
import type {
  PaymentProvider,
  StorePaymentSettings,
  PaymentTransaction,
  StorePaymentSettingsUpsert,
  StorePaymentSettingsUpdate,
} from './payments.types';

// ── Row → App model ──────────────────────────────────────────

export function mapPaymentProviderRowToPaymentProvider(row: PaymentProviderRow): PaymentProvider {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapStorePaymentSettingsRowToStorePaymentSettings(
  row: StorePaymentSettingsRow & { events_secret?: string | null }
): StorePaymentSettings {
  return {
    id: row.id,
    storeId: row.store_id,
    providerId: row.provider_id,
    publicKey: row.public_key,
    // private_key_reference stores the actual private key
    privateKey: row.private_key_reference,
    // integrity_secret_reference stores the actual integrity secret
    integritySecret: row.integrity_secret_reference,
    eventsSecret: row.events_secret ?? null,
    environment: row.environment as PaymentEnvironment,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPaymentTransactionRowToPaymentTransaction(
  row: PaymentTransactionRow & {
    amount_in_cents?: number | null;
    checkout_url?: string | null;
    paid_at?: string | null;
  }
): PaymentTransaction {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    providerId: row.provider_id,
    providerTransactionId: row.provider_transaction_id,
    providerReference: row.provider_reference,
    amount: Number(row.amount),
    amountInCents: row.amount_in_cents ?? null,
    currency: row.currency,
    status: row.status as TransactionStatus,
    paymentMethod: row.payment_method,
    checkoutUrl: row.checkout_url ?? null,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── App model → Insert / Update row ─────────────────────────

export function mapStorePaymentSettingsUpsertToRow(data: StorePaymentSettingsUpsert) {
  return {
    store_id:                   data.storeId,
    provider_id:                data.providerId,
    public_key:                 data.publicKey?.trim() || null,
    private_key_reference:      data.privateKey?.trim() || null,
    integrity_secret_reference: data.integritySecret?.trim() || null,
    events_secret:              data.eventsSecret?.trim() || null,
    environment:                data.environment,
    is_active:                  data.isActive,
  };
}

export function mapStorePaymentSettingsUpdateToRow(data: StorePaymentSettingsUpdate): StorePaymentSettingsRowUpdate {
  const row: StorePaymentSettingsRowUpdate = {};
  if (data.publicKey !== undefined)        row.public_key = data.publicKey?.trim() || null;
  if (data.privateKey !== undefined)       row.private_key_reference = data.privateKey?.trim() || null;
  if (data.integritySecret !== undefined)  row.integrity_secret_reference = data.integritySecret?.trim() || null;
  if (data.eventsSecret !== undefined)     row.events_secret = data.eventsSecret?.trim() || null;
  if (data.environment !== undefined)      row.environment = data.environment;
  if (data.isActive !== undefined)         row.is_active = data.isActive;
  return row;
}
