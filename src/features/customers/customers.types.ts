import type { AsyncStatus } from '@/types/common.types';

export type CustomerSource = 'order' | 'storefront_form' | 'manual' | 'import' | 'mixed';
export type CustomerStatus = 'active' | 'archived';
export type MarketingStatus = 'unknown' | 'subscribed' | 'unsubscribed';

export interface CustomerPreferences {
  customerId: string;
  emailMarketingStatus: MarketingStatus;
  whatsappMarketingStatus: MarketingStatus;
  emailConsentAt: string | null;
  whatsappConsentAt: string | null;
  emailRevokedAt: string | null;
  whatsappRevokedAt: string | null;
  updatedAt: string;
}

export interface Customer {
  id: string;
  storeId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: CustomerStatus;
  source: CustomerSource;
  notes: string | null;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
  preferences: CustomerPreferences | null;
}

export interface StoreCustomerSettings {
  id: string;
  storeId: string;
  captureEnabled: boolean;
  collectPhone: boolean;
  captureTitle: string;
  captureDescription: string;
  incentiveText: string | null;
  successMessage: string;
  emailMarketingEnabled: boolean;
  whatsappMarketingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StoreCustomerSettingsUpdate = Partial<Pick<
  StoreCustomerSettings,
  | 'captureEnabled'
  | 'collectPhone'
  | 'captureTitle'
  | 'captureDescription'
  | 'incentiveText'
  | 'successMessage'
  | 'emailMarketingEnabled'
  | 'whatsappMarketingEnabled'
>>;

export interface CreateCustomerInput {
  storeId: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateCustomerInput {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  status?: CustomerStatus;
}

export interface CaptureStoreContactInput {
  storeSlug: string;
  fullName?: string;
  email?: string;
  phone?: string;
  marketingEmailOptIn: boolean;
  marketingWhatsappOptIn: boolean;
}

export interface CustomersState {
  items: Customer[];
  settings: StoreCustomerSettings | null;
  status: AsyncStatus;
  error: string | null;
}
