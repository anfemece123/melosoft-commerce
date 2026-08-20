export type AccountingEntryType = 'income' | 'expense';
export type AccountingEntrySource = 'sale' | 'manual';
export type AccountingEntryStatus = 'posted' | 'voided';
export type AccountingCategoryEntryType = AccountingEntryType | 'both';

export interface AccountingCategory {
  id: string;
  storeId: string;
  name: string;
  entryType: AccountingCategoryEntryType;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingEntry {
  id: string;
  storeId: string;
  entryType: AccountingEntryType;
  source: AccountingEntrySource;
  orderId: string | null;
  orderNumber: string | null;
  description: string;
  category: string;
  categoryId: string | null;
  amount: number;
  currency: string;
  occurredOn: string;
  status: AccountingEntryStatus;
  notes: string | null;
  createdBy: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountingEntryInput {
  storeId: string;
  entryType: AccountingEntryType;
  description: string;
  category: string;
  categoryId: string;
  amount: number;
  currency: string;
  occurredOn: string;
  notes: string | null;
}

export interface CreateAccountingCategoryInput {
  storeId: string;
  name: string;
  entryType: AccountingCategoryEntryType;
}

export interface AccountingDateFilter {
  dateFrom?: string;
  dateTo?: string;
}
