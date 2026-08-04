import { supabase } from '@/lib/supabase';
import type { ProductOptionGroupDraft } from '@/features/products/productOptionsService';
import type {
  Json,
  StoreCartUpsellRuleRow,
  StoreProductOptionTemplateRow,
} from '@/types/database.types';

export interface CartUpsellRule {
  id: string;
  storeId: string;
  title: string;
  sourceProductId: string | null;
  sourceCategoryId: string | null;
  targetProductId: string | null;
  targetCategoryId: string | null;
  onlyIfMissing: boolean;
  maxItems: number;
  priority: number;
  isActive: boolean;
}

export interface CartUpsellRuleDraft {
  title: string;
  sourceProductId?: string | null;
  sourceCategoryId?: string | null;
  targetProductId?: string | null;
  targetCategoryId?: string | null;
  onlyIfMissing: boolean;
  maxItems: number;
  priority?: number;
  isActive: boolean;
}

export interface ProductOptionTemplate {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  groups: ProductOptionGroupDraft[];
  isActive: boolean;
}

export interface ProductOptionTemplateDraft {
  name: string;
  description?: string | null;
  groups: ProductOptionGroupDraft[];
  isActive?: boolean;
}

async function getOwnerId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

function mapRule(row: StoreCartUpsellRuleRow): CartUpsellRule {
  return {
    id: row.id,
    storeId: row.store_id,
    title: row.title,
    sourceProductId: row.source_product_id,
    sourceCategoryId: row.source_category_id,
    targetProductId: row.target_product_id,
    targetCategoryId: row.target_category_id,
    onlyIfMissing: row.only_if_missing,
    maxItems: row.max_items,
    priority: row.priority,
    isActive: row.is_active,
  };
}

export function cloneTemplateGroups(groups: ProductOptionGroupDraft[]): ProductOptionGroupDraft[] {
  return groups.map((group) => ({
    name: group.name,
    description: group.description ?? null,
    selectionType: group.selectionType,
    minSelect: Number(group.minSelect) || 0,
    maxSelect: group.selectionType === 'single'
      ? 1
      : group.maxSelect === null ? null : Number(group.maxSelect) || 1,
    isRequired: group.isRequired,
    isActive: group.isActive,
    items: group.items.map((item) => ({
      label: item.label,
      description: item.description ?? null,
      priceDelta: Number(item.priceDelta) || 0,
      linkedProductId: item.linkedProductId,
      linkedVariantId: item.linkedVariantId,
      linkedQuantity: Number(item.linkedQuantity) || 1,
      priceMode: item.priceMode,
      isDefault: item.isDefault,
      isActive: item.isActive,
    })),
  }));
}

function validateTemplate(draft: ProductOptionTemplateDraft): ProductOptionGroupDraft[] {
  if (!draft.name.trim()) throw new Error('Escribe el nombre de la plantilla.');
  if (draft.groups.length === 0) throw new Error('Agrega al menos un grupo a la plantilla.');

  const groups = cloneTemplateGroups(draft.groups);
  groups.forEach((group, groupIndex) => {
    if (!group.name.trim()) throw new Error(`Escribe el nombre del grupo ${groupIndex + 1}.`);
    if (group.items.length === 0) throw new Error(`Agrega al menos una opción en “${group.name}”.`);
    const minimum = group.isRequired ? Math.max(Number(group.minSelect), 1) : Number(group.minSelect);
    if (group.maxSelect !== null && Number(group.maxSelect) < minimum) {
      throw new Error(`El máximo de “${group.name}” no puede ser menor que el mínimo.`);
    }
    group.items.forEach((item, itemIndex) => {
      if (!item.label.trim()) throw new Error(`Escribe el nombre de la opción ${itemIndex + 1} en “${group.name}”.`);
    });
  });
  return groups;
}

function mapTemplate(row: StoreProductOptionTemplateRow): ProductOptionTemplate {
  const rawGroups = Array.isArray(row.groups) ? row.groups : [];
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    description: row.description,
    groups: cloneTemplateGroups(rawGroups as unknown as ProductOptionGroupDraft[]),
    isActive: row.is_active,
  };
}

export const restaurantMerchandisingService = {
  async getRules(storeId: string): Promise<CartUpsellRule[]> {
    const { data, error } = await supabase
      .from('store_cart_upsell_rules')
      .select('*')
      .eq('store_id', storeId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRule);
  },

  async createRule(storeId: string, draft: CartUpsellRuleDraft): Promise<CartUpsellRule> {
    const ownerId = await getOwnerId();
    if (!draft.title.trim()) throw new Error('Escribe el título que verá el cliente.');
    if (!draft.targetCategoryId && !draft.targetProductId) throw new Error('Selecciona qué recomendar.');

    const { data, error } = await supabase
      .from('store_cart_upsell_rules')
      .insert({
        store_id: storeId,
        owner_id: ownerId,
        title: draft.title.trim(),
        source_product_id: draft.sourceProductId || null,
        source_category_id: draft.sourceCategoryId || null,
        target_product_id: draft.targetProductId || null,
        target_category_id: draft.targetCategoryId || null,
        only_if_missing: draft.onlyIfMissing,
        max_items: Math.min(6, Math.max(1, draft.maxItems)),
        priority: draft.priority ?? 0,
        is_active: draft.isActive,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapRule(data);
  },

  async updateRule(ruleId: string, draft: CartUpsellRuleDraft): Promise<CartUpsellRule> {
    if (!draft.title.trim()) throw new Error('Escribe el título que verá el cliente.');
    if (!draft.targetCategoryId && !draft.targetProductId) throw new Error('Selecciona qué recomendar.');

    const { data, error } = await supabase
      .from('store_cart_upsell_rules')
      .update({
        title: draft.title.trim(),
        source_product_id: draft.sourceProductId || null,
        source_category_id: draft.sourceCategoryId || null,
        target_product_id: draft.targetProductId || null,
        target_category_id: draft.targetCategoryId || null,
        only_if_missing: draft.onlyIfMissing,
        max_items: Math.min(6, Math.max(1, draft.maxItems)),
        priority: draft.priority ?? 0,
        is_active: draft.isActive,
      })
      .eq('id', ruleId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapRule(data);
  },

  async deleteRule(ruleId: string): Promise<void> {
    const { error } = await supabase.from('store_cart_upsell_rules').delete().eq('id', ruleId);
    if (error) throw new Error(error.message);
  },

  async getTemplates(storeId: string): Promise<ProductOptionTemplate[]> {
    const { data, error } = await supabase
      .from('store_product_option_templates')
      .select('*')
      .eq('store_id', storeId)
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapTemplate);
  },

  async createTemplate(storeId: string, draft: ProductOptionTemplateDraft): Promise<ProductOptionTemplate> {
    const ownerId = await getOwnerId();
    const groups = validateTemplate(draft);
    const { data, error } = await supabase
      .from('store_product_option_templates')
      .insert({
        store_id: storeId,
        owner_id: ownerId,
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        groups: groups as unknown as Json,
        is_active: draft.isActive ?? true,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapTemplate(data);
  },

  async updateTemplate(templateId: string, draft: ProductOptionTemplateDraft): Promise<ProductOptionTemplate> {
    const groups = validateTemplate(draft);
    const { data, error } = await supabase
      .from('store_product_option_templates')
      .update({
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        groups: groups as unknown as Json,
        is_active: draft.isActive ?? true,
      })
      .eq('id', templateId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapTemplate(data);
  },

  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase.from('store_product_option_templates').delete().eq('id', templateId);
    if (error) throw new Error(error.message);
  },
};
