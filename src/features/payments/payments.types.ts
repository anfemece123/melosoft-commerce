import type { AsyncStatus, PaymentEnvironment, TransactionStatus } from '@/types/common.types';

export interface PaymentProvider {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface StorePaymentSettings {
  id: string;
  storeId: string;
  providerId: string;
  publicKey: string | null;
  privateKeyReference: string | null;
  integritySecretReference: string | null;
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
  currency: string;
  status: TransactionStatus;
  paymentMethod: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StorePaymentSettingsInsert = Omit<StorePaymentSettings, 'id' | 'createdAt' | 'updatedAt'>;
export type StorePaymentSettingsUpdate = Partial<Omit<StorePaymentSettingsInsert, 'storeId' | 'providerId'>>;

export interface PaymentsState {
  providers: PaymentProvider[];
  settings: StorePaymentSettings | null;
  transactions: PaymentTransaction[];
  status: AsyncStatus;
  error: string | null;
}
