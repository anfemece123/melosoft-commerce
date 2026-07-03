import { supabase } from '@/lib/supabase';
import { slugify } from '@/utils/slugify';
import type {
  StoreFacet,
  StoreFacetValue,
  FacetInsert,
  FacetUpdate,
  FacetValueInsert,
  FacetCategoryAssignment,
} from './facets.types';
import type { PublicStoreFacet, PublicStoreFacetValue, FacetApplicableCategory } from '@/types/common.types';
import type { StoreFacetRow, StoreFacetValueRow } from '@/types/database.types';

async function getOwnerId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

function mapFacetRow(row: StoreFacetRow, values: StoreFacetValue[], applicableCategories: FacetCategoryAssignment[] = []): StoreFacet {
  return {
    id: row.id,
    storeId: row.store_id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    inputType: (row.input_type as 'single_select' | 'multi_select') ?? 'single_select',
    showInProductForm: row.show_in_product_form ?? true,
    showInCatalogFilters: row.show_in_catalog_filters ?? true,
    showInMegaMenu: row.show_in_mega_menu ?? false,
    appliesToAllCategories: row.applies_to_all_categories ?? true,
    applicableCategories,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    values,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFacetValueRow(row: StoreFacetValueRow): StoreFacetValue {
  return {
    id: row.id,
    storeId: row.store_id,
    facetId: row.facet_id,
    value: row.value,
    slug: row.slug,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  };
}

export const facetsService = {
  async getStoreFacets(storeId: string): Promise<StoreFacet[]> {
    const [facetsResult, valuesResult, categoriesResult] = await Promise.all([
      supabase
        .from('store_product_facets')
        .select('*')
        .eq('store_id', storeId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('store_product_facet_values')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('value', { ascending: true }),
      supabase
        .from('store_product_facet_categories')
        .select('facet_id, category_id, applies_to_children'),
    ]);
    if (facetsResult.error) throw new Error(facetsResult.error.message);
    if (valuesResult.error) throw new Error(valuesResult.error.message);
    if (categoriesResult.error) throw new Error(categoriesResult.error.message);

    const valuesByFacetId = new Map<string, StoreFacetValue[]>();
    for (const row of (valuesResult.data ?? [])) {
      const mapped = mapFacetValueRow(row);
      const list = valuesByFacetId.get(mapped.facetId) ?? [];
      list.push(mapped);
      valuesByFacetId.set(mapped.facetId, list);
    }

    const categoriesByFacetId = new Map<string, FacetCategoryAssignment[]>();
    for (const row of (categoriesResult.data ?? [])) {
      const list = categoriesByFacetId.get(row.facet_id) ?? [];
      list.push({ categoryId: row.category_id, appliesToChildren: row.applies_to_children });
      categoriesByFacetId.set(row.facet_id, list);
    }

    return (facetsResult.data ?? []).map((row) =>
      mapFacetRow(row, valuesByFacetId.get(row.id) ?? [], categoriesByFacetId.get(row.id) ?? [])
    );
  },

  async createFacet(data: FacetInsert): Promise<StoreFacet> {
    const ownerId = await getOwnerId();
    const slug = data.slug || slugify(data.name);
    const { data: existing, error: existingError } = await supabase
      .from('store_product_facets')
      .select('*')
      .eq('store_id', data.storeId)
      .eq('slug', slug)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      const values = await facetsService.getFacetValues(existing.id);
      return mapFacetRow(existing, values);
    }

    const { data: row, error } = await supabase
      .from('store_product_facets')
      .insert({
        store_id: data.storeId,
        owner_id: ownerId,
        name: data.name,
        slug,
        input_type: data.inputType,
        show_in_product_form: data.showInProductForm,
        show_in_catalog_filters: data.showInCatalogFilters,
        show_in_mega_menu: data.showInMegaMenu,
        applies_to_all_categories: data.appliesToAllCategories,
        sort_order: data.sortOrder,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (!data.appliesToAllCategories && data.applicableCategories && data.applicableCategories.length > 0) {
      await facetsService.setFacetCategories(row.id, data.applicableCategories);
      return mapFacetRow(row, [], data.applicableCategories);
    }
    return mapFacetRow(row, []);
  },

  async updateFacet(id: string, data: FacetUpdate): Promise<StoreFacet> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) { patch.name = data.name; patch.slug = data.slug ?? slugify(data.name); }
    if (data.inputType !== undefined) patch.input_type = data.inputType;
    if (data.showInProductForm !== undefined) patch.show_in_product_form = data.showInProductForm;
    if (data.showInCatalogFilters !== undefined) patch.show_in_catalog_filters = data.showInCatalogFilters;
    if (data.showInMegaMenu !== undefined) patch.show_in_mega_menu = data.showInMegaMenu;
    if (data.appliesToAllCategories !== undefined) patch.applies_to_all_categories = data.appliesToAllCategories;
    if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    const { data: row, error } = await supabase
      .from('store_product_facets')
      .update(patch as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const [values, categories] = await Promise.all([
      facetsService.getFacetValues(id),
      supabase.from('store_product_facet_categories').select('category_id, applies_to_children').eq('facet_id', id),
    ]);
    const applicableCategories: FacetCategoryAssignment[] = (categories.data ?? []).map((c) => ({
      categoryId: c.category_id,
      appliesToChildren: c.applies_to_children,
    }));
    return mapFacetRow(row, values, applicableCategories);
  },

  async setFacetCategories(facetId: string, assignments: FacetCategoryAssignment[]): Promise<void> {
    const { error: deleteError } = await supabase
      .from('store_product_facet_categories')
      .delete()
      .eq('facet_id', facetId);
    if (deleteError) throw new Error(deleteError.message);
    if (assignments.length === 0) return;
    const { error } = await supabase
      .from('store_product_facet_categories')
      .insert(assignments.map((a) => ({
        facet_id: facetId,
        category_id: a.categoryId,
        applies_to_children: a.appliesToChildren,
      })));
    if (error) throw new Error(error.message);
  },

  async deleteFacet(id: string): Promise<void> {
    const { error } = await supabase.from('store_product_facets').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getFacetValues(facetId: string): Promise<StoreFacetValue[]> {
    const { data, error } = await supabase
      .from('store_product_facet_values')
      .select('*')
      .eq('facet_id', facetId)
      .order('sort_order', { ascending: true })
      .order('value', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapFacetValueRow);
  },

  async createFacetValue(data: FacetValueInsert): Promise<StoreFacetValue> {
    const { data: row, error } = await supabase
      .from('store_product_facet_values')
      .insert({
        store_id: data.storeId,
        facet_id: data.facetId,
        value: data.value,
        slug: data.slug || slugify(data.value),
        sort_order: data.sortOrder,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapFacetValueRow(row);
  },

  async updateFacetValue(id: string, data: { value?: string; slug?: string; sortOrder?: number; isActive?: boolean }): Promise<StoreFacetValue> {
    const patch: Record<string, unknown> = {};
    if (data.value !== undefined) patch.value = data.value;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    const { data: row, error } = await supabase
      .from('store_product_facet_values')
      .update(patch as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapFacetValueRow(row);
  },

  async deleteFacetValue(id: string): Promise<void> {
    const { error } = await supabase.from('store_product_facet_values').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getProductFacetValueIds(productId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('product_facet_values')
      .select('facet_value_id')
      .eq('product_id', productId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.facet_value_id);
  },

  async setProductFacetValues(productId: string, facetValueIds: string[]): Promise<void> {
    await supabase.from('product_facet_values').delete().eq('product_id', productId);
    if (facetValueIds.length === 0) return;
    const rows = facetValueIds.map((fvId) => ({ product_id: productId, facet_value_id: fvId }));
    const { error } = await supabase.from('product_facet_values').insert(rows);
    if (error) throw new Error(error.message);
  },

  async findOrCreateFacetValue(storeId: string, facetId: string, value: string): Promise<StoreFacetValue> {
    const slug = slugify(value);
    const { data: existing } = await supabase
      .from('store_product_facet_values')
      .select('*')
      .eq('facet_id', facetId)
      .eq('slug', slug)
      .maybeSingle();
    if (existing) return mapFacetValueRow(existing);

    const { data: maxRow } = await supabase
      .from('store_product_facet_values')
      .select('sort_order')
      .eq('facet_id', facetId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSort = (maxRow?.sort_order ?? -1) + 1;
    return facetsService.createFacetValue({ storeId, facetId, value, slug, sortOrder: nextSort });
  },

  async getPublicFacets(storeSlug: string): Promise<PublicStoreFacet[]> {
    const [{ data: storeFacetRow, error: storeFacetError }, facetsResult, valuesResult, productFacetValuesResult] = await Promise.all([
      supabase.from('public_store_facets').select('store_id').eq('store_slug', storeSlug).limit(1).maybeSingle(),
      supabase
        .from('public_store_facets')
        .select('*')
        .eq('store_slug', storeSlug)
        .order('sort_order', { ascending: true }),
      supabase
        .from('public_store_facet_values')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('public_product_facet_values')
        .select('store_id, facet_value_id')
        .order('facet_value_id', { ascending: true }),
    ]);
    if (storeFacetError) throw new Error(storeFacetError.message);
    if (facetsResult.error) throw new Error(facetsResult.error.message);
    if (valuesResult.error) throw new Error(valuesResult.error.message);
    if (productFacetValuesResult.error) throw new Error(productFacetValuesResult.error.message);

    const storeId = storeFacetRow?.store_id ?? null;
    const activeFacetValueIds = new Set(
      (productFacetValuesResult.data ?? [])
        .filter((row) => row.store_id === storeId)
        .map((row) => row.facet_value_id)
    );

    const valuesByFacetId = new Map<string, PublicStoreFacetValue[]>();
    for (const row of (valuesResult.data ?? [])) {
      if (storeId && row.store_id !== storeId) continue;
      if (activeFacetValueIds.size > 0 && !activeFacetValueIds.has(row.id)) continue;
      const val: PublicStoreFacetValue = {
        id: row.id,
        storeId: row.store_id,
        facetId: row.facet_id,
        value: row.value,
        slug: row.slug,
        sortOrder: row.sort_order,
      };
      const list = valuesByFacetId.get(row.facet_id) ?? [];
      list.push(val);
      valuesByFacetId.set(row.facet_id, list);
    }

    return (facetsResult.data ?? []).map((row) => {
      const applicableCategories: FacetApplicableCategory[] = Array.isArray(row.applicable_categories)
        ? (row.applicable_categories as Array<Record<string, unknown>>).map((item) => ({
            categoryId: String(item.category_id ?? ''),
            appliesToChildren: item.applies_to_children !== false,
          }))
        : [];

      return {
        id: row.id,
        storeId: row.store_id,
        storeSlug: row.store_slug,
        name: row.name,
        slug: row.slug,
        inputType: (row.input_type as 'single_select' | 'multi_select') ?? 'single_select',
        showInCatalogFilters: row.show_in_catalog_filters ?? true,
        showInMegaMenu: row.show_in_mega_menu ?? false,
        appliesToAllCategories: row.applies_to_all_categories ?? true,
        applicableCategories,
        sortOrder: row.sort_order ?? 0,
        values: valuesByFacetId.get(row.id) ?? [],
      };
    });
  },
};
