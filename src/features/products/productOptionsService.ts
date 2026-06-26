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
  priceDelta: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface ProductOptionGroupDraft {
  id?: string;
  name: string;
  description?: string | null;
  selectionType: 'single' | 'multiple';
  minSelect: number;
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

function mapPublicOptionItem(item: ProductOptionItem): PublicProductOptionItem {
  return {
    id: item.id,
    label: item.label,
    description: item.description,
    priceDelta: item.priceDelta,
    isDefault: item.isDefault,
    sortOrder: item.sortOrder,
  };
}

function mapPublicOptionGroup(group: ProductOptionGroup): PublicProductOptionGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    selectionType: group.selectionType,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    isRequired: group.isRequired,
    sortOrder: group.sortOrder,
    items: group.items.filter((item) => item.isActive).map(mapPublicOptionItem),
  };
}

async function fetchOptionGroups(productId: string, onlyActive = false): Promise<ProductOptionGroup[]> {
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

  if (onlyActive) {
    groupsQuery.eq('is_active', true);
    itemsQuery.eq('is_active', true).eq('product_option_groups.is_active', true);
  }

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

export const productOptionsService = {
  async getProductOptionGroups(productId: string): Promise<ProductOptionGroup[]> {
    return fetchOptionGroups(productId, false);
  },

  async getPublicProductOptionGroups(productId: string): Promise<PublicProductOptionGroup[]> {
    const groups = await fetchOptionGroups(productId, true);
    return groups
      .filter((group) => group.isActive)
      .map(mapPublicOptionGroup)
      .filter((group) => group.items.length > 0);
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
      min_select: group.minSelect,
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
          price_delta: item.priceDelta,
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
