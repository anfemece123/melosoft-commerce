import { supabase } from '@/lib/supabase';
import type { AccountingCategoryRow, AccountingEntryRow } from '@/types/database.types';
import type {
  AccountingCategory,
  AccountingDateFilter,
  AccountingEntry,
  CreateAccountingCategoryInput,
  CreateAccountingEntryInput,
} from './accounting.types';

function mapCategory(row: AccountingCategoryRow): AccountingCategory {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    entryType: row.entry_type === 'income' || row.entry_type === 'expense' ? row.entry_type : 'both',
    isSystem: row.is_system,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEntry(row: AccountingEntryRow, orderNumber: string | null = null): AccountingEntry {
  return {
    id: row.id,
    storeId: row.store_id,
    entryType: row.entry_type === 'expense' ? 'expense' : 'income',
    source: row.source === 'sale' ? 'sale' : 'manual',
    orderId: row.order_id,
    orderNumber,
    description: row.description,
    category: row.category,
    categoryId: row.category_id,
    amount: Number(row.amount),
    currency: row.currency,
    occurredOn: row.occurred_on,
    status: row.status === 'voided' ? 'voided' : 'posted',
    notes: row.notes,
    createdBy: row.created_by,
    voidedAt: row.voided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const accountingService = {
  async getCategories(storeId: string): Promise<AccountingCategory[]> {
    const { data, error } = await supabase
      .from('accounting_categories')
      .select('*')
      .eq('store_id', storeId)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as AccountingCategoryRow[]).map(mapCategory);
  },

  async createCategory(input: CreateAccountingCategoryInput): Promise<AccountingCategory> {
    const name = input.name.trim();
    if (name.length < 2) throw new Error('La categoría debe tener al menos 2 caracteres.');

    const { data, error } = await supabase
      .from('accounting_categories')
      .insert({
        store_id: input.storeId,
        name,
        entry_type: input.entryType,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No se pudo crear la categoría.');
    return mapCategory(data as AccountingCategoryRow);
  },

  async setCategoryStatus(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('accounting_categories')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getEntries(storeId: string, filter: AccountingDateFilter = {}): Promise<AccountingEntry[]> {
    let query = supabase
      .from('accounting_entries')
      .select('*')
      .eq('store_id', storeId)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);

    if (filter.dateFrom) query = query.gte('occurred_on', filter.dateFrom);
    if (filter.dateTo) query = query.lte('occurred_on', filter.dateTo);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as AccountingEntryRow[];
    const orderIds = rows.flatMap((row) => row.order_id ? [row.order_id] : []);
    const orderNumbers = new Map<string, string | null>();
    if (orderIds.length > 0) {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number')
        .in('id', orderIds);
      if (ordersError) throw new Error(ordersError.message);
      for (const order of orders ?? []) orderNumbers.set(order.id, order.order_number);
    }

    return rows.map((row) => mapEntry(row, row.order_id ? orderNumbers.get(row.order_id) ?? null : null));
  },

  async createManualEntry(input: CreateAccountingEntryInput): Promise<AccountingEntry> {
    const { data, error } = await supabase
      .from('accounting_entries')
      .insert({
        store_id: input.storeId,
        entry_type: input.entryType,
        source: 'manual',
        description: input.description.trim(),
        category: input.category.trim(),
        category_id: input.categoryId,
        amount: input.amount,
        currency: input.currency,
        occurred_on: input.occurredOn,
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No se pudo crear el movimiento contable.');
    return mapEntry(data as AccountingEntryRow);
  },

  async voidEntry(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounting_entries')
      .update({ status: 'voided', voided_at: new Date().toISOString() })
      .eq('id', id)
      .eq('source', 'manual')
      .eq('status', 'posted');
    if (error) throw new Error(error.message);
  },
};
