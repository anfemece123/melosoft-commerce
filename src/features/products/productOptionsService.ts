import { supabase } from '@/lib/supabase';
import type {
  ProductOptionGroupRow,
  ProductOptionGroupRowInsert,
  ProductOptionItemRow,
  ProductOptionItemRowInsert,
} from '@/types/database.types';
import type { PublicProductOptionGroup, PublicProductOptionItem } from '@/types/common.types';
import type { ProductOptionGroup, ProductOptionItem } from './products.types';
import {
  mapProductOptionGroupRowToProductOptionGroup,
  mapProductOptionItemRowToProductOptionItem,
} from './products.mapper';

export interface ProductOptionItemDraft {
  id?: string;
  label: string;
  description?: string | null;
  /** `''` only while the owner is actively clearing/retyping the field in
   * ProductOptionsEditor — never persisted as-is, see replaceProductOptionGroups. */
  priceDelta: number | '';
  isDefault: boolean;
  isActive: boolean;
}

export interface ProductOptionGroupDraft {
  id?: string;
  name: string;
  description?: string | null;
  selectionType: 'single' | 'multiple';
  /** `''` only while mid-edit — see priceDelta. */
  minSelect: number | '';
  maxSelect: number | null;
  isRequired: boolean;
  isActive: boolean;
  items: ProductOptionItemDraft[];
}

async function getOwnerId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

async function fetchOptionGroups(productId: string): Promise<ProductOptionGroup[]> {
  const groupsQuery = supabase
    .from('product_option_groups')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const itemsQuery = supabase
    .from('product_option_items')
    .select(`
      *,
      product_option_groups!inner(product_id)
    `)
    .eq('product_option_groups.product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const [{ data: groups, error: groupsError }, { data: items, error: itemsError }] = await Promise.all([
    groupsQuery,
    itemsQuery,
  ]);

  if (groupsError) throw new Error(groupsError.message);
  if (itemsError) throw new Error(itemsError.message);

  const mappedItems = ((items ?? []) as ProductOptionItemRow[]).map(mapProductOptionItemRowToProductOptionItem);
  const itemsByGroup = mappedItems.reduce<Map<string, ProductOptionItem[]>>((acc, item) => {
    const current = acc.get(item.groupId) ?? [];
    current.push(item);
    acc.set(item.groupId, current);
    return acc;
  }, new Map());

  return ((groups ?? []) as ProductOptionGroupRow[]).map((group) =>
    mapProductOptionGroupRowToProductOptionGroup(group, itemsByGroup.get(group.id) ?? [])
  );
}

interface PublicOptionGroupRow {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  selection_type: 'single' | 'multiple';
  min_select: number;
  max_select: number | null;
  is_required: boolean;
  sort_order: number;
}

interface PublicOptionItemRow {
  id: string;
  group_id: string;
  product_id: string;
  label: string;
  description: string | null;
  price_delta: number;
  is_default: boolean;
  sort_order: number;
}

// Reads through public_product_option_groups/items (security-definer views)
// rather than the raw tables — the raw tables' "Public can view active..."
// RLS policy checks products/stores internally, and anon has never had
// direct read access to those (by design, same reason public_product_pages
// exists as a view instead of exposing `products` directly). Querying the
// raw tables as anon fails one level deeper on `products`/`stores`.
async function fetchPublicOptionGroups(productId: string): Promise<PublicProductOptionGroup[]> {
  const [{ data: groups, error: groupsError }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from('public_product_option_groups')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('public_product_option_items')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true }),
  ]);

  if (groupsError) throw new Error(groupsError.message);
  if (itemsError) throw new Error(itemsError.message);

  const itemsByGroup = new Map<string, PublicProductOptionItem[]>();
  for (const row of (items ?? []) as PublicOptionItemRow[]) {
    const list = itemsByGroup.get(row.group_id) ?? [];
    list.push({
      id: row.id,
      label: row.label,
      description: row.description,
      priceDelta: Number(row.price_delta),
      isDefault: row.is_default,
      sortOrder: row.sort_order,
    });
    itemsByGroup.set(row.group_id, list);
  }

  return ((groups ?? []) as PublicOptionGroupRow[])
    .map((row): PublicProductOptionGroup => ({
      id: row.id,
      name: row.name,
      description: row.description,
      selectionType: row.selection_type,
      minSelect: row.min_select,
      maxSelect: row.max_select,
      isRequired: row.is_required,
      sortOrder: row.sort_order,
      items: itemsByGroup.get(row.id) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}

export const productOptionsService = {
  async getProductOptionGroups(productId: string): Promise<ProductOptionGroup[]> {
    return fetchOptionGroups(productId);
  },

  async getPublicProductOptionGroups(productId: string): Promise<PublicProductOptionGroup[]> {
    return fetchPublicOptionGroups(productId);
  },

  async replaceProductOptionGroups(
    storeId: string,
    productId: string,
    groups: ProductOptionGroupDraft[]
  ): Promise<void> {
    const ownerId = await getOwnerId();

    const sanitizedGroups = groups
      .map((group, groupIndex) => ({
        ...group,
        name: group.name.trim(),
        description: group.description?.trim() || null,
        sortOrder: groupIndex,
        items: group.items
          .map((item, itemIndex) => ({
            ...item,
            label: item.label.trim(),
            description: item.description?.trim() || null,
            sortOrder: itemIndex,
          }))
          .filter((item) => item.label.length > 0),
      }))
      .filter((group) => group.name.length > 0 && group.items.length > 0);

    const { error: deleteError } = await supabase
      .from('product_option_groups')
      .delete()
      .eq('product_id', productId);

    if (deleteError) throw new Error(deleteError.message);

    if (sanitizedGroups.length === 0) return;

    const groupRows: ProductOptionGroupRowInsert[] = sanitizedGroups.map((group) => ({
      store_id: storeId,
      product_id: productId,
      owner_id: ownerId,
      name: group.name,
      description: group.description,
      selection_type: group.selectionType,
      min_select: group.minSelect === '' ? 0 : group.minSelect,
      max_select: group.maxSelect,
      is_required: group.isRequired,
      is_active: group.isActive,
      sort_order: group.sortOrder,
    }));

    const { data: createdGroups, error: insertGroupsError } = await supabase
      .from('product_option_groups')
      .insert(groupRows)
      .select('*');

    if (insertGroupsError) throw new Error(insertGroupsError.message);

    const itemRows: ProductOptionItemRowInsert[] = [];

    (createdGroups ?? []).forEach((groupRow, groupIndex) => {
      sanitizedGroups[groupIndex].items.forEach((item) => {
        itemRows.push({
          store_id: storeId,
          group_id: groupRow.id,
          owner_id: ownerId,
          label: item.label,
          description: item.description,
          price_delta: item.priceDelta === '' ? 0 : item.priceDelta,
          is_default: item.isDefault,
          is_active: item.isActive,
          sort_order: item.sortOrder,
        });
      });
    });

    if (itemRows.length > 0) {
      const { error: insertItemsError } = await supabase
        .from('product_option_items')
        .insert(itemRows);

      if (insertItemsError) throw new Error(insertItemsError.message);
    }
  },
};
