import type {
  PaymentProviderRow,
  StorePaymentSettingsRow,
  StorePaymentSettingsRowInsert,
  StorePaymentSettingsRowUpdate,
  PaymentTransactionRow,
} from '@/types/database.types';
import type { PaymentEnvironment, TransactionStatus } from '@/types/common.types';
import type {
  PaymentProvider,
  StorePaymentSettings,
  PaymentTransaction,
  StorePaymentSettingsInsert,
  StorePaymentSettingsUpdate,
} from './payments.types';

// ── Row → App model ─────────────────────────────────────────

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
  row: StorePaymentSettingsRow
): StorePaymentSettings {
  return {
    id: row.id,
    storeId: row.store_id,
    providerId: row.provider_id,
    publicKey: row.public_key,
    privateKeyReference: row.private_key_reference,
    integritySecretReference: row.integrity_secret_reference,
    environment: row.environment as PaymentEnvironment,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPaymentTransactionRowToPaymentTransaction(
  row: PaymentTransactionRow
): PaymentTransaction {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    providerId: row.provider_id,
    providerTransactionId: row.provider_transaction_id,
    providerReference: row.provider_reference,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status as TransactionStatus,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── App model → Insert / Update row ─────────────────────────

export function mapStorePaymentSettingsInsertToRow(
  data: StorePaymentSettingsInsert
): StorePaymentSettingsRowInsert {
  return {
    store_id: data.storeId,
    provider_id: data.providerId,
    public_key: data.publicKey ?? null,
    private_key_reference: data.privateKeyReference ?? null,
    integrity_secret_reference: data.integritySecretReference ?? null,
    environment: data.environment,
    is_active: data.isActive,
  };
}

export function mapStorePaymentSettingsUpdateToRow(
  data: StorePaymentSettingsUpdate
): StorePaymentSettingsRowUpdate {
  const row: StorePaymentSettingsRowUpdate = {};
  if (data.publicKey !== undefined) row.public_key = data.publicKey ?? null;
  if (data.privateKeyReference !== undefined) row.private_key_reference = data.privateKeyReference ?? null;
  if (data.integritySecretReference !== undefined) row.integrity_secret_reference = data.integritySecretReference ?? null;
  if (data.environment !== undefined) row.environment = data.environment;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  return row;
}
