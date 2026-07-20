import { supabase } from '@/lib/supabase';
import type { PublicHomeSection, PublicHomeSectionItem } from '@/types/common.types';
import {
  mapStoreHomeSectionRowToStoreHomeSection,
  mapStoreHomeSectionInsertToRow,
  mapStoreHomeSectionUpdateToRow,
  mapStoreHomeSectionItemRowToStoreHomeSectionItem,
  mapStoreHomeSectionItemInsertToRow,
  mapStoreHomeSectionItemUpdateToRow,
  mapPublicStoreHomeSectionRowToPublicHomeSection,
  mapPublicStoreHomeSectionItemRowToPublicHomeSectionItem,
} from './homeSections.mapper';
import type {
  StoreHomeSection,
  StoreHomeSectionInsert,
  StoreHomeSectionUpdate,
  StoreHomeSectionItem,
  StoreHomeSectionItemInsert,
  StoreHomeSectionItemUpdate,
} from './homeSections.types';

async function getOwnerId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

async function nextSectionSortOrder(storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from('store_home_sections')
    .select('sort_order')
    .eq('store_id', storeId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.sort_order ?? -1) + 1;
}

async function nextItemSortOrder(sectionId: string): Promise<number> {
  const { data, error } = await supabase
    .from('store_home_section_items')
    .select('sort_order')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.sort_order ?? -1) + 1;
}

