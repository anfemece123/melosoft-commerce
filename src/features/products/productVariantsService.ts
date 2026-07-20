import { supabase } from '@/lib/supabase';
import type {
  ProductVariantOptionRow,
  ProductVariantOptionRowInsert,
  ProductVariantOptionValueRow,
  ProductVariantOptionValueRowInsert,
  ProductVariantRow,
  ProductVariantRowInsert,
  ProductVariantSelectedValueRow,
} from '@/types/database.types';
import {
  mapProductVariantOptionRowToProductVariantOption,
  mapProductVariantOptionValueRowToProductVariantOptionValue,
  mapProductVariantRowToProductVariant,
  mapProductVariantSelectedValueRowToProductVariantSelectedValue,
  mapProductImageRowToProductImage,
} from './products.mapper';
import type {
  ProductVariant,
  ProductVariantDraft,
  ProductVariantOption,
  ProductVariantOptionDraft,
} from './productVariants.types';
import type { ProductImage } from './products.types';

async function getOwnerId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

// ── Reads ────────────────────────────────────────────────────

async function fetchOptions(productId: string): Promise<ProductVariantOption[]> {
  const optionsQuery = supabase
    .from('product_variant_options')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const valuesQuery = supabase
    .from('product_variant_option_values')
    .select('*, product_variant_options!inner(product_id)')
    .eq('product_variant_options.product_id', productId)
    .order('sort_order', { ascending: true })
    .order('value', { ascending: true });

  const imagesQuery = supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .not('option_value_id', 'is', null)
    .order('sort_order', { ascending: true });

  const [
    { data: options, error: optionsError },
    { data: values, error: valuesError },
    { data: valueImages, error: valueImagesError },
  ] = await Promise.all([optionsQuery, valuesQuery, imagesQuery]);

  if (optionsError) throw new Error(optionsError.message);
  if (valuesError) throw new Error(valuesError.message);
  if (valueImagesError) throw new Error(valueImagesError.message);

  const valuesByOption = new Map<string, ProductVariantOptionValueRow[]>();
  for (const row of (values ?? []) as ProductVariantOptionValueRow[]) {
    const list = valuesByOption.get(row.option_id) ?? [];
    list.push(row);
    valuesByOption.set(row.option_id, list);
  }

  const imagesByValue = new Map<string, ProductImage[]>();
  for (const row of valueImages ?? []) {
    if (!row.option_value_id) continue;
    const list = imagesByValue.get(row.option_value_id) ?? [];
    list.push(mapProductImageRowToProductImage(row));
    imagesByValue.set(row.option_value_id, list);
  }

  return ((options ?? []) as ProductVariantOptionRow[]).map((row) =>
    mapProductVariantOptionRowToProductVariantOption(
      row,
      (valuesByOption.get(row.id) ?? []).map((valueRow) =>
        mapProductVariantOptionValueRowToProductVariantOptionValue(valueRow, imagesByValue.get(valueRow.id) ?? [])
      )
    )
  );
}

async function fetchVariants(productId: string): Promise<ProductVariant[]> {
  const [{ data: variantRows, error: variantsError }, { data: selectedRows, error: selectedError }, { data: imageRows, error: imagesError }] =
    await Promise.all([
      supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('product_variant_selected_values')
        .select('*, product_variants!inner(product_id)')
        .eq('product_variants.product_id', productId),
      supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .not('variant_id', 'is', null)
        .order('sort_order', { ascending: true }),
    ]);

  if (variantsError) throw new Error(variantsError.message);
  if (selectedError) throw new Error(selectedError.message);
  if (imagesError) throw new Error(imagesError.message);

  const selectedByVariant = new Map<string, ProductVariantSelectedValueRow[]>();
  for (const row of (selectedRows ?? []) as ProductVariantSelectedValueRow[]) {
    const list = selectedByVariant.get(row.variant_id) ?? [];
    list.push(row);
    selectedByVariant.set(row.variant_id, list);
  }

  const imagesByVariant = new Map<string, ProductImage[]>();
  for (const row of imageRows ?? []) {
    if (!row.variant_id) continue;
    const list = imagesByVariant.get(row.variant_id) ?? [];
    list.push(mapProductImageRowToProductImage(row));
    imagesByVariant.set(row.variant_id, list);
  }

  return ((variantRows ?? []) as ProductVariantRow[]).map((row) => {
    const variant = mapProductVariantRowToProductVariant(
      row,
      (selectedByVariant.get(row.id) ?? []).map(mapProductVariantSelectedValueRowToProductVariantSelectedValue)
    );
    return { ...variant, images: imagesByVariant.get(row.id) ?? [] };
  });
}