export const homeSectionsService = {
  // ── Admin: sections ──────────────────────────────────────────
  async getStoreHomeSections(storeId: string): Promise<StoreHomeSection[]> {
    const { data, error } = await supabase
      .from('store_home_sections')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreHomeSectionRowToStoreHomeSection);
  },

  async createStoreHomeSection(payload: StoreHomeSectionInsert): Promise<StoreHomeSection> {
    const sortOrder = await nextSectionSortOrder(payload.storeId);
    const row = mapStoreHomeSectionInsertToRow({ ...payload, sortOrder });
    const { data, error } = await supabase.from('store_home_sections').insert(row).select('*').single();
    if (error) throw new Error(error.message);
    return mapStoreHomeSectionRowToStoreHomeSection(data);
  },

  async updateStoreHomeSection(id: string, payload: StoreHomeSectionUpdate): Promise<StoreHomeSection> {
    const row = mapStoreHomeSectionUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_home_sections')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapStoreHomeSectionRowToStoreHomeSection(data);
  },

  async deleteStoreHomeSection(id: string): Promise<void> {
    const { error } = await supabase.from('store_home_sections').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async toggleStoreHomeSectionActive(id: string, isActive: boolean): Promise<StoreHomeSection> {
    return homeSectionsService.updateStoreHomeSection(id, { isActive });
  },

  /** Persists an explicit full order (drag-and-drop can move a card more
   * than one position at once, unlike moveStoreHomeSection's adjacent
   * swap) — assigns sort_order = index for every id in `orderedIds`. The
   * caller (HomeBuilderCanvas) updates local state optimistically and
   * rolls back to the previous order if this throws. */
  async reorderStoreHomeSections(orderedIds: string[]): Promise<void> {
    const results = await Promise.all(
      orderedIds.map((id, index) => supabase.from('store_home_sections').update({ sort_order: index }).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  },

  /** Swaps sort_order with the adjacent row (2 updates, no RPC) and returns
   * the refreshed, re-ordered section list. No-op at the list's edges. */
  async moveStoreHomeSection(storeId: string, sectionId: string, direction: 'up' | 'down'): Promise<StoreHomeSection[]> {
    const sections = await homeSectionsService.getStoreHomeSections(storeId);
    const index = sections.findIndex((s) => s.id === sectionId);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= sections.length) return sections;

    const current = sections[index];
    const swap = sections[swapIndex];

    const { error: error1 } = await supabase
      .from('store_home_sections')
      .update({ sort_order: swap.sortOrder })
      .eq('id', current.id);
    if (error1) throw new Error(error1.message);

    const { error: error2 } = await supabase
      .from('store_home_sections')
      .update({ sort_order: current.sortOrder })
      .eq('id', swap.id);
    if (error2) throw new Error(error2.message);

    return homeSectionsService.getStoreHomeSections(storeId);
  },

  // ── Admin: items ─────────────────────────────────────────────
  async getStoreHomeSectionItems(sectionId: string): Promise<StoreHomeSectionItem[]> {
    const { data, error } = await supabase
      .from('store_home_section_items')
      .select('*')
      .eq('section_id', sectionId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreHomeSectionItemRowToStoreHomeSectionItem);
  },

  async createStoreHomeSectionItem(payload: StoreHomeSectionItemInsert): Promise<StoreHomeSectionItem> {
    const sortOrder = await nextItemSortOrder(payload.sectionId);
    const row = mapStoreHomeSectionItemInsertToRow({ ...payload, sortOrder });
    const { data, error } = await supabase.from('store_home_section_items').insert(row).select('*').single();
    if (error) throw new Error(error.message);
    return mapStoreHomeSectionItemRowToStoreHomeSectionItem(data);
  },

  async updateStoreHomeSectionItem(id: string, payload: StoreHomeSectionItemUpdate): Promise<StoreHomeSectionItem> {
    const row = mapStoreHomeSectionItemUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_home_section_items')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapStoreHomeSectionItemRowToStoreHomeSectionItem(data);
  },

  async deleteStoreHomeSectionItem(id: string): Promise<void> {
    const { error } = await supabase.from('store_home_section_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async moveStoreHomeSectionItem(sectionId: string, itemId: string, direction: 'up' | 'down'): Promise<StoreHomeSectionItem[]> {
    const items = await homeSectionsService.getStoreHomeSectionItems(sectionId);
    const index = items.findIndex((i) => i.id === itemId);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= items.length) return items;

    const current = items[index];
    const swap = items[swapIndex];

    const { error: error1 } = await supabase
      .from('store_home_section_items')
      .update({ sort_order: swap.sortOrder })
      .eq('id', current.id);
    if (error1) throw new Error(error1.message);

    const { error: error2 } = await supabase
      .from('store_home_section_items')
      .update({ sort_order: current.sortOrder })
      .eq('id', swap.id);
    if (error2) throw new Error(error2.message);

    return homeSectionsService.getStoreHomeSectionItems(sectionId);
  },

  /** Delete-all + insert-with-sort_order — appropriate for picker-driven
   * item lists (featured products/categories manual selection) where the
   * "selected set" is naturally replaced wholesale on save, unlike promo
   * banners/testimonials which use per-row create/update/delete. */
  async replaceStoreHomeSectionItems(
    sectionId: string,
    storeId: string,
    items: Omit<StoreHomeSectionItemInsert, 'sectionId' | 'storeId' | 'sortOrder'>[]
  ): Promise<StoreHomeSectionItem[]> {
    const { error: deleteError } = await supabase
      .from('store_home_section_items')
      .delete()
      .eq('section_id', sectionId);
    if (deleteError) throw new Error(deleteError.message);
    if (items.length === 0) return [];

    const rows = items.map((item, index) =>
      mapStoreHomeSectionItemInsertToRow({ ...item, sectionId, storeId, sortOrder: index })
    );
    const { data, error } = await supabase.from('store_home_section_items').insert(rows).select('*');
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map(mapStoreHomeSectionItemRowToStoreHomeSectionItem)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async uploadHomeSectionImage(storeId: string, sectionId: string, file: File): Promise<string> {
    const ownerId = await getOwnerId();
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
    const storagePath = `${ownerId}/stores/${storeId}/home/${sectionId}/image-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('store-assets')
      .upload(storagePath, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from('store-assets').getPublicUrl(storagePath);
    return publicUrl;
  },

  // ── Public read ──────────────────────────────────────────────
  async getPublicHomeSections(storeId: string): Promise<PublicHomeSection[]> {
    const { data: sectionRows, error: sectionsError } = await supabase
      .from('public_store_home_sections')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true });
    if (sectionsError) throw new Error(sectionsError.message);
    const sections = sectionRows ?? [];
    if (sections.length === 0) return [];

    const sectionIds = sections.map((s) => s.id);
    const { data: itemRows, error: itemsError } = await supabase
      .from('public_store_home_section_items')
      .select('*')
      .in('section_id', sectionIds)
      .order('sort_order', { ascending: true });
    if (itemsError) throw new Error(itemsError.message);

    const itemsBySection = new Map<string, PublicHomeSectionItem[]>();
    for (const row of itemRows ?? []) {
      const item = mapPublicStoreHomeSectionItemRowToPublicHomeSectionItem(row);
      const list = itemsBySection.get(item.sectionId) ?? [];
      list.push(item);
      itemsBySection.set(item.sectionId, list);
    }

    return sections.map((row) =>
      mapPublicStoreHomeSectionRowToPublicHomeSection(row, itemsBySection.get(row.id) ?? [])
    );
  },
};