// ── Combination generation ──────────────────────────────────

export function buildOptionSignature(optionValueIds: string[]): string {
  return [...optionValueIds].sort().join(',');
}

interface GeneratedCombination {
  optionSignature: string;
  optionValues: Record<string, string>;
}

/** Cartesian product of active option values, skipping options with no values. */
export function generateVariantCombinations(options: ProductVariantOptionDraft[]): GeneratedCombination[] {
  const activeOptions = options.filter((o) => o.isActive && o.values.some((v) => v.isActive));
  if (activeOptions.length === 0) return [];

  let combos: Array<Record<string, string>> = [{}];
  for (const option of activeOptions) {
    const activeValues = option.values.filter((v) => v.isActive);
    const next: Array<Record<string, string>> = [];
    for (const combo of combos) {
      for (const value of activeValues) {
        next.push({ ...combo, [option.name]: value.value });
      }
    }
    combos = next;
  }

  return combos.map((optionValues) => ({
    optionSignature: buildOptionSignature(
      activeOptions.map((option) => `${option.name}:${optionValues[option.name]}`)
    ),
    optionValues,
  }));
}

export const productVariantsService = {
  getProductVariantOptions: fetchOptions,
  getProductVariants: fetchVariants,

  /** Upserts options+values by id, deletes rows the caller removed. Never
   * touches product_variants — variants keep referencing surviving option
   * value ids via product_variant_selected_values (cascades only when the
   * admin explicitly deletes an option/value). */
  async saveVariantOptions(
    storeId: string,
    productId: string,
    drafts: ProductVariantOptionDraft[]
  ): Promise<ProductVariantOption[]> {
    const ownerId = await getOwnerId();

    const { data: existingOptions, error: existingError } = await supabase
      .from('product_variant_options')
      .select('id')
      .eq('product_id', productId);
    if (existingError) throw new Error(existingError.message);

    const keepOptionIds = new Set(drafts.filter((d) => d.id).map((d) => d.id as string));
    const optionIdsToDelete = (existingOptions ?? []).map((r) => r.id).filter((id) => !keepOptionIds.has(id));
    if (optionIdsToDelete.length > 0) {
      const { error } = await supabase.from('product_variant_options').delete().in('id', optionIdsToDelete);
      if (error) throw new Error(error.message);
    }

    const savedOptions: ProductVariantOption[] = [];

    // Defensive clamp: at most one option may control the public gallery,
    // no matter what the caller sends (the admin UI already enforces this
    // as a radio-like toggle, but this is the only write path into
    // controls_media, so it's the right place to guarantee the invariant
    // regardless of how it was called). Ties broken by array order — the
    // first one wins, the rest are forced off.
    const firstMediaOptionIndex = drafts.findIndex((d) => d.controlsMedia);

    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];
      const name = draft.name.trim();
      if (!name) continue;

      const optionRow: ProductVariantOptionRowInsert = {
        store_id: storeId,
        product_id: productId,
        owner_id: ownerId,
        name,
        type: draft.type,
        use_as_public_filter: draft.useAsPublicFilter,
        controls_media: index === firstMediaOptionIndex,
        is_required: draft.isRequired,
        is_active: draft.isActive,
        sort_order: index,
      };

      let optionId = draft.id;
      if (optionId) {
        const { error } = await supabase.from('product_variant_options').update(optionRow).eq('id', optionId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from('product_variant_options').insert(optionRow).select('id').single();
        if (error) throw new Error(error.message);
        optionId = data.id;
      }

      const { data: existingValues, error: existingValuesError } = await supabase
        .from('product_variant_option_values')
        .select('id')
        .eq('option_id', optionId);
      if (existingValuesError) throw new Error(existingValuesError.message);

      const keepValueIds = new Set(draft.values.filter((v) => v.id).map((v) => v.id as string));
      const valueIdsToDelete = (existingValues ?? []).map((r) => r.id).filter((id) => !keepValueIds.has(id));
      if (valueIdsToDelete.length > 0) {
        const { error } = await supabase.from('product_variant_option_values').delete().in('id', valueIdsToDelete);
        if (error) throw new Error(error.message);
      }

      const savedValues: ProductVariantOptionValueRow[] = [];
      for (let valueIndex = 0; valueIndex < draft.values.length; valueIndex += 1) {
        const valueDraft = draft.values[valueIndex];
        const value = valueDraft.value.trim();
        if (!value) continue;

        const valueRow: ProductVariantOptionValueRowInsert = {
          store_id: storeId,
          option_id: optionId,
          owner_id: ownerId,
          value,
          color_hex: valueDraft.colorHex || null,
          sort_order: valueIndex,
          is_active: valueDraft.isActive,
        };

        if (valueDraft.id) {
          const { data, error } = await supabase
            .from('product_variant_option_values')
            .update(valueRow)
            .eq('id', valueDraft.id)
            .select()
            .single();
          if (error) throw new Error(error.message);
          savedValues.push(data);
        } else {
          const { data, error } = await supabase
            .from('product_variant_option_values')
            .insert(valueRow)
            .select()
            .single();
          if (error) throw new Error(error.message);
          savedValues.push(data);
        }
      }

      const { data: optionRowSaved, error: optionFetchError } = await supabase
        .from('product_variant_options')
        .select('*')
        .eq('id', optionId)
        .single();
      if (optionFetchError) throw new Error(optionFetchError.message);

      // Existing values may already have an option-value gallery uploaded in
      // a previous save — fetch it so the returned ProductVariantOption[]
      // (used by the caller to match pending-image uploads by index, and to
      // resync its local draft state) reflects it accurately. Brand-new
      // values simply have none yet.
      const savedValueIds = savedValues.map((v) => v.id);
      const { data: valueImages, error: valueImagesError } = savedValueIds.length > 0
        ? await supabase.from('product_images').select('*').in('option_value_id', savedValueIds)
        : { data: [] as never[], error: null };
      if (valueImagesError) throw new Error(valueImagesError.message);
      const imagesByValueId = new Map<string, ProductImage[]>();
      for (const img of valueImages ?? []) {
        if (!img.option_value_id) continue;
        const list = imagesByValueId.get(img.option_value_id) ?? [];
        list.push(mapProductImageRowToProductImage(img));
        imagesByValueId.set(img.option_value_id, list);
      }

      savedOptions.push(
        mapProductVariantOptionRowToProductVariantOption(
          optionRowSaved,
          savedValues.map((v) =>
            mapProductVariantOptionValueRowToProductVariantOptionValue(v, imagesByValueId.get(v.id) ?? [])
          )
        )
      );
    }

    return savedOptions;
  },

  /** Upserts variants by id (preserving stock/inventory-movement history and
   * images for existing variants), deletes only the ones the caller removed,
   * and rebuilds each variant's selected_values junction from optionValues. */
  async saveVariants(
    storeId: string,
    productId: string,
    drafts: ProductVariantDraft[],
    savedOptions: ProductVariantOption[]
  ): Promise<ProductVariant[]> {
    const ownerId = await getOwnerId();

    const { data: existingVariants, error: existingError } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', productId);
    if (existingError) throw new Error(existingError.message);

    const keepVariantIds = new Set(drafts.filter((d) => d.id).map((d) => d.id as string));
    const variantIdsToDelete = (existingVariants ?? []).map((r) => r.id).filter((id) => !keepVariantIds.has(id));
    if (variantIdsToDelete.length > 0) {
      const { error } = await supabase.from('product_variants').delete().in('id', variantIdsToDelete);
      if (error) throw new Error(error.message);
    }

    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];

      // Resolve this variant's option/value pairs against the just-saved
      // options (savedOptions has real ids for both pre-existing and
      // brand-new options/values by this point).
      const resolvedPairs = Object.entries(draft.optionValues)
        .map(([optionName, value]) => {
          const option = savedOptions.find((o) => o.name === optionName);
          const optionValue = option?.values.find((v) => v.value === value);
          if (!option || !optionValue) return null;
          return { optionId: option.id, optionValueId: optionValue.id };
        })
        .filter((pair): pair is { optionId: string; optionValueId: string } => pair !== null);

      // option_signature is derived from the real option_value_ids (sorted),
      // never from option/value display text — renaming an option or a
      // value's label must never change a variant's identity, orphan its
      // stock history, or let a renamed-then-regenerated combination slip
      // past the UNIQUE(product_id, option_signature) guard as a "new" row.
      const resolvedSignature = resolvedPairs.map((p) => p.optionValueId).sort().join('|');

      // stock_quantity is intentionally excluded here — it must never be
      // silently overwritten by a form save. On insert it falls back to the
      // column's DB default (0); the real initial stock (if any) is then
      // registered as an audited "Inventario inicial" movement by the caller
      // right after this resolves (see ProductFormPage), exactly like a
      // brand-new simple product. Existing variants keep whatever stock they
      // had — the only way to change it afterwards is "Ajustar stock"
      // (adjust_variant_stock RPC), same as products.
      const variantRow: ProductVariantRowInsert = {
        store_id: storeId,
        product_id: productId,
        owner_id: ownerId,
        sku: draft.sku.trim() || null,
        barcode: draft.barcode || null,
        price: draft.price === '' ? null : draft.price,
        compare_at_price: draft.compareAtPrice === '' ? null : draft.compareAtPrice,
        stock_policy: draft.stockPolicy,
        status: draft.status,
        is_default: draft.isDefault,
        position: index,
        option_signature: resolvedSignature || draft.optionSignature,
      };

      let variantId = draft.id;
      if (variantId) {
        const { error } = await supabase.from('product_variants').update(variantRow).eq('id', variantId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from('product_variants').insert(variantRow).select('id').single();
        if (error) throw new Error(error.message);
        variantId = data.id;
      }

      // Rebuild selected_values for this variant from the resolved pairs.
      const { error: deleteSelectedError } = await supabase
        .from('product_variant_selected_values')
        .delete()
        .eq('variant_id', variantId);
      if (deleteSelectedError) throw new Error(deleteSelectedError.message);

      const selectedRows = resolvedPairs.map((pair) => ({
        variant_id: variantId as string,
        option_id: pair.optionId,
        option_value_id: pair.optionValueId,
        store_id: storeId,
      }));

      if (selectedRows.length > 0) {
        const { error } = await supabase.from('product_variant_selected_values').insert(selectedRows);
        if (error) throw new Error(error.message);
      }
    }

    return fetchVariants(productId);
  },

  async checkSkuAvailable(storeId: string, sku: string, excludeVariantId?: string): Promise<boolean> {
    const trimmed = sku.trim();
    if (!trimmed) return true;
    let query = supabase
      .from('product_variants')
      .select('id')
      .eq('store_id', storeId)
      .eq('sku', trimmed);
    if (excludeVariantId) query = query.neq('id', excludeVariantId);
    const { data, error } = await query.limit(1);
    if (error) throw new Error(error.message);
    return (data ?? []).length === 0;
  },

  async uploadVariantImage(
    storeId: string,
    productId: string,
    variantId: string,
    file: File,
    sortOrder: number,
    isPrimary: boolean
  ): Promise<ProductImage> {
    const ownerId = await getOwnerId();
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const uuid = crypto.randomUUID();
    const storagePath = `${ownerId}/stores/${storeId}/products/${productId}/${uuid}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('store-assets')
      .upload(storagePath, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(storagePath);

    const { data, error } = await supabase
      .from('product_images')
      .insert({
        store_id: storeId,
        product_id: productId,
        variant_id: variantId,
        owner_id: ownerId,
        image_url: publicUrl,
        storage_path: storagePath,
        sort_order: sortOrder,
        is_primary: isPrimary,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after variant image insert');
    return mapProductImageRowToProductImage(data);
  },

  /** Uploads an image attached to a variant OPTION VALUE (e.g. "Color:
   * Verde") rather than to one exact variant — reused by every combination
   * that has that value, so the owner doesn't re-upload the same photo per
   * size. Mutually exclusive with variant_id at the DB level (migration 047). */
  async uploadOptionValueImage(
    storeId: string,
    productId: string,
    optionValueId: string,
    file: File,
    sortOrder: number,
    isPrimary: boolean
  ): Promise<ProductImage> {
    const ownerId = await getOwnerId();
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const uuid = crypto.randomUUID();
    const storagePath = `${ownerId}/stores/${storeId}/products/${productId}/${uuid}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('store-assets')
      .upload(storagePath, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(storagePath);

    const { data, error } = await supabase
      .from('product_images')
      .insert({
        store_id: storeId,
        product_id: productId,
        option_value_id: optionValueId,
        owner_id: ownerId,
        image_url: publicUrl,
        storage_path: storagePath,
        sort_order: sortOrder,
        is_primary: isPrimary,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after option value image insert');
    return mapProductImageRowToProductImage(data);
  },
};
