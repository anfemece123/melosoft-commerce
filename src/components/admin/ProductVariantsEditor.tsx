import { useRef, useState } from 'react';
import { Plus, Trash2, Layers, ImagePlus, Wand2, Star, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { IntegerInput } from '@/components/forms/IntegerInput';
import { StockAdjustmentModal } from '@/components/admin/StockAdjustmentModal';
import { productVariantsService, generateVariantCombinations, buildOptionSignature } from '@/features/products/productVariantsService';
import { productsService } from '@/features/products/productsService';
import type {
  ProductVariantDraft,
  ProductVariantOptionDraft,
  ProductVariantOptionType,
  ProductVariantOptionValueDraft,
} from '@/features/products/productVariants.types';
import { notify } from '@/lib/notifications';

const OPTION_TYPE_LABELS: Record<ProductVariantOptionType, string> = {
  size: 'Talla',
  color: 'Color',
  material: 'Material',
  style: 'Estilo',
  custom: 'Personalizada',
};

function emptyOption(): ProductVariantOptionDraft {
  return {
    clientKey: crypto.randomUUID(),
    name: '',
    type: 'custom',
    useAsPublicFilter: true,
    controlsMedia: false,
    isRequired: true,
    isActive: true,
    values: [],
  };
}

function suggestSku(baseSku: string, optionValues: Record<string, string>): string {
  const base = (baseSku || 'VAR').trim().toUpperCase().replace(/\s+/g, '-');
  const suffix = Object.values(optionValues)
    .map((v) => v.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .join('-');
  return suffix ? `${base}-${suffix}` : base;
}

function variantLabel(optionValues: Record<string, string>): string {
  const values = Object.values(optionValues);
  return values.length > 0 ? values.join(' / ') : 'Variante';
}

// Local, ephemeral key used only to match a freshly generated combination
// against an already-drafted variant — deliberately independent of the
// persisted `option_signature` (which, once saved, is derived from real
// option_value_ids, not display text). Recomputing this from the current
// optionValues on both sides means the match still works even though the
// two use different formats, and stays correct if a value's label is
// tweaked without actually changing which combination it represents.
function comboKey(optionValues: Record<string, string>): string {
  return buildOptionSignature(Object.entries(optionValues).map(([name, value]) => `${name}:${value}`));
}

// Toggles one specific combination on/off, without ever forcing the full
// cartesian product and without ever destructively deleting a variant that
// already has a real id (which may carry stock/inventory history) — that
// case is archived (status: inactive) instead, same as the existing
// "Activa/Inactiva" button, and reactivated in place if checked again so
// option_signature/stock/SKU are never duplicated. A never-saved draft (no
// id) is simply dropped when unchecked, since nothing persisted yet.
function applyCombinationActive(
  current: ProductVariantDraft[],
  comboOptionValues: Record<string, string>,
  active: boolean,
  baseSku: string,
  unlimitedByDefault: boolean
): ProductVariantDraft[] {
  const key = comboKey(comboOptionValues);
  const index = current.findIndex((v) => comboKey(v.optionValues) === key);

  if (active) {
    if (index === -1) {
      return [
        ...current,
        {
          sku: suggestSku(baseSku, comboOptionValues),
          price: '',
          compareAtPrice: '',
          stockQuantity: '',
          stockPolicy: unlimitedByDefault ? 'allow_backorder' : 'deny',
          status: 'active',
          isDefault: current.length === 0,
          position: current.length,
          optionSignature: key,
          optionValues: comboOptionValues,
        },
      ];
    }
    if (current[index].status === 'active') return current;
    return current.map((v, i) => (i === index ? { ...v, status: 'active' } : v));
  }

  if (index === -1) return current;
  if (current[index].id) {
    if (current[index].status === 'inactive') return current;
    return current.map((v, i) => (i === index ? { ...v, status: 'inactive' } : v));
  }
  return current.filter((_, i) => i !== index);
}

interface AddCombinationFormProps {
  activeOptions: ProductVariantOptionDraft[];
  onAdd: (values: Record<string, string>) => void;
}

// For 3+ options a grid stops being practical — the owner picks one value
// per option and adds that single combination, same safety rules as the
// matrix (see applyCombinationActive).
function AddCombinationForm({ activeOptions, onAdd }: AddCombinationFormProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const canAdd = activeOptions.every((option) => draft[option.name]);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 p-3">
      {activeOptions.map((option) => (
        <Select
          key={option.clientKey}
          id={`add-combo-${option.clientKey}`}
          label={option.name}
          value={draft[option.name] ?? ''}
          onChange={(e) => setDraft((current) => ({ ...current, [option.name]: e.target.value }))}
          options={[
            { value: '', label: 'Elegir…' },
            ...option.values.filter((v) => v.isActive).map((v) => ({ value: v.value, label: v.value })),
          ]}
          className="min-w-[140px]"
        />
      ))}
      <Button
        type="button"
        variant="secondary"
        leftIcon={<Plus className="h-4 w-4" />}
        disabled={!canAdd}
        onClick={() => {
          onAdd(draft);
          setDraft({});
        }}
      >
        Agregar combinación
      </Button>
    </div>
  );
}

interface ProductVariantsEditorProps {
  storeId: string;
  productId?: string;
  hasVariants: boolean;
  onHasVariantsChange: (value: boolean) => void;
  showVariantsAsCards: boolean;
  onShowVariantsAsCardsChange: (value: boolean) => void;
  options: ProductVariantOptionDraft[];
  onOptionsChange: (options: ProductVariantOptionDraft[]) => void;
  variants: ProductVariantDraft[];
  onVariantsChange: (variants: ProductVariantDraft[]) => void;
  baseSku: string;
  basePrice: number | '';
  isMenu: boolean;
}

export function ProductVariantsEditor({
  storeId,
  productId,
  hasVariants,
  onHasVariantsChange,
  showVariantsAsCards,
  onShowVariantsAsCardsChange,
  options,
  onOptionsChange,
  variants,
  onVariantsChange,
  baseSku,
  basePrice,
  isMenu,
}: ProductVariantsEditorProps) {
  const [draftValueByOption, setDraftValueByOption] = useState<Record<number, string>>({});
  const [uploadingVariantIndex, setUploadingVariantIndex] = useState<number | null>(null);
  const [stockModalIndex, setStockModalIndex] = useState<number | null>(null);
  const [skuErrors, setSkuErrors] = useState<Record<number, string>>({});
  const [valueUploadTarget, setValueUploadTarget] = useState<{ optionIndex: number; valueIndex: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const valueFileInputRef = useRef<HTMLInputElement>(null);

  function updateOption(index: number, patch: Partial<ProductVariantOptionDraft>) {
    onOptionsChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  }

  // At most one option can drive the public gallery — otherwise it's
  // ambiguous which value's photos should show. Behaves like a radio group
  // across option cards even though each one renders as its own checkbox:
  // turning it on for one option turns it off for every other, in the same
  // state update (never two true at once, even momentarily).
  function setMediaOption(index: number, enabled: boolean) {
    onOptionsChange(options.map((option, i) => ({
      ...option,
      controlsMedia: i === index ? enabled : (enabled ? false : option.controlsMedia),
    })));
  }

  function removeOption(index: number) {
    onOptionsChange(options.filter((_, i) => i !== index));
  }

  function addValue(optionIndex: number) {
    const raw = (draftValueByOption[optionIndex] ?? '').trim();
    if (!raw) return;
    const option = options[optionIndex];
    if (option.values.some((v) => v.value.toLowerCase() === raw.toLowerCase())) {
      setDraftValueByOption((current) => ({ ...current, [optionIndex]: '' }));
      return;
    }
    updateOption(optionIndex, {
      values: [...option.values, { clientKey: crypto.randomUUID(), value: raw, isActive: true, colorHex: null }],
    });
    setDraftValueByOption((current) => ({ ...current, [optionIndex]: '' }));
  }

  function removeValue(optionIndex: number, valueIndex: number) {
    const option = options[optionIndex];
    const removed = option.values[valueIndex];
    (removed.pendingImagePreviewUrls ?? []).forEach((url) => URL.revokeObjectURL(url));
    updateOption(optionIndex, { values: option.values.filter((_, i) => i !== valueIndex) });
  }

  function updateValue(optionIndex: number, valueIndex: number, patch: Partial<ProductVariantOptionValueDraft>) {
    const option = options[optionIndex];
    updateOption(optionIndex, {
      values: option.values.map((v, i) => (i === valueIndex ? { ...v, ...patch } : v)),
    });
  }

  function handleValueUploadClick(optionIndex: number, valueIndex: number) {
    setValueUploadTarget({ optionIndex, valueIndex });
    valueFileInputRef.current?.click();
  }

  async function handleValueFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0 || !valueUploadTarget) return;
    const { optionIndex, valueIndex } = valueUploadTarget;
    const value = options[optionIndex]?.values[valueIndex];
    setValueUploadTarget(null);
    if (!value) return;

    // Value already exists in the DB — upload immediately, same idea as
    // exact-variant images.
    if (value.id && productId) {
      const existingCount = (value.images ?? []).length;
      for (let i = 0; i < files.length; i += 1) {
        try {
          const image = await productVariantsService.uploadOptionValueImage(
            storeId,
            productId,
            value.id,
            files[i],
            existingCount + i,
            existingCount === 0 && i === 0
          );
          const current = options[optionIndex]?.values[valueIndex];
          const currentImages = current?.images ?? [];
          updateValue(optionIndex, valueIndex, { images: [...currentImages, image] });
        } catch (err) {
          notify.fromError(err);
        }
      }
      notify.success('Imágenes actualizadas.');
      return;
    }

    // No real id yet — queue locally; uploaded right after the value is
    // saved (see ProductFormPage), same pattern as pending variant images.
    const previews = files.map((f) => URL.createObjectURL(f));
    updateValue(optionIndex, valueIndex, {
      pendingImageFiles: [...(value.pendingImageFiles ?? []), ...files],
      pendingImagePreviewUrls: [...(value.pendingImagePreviewUrls ?? []), ...previews],
    });
  }

  async function removeSavedValueImage(optionIndex: number, valueIndex: number, imageIndex: number) {
    const value = options[optionIndex]?.values[valueIndex];
    const image = value?.images?.[imageIndex];
    if (!value || !image) return;
    try {
      await productsService.deleteProductImage(image.id, image.storagePath);
      updateValue(optionIndex, valueIndex, { images: (value.images ?? []).filter((_, i) => i !== imageIndex) });
    } catch (err) {
      notify.fromError(err);
    }
  }

  function removePendingValueImage(optionIndex: number, valueIndex: number, fileIndex: number) {
    const value = options[optionIndex]?.values[valueIndex];
    if (!value) return;
    const url = value.pendingImagePreviewUrls?.[fileIndex];
    if (url) URL.revokeObjectURL(url);
    updateValue(optionIndex, valueIndex, {
      pendingImageFiles: (value.pendingImageFiles ?? []).filter((_, i) => i !== fileIndex),
      pendingImagePreviewUrls: (value.pendingImagePreviewUrls ?? []).filter((_, i) => i !== fileIndex),
    });
  }

  function handleGenerateVariants() {
    const combos = generateVariantCombinations(options);
    if (combos.length === 0) {
      notify.warning('Agrega al menos una opción con valores antes de generar variantes.');
      return;
    }

    const existingByComboKey = new Map(variants.map((v) => [comboKey(v.optionValues), v]));
    const nextVariants: ProductVariantDraft[] = combos.map((combo, index) => {
      const existing = existingByComboKey.get(combo.optionSignature);
      if (existing) return { ...existing, status: 'active' };
      return {
        sku: suggestSku(baseSku, combo.optionValues),
        price: '',
        compareAtPrice: '',
        stockQuantity: '',
        stockPolicy: isMenu ? 'allow_backorder' : 'deny',
        status: 'active',
        isDefault: index === 0 && variants.length === 0,
        position: index,
        optionSignature: combo.optionSignature,
        optionValues: combo.optionValues,
      };
    });

    onVariantsChange(nextVariants);
    notify.success(`${nextVariants.length} combinación(es) activada(s).`);
  }

  // ── Combination toggling (matrix / manual-add) ────────────────
  function setCombinationActive(comboOptionValues: Record<string, string>, active: boolean) {
    onVariantsChange(applyCombinationActive(variants, comboOptionValues, active, baseSku, isMenu));
  }

  function isCombinationActive(comboOptionValues: Record<string, string>): boolean {
    const key = comboKey(comboOptionValues);
    return variants.some((v) => comboKey(v.optionValues) === key && v.status === 'active');
  }

  function findCombinationDraft(comboOptionValues: Record<string, string>): ProductVariantDraft | undefined {
    const key = comboKey(comboOptionValues);
    return variants.find((v) => comboKey(v.optionValues) === key);
  }

  // Bulk row action ("Todas"/"Ninguna") — applied against one running array
  // rather than calling setCombinationActive per cell, since each of those
  // calls would otherwise read the same stale `variants` closure and only
  // the last one would stick.
  function setRowActive(rowOption: ProductVariantOptionDraft, rowValue: string, colOption: ProductVariantOptionDraft, active: boolean) {
    const colValues = colOption.values.filter((v) => v.isActive);
    let next = variants;
    for (const cv of colValues) {
      next = applyCombinationActive(
        next,
        { [rowOption.name]: rowValue, [colOption.name]: cv.value },
        active,
        baseSku,
        isMenu
      );
    }
    onVariantsChange(next);
  }

  function updateVariant(index: number, patch: Partial<ProductVariantDraft>) {
    onVariantsChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  // A variant with a real id may carry stock/inventory history — never
  // remove it from the draft outright (saveVariants treats "missing from
  // the draft list" as a hard delete). Archive it instead, same as the
  // "Activa/Inactiva" toggle. Only a never-saved row can be dropped for
  // real, since nothing exists to lose yet.
  function removeVariant(index: number) {
    const removed = variants[index];
    if (removed.id) {
      updateVariant(index, { status: 'inactive' });
      return;
    }
    if (removed.pendingImagePreviewUrl) URL.revokeObjectURL(removed.pendingImagePreviewUrl);
    onVariantsChange(variants.filter((_, i) => i !== index));
  }

  function setDefaultVariant(index: number) {
    onVariantsChange(variants.map((v, i) => ({ ...v, isDefault: i === index })));
  }

  async function handleSkuBlur(index: number) {
    const variant = variants[index];
    if (!variant.sku.trim()) {
      setSkuErrors((current) => ({ ...current, [index]: '' }));
      return;
    }
    try {
      const available = await productVariantsService.checkSkuAvailable(storeId, variant.sku, variant.id);
      setSkuErrors((current) => ({ ...current, [index]: available ? '' : 'Este SKU ya está en uso en la tienda.' }));
    } catch {
      // non-blocking — server-side save will still validate constraints
    }
  }

  function handleUploadClick(index: number) {
    setUploadingVariantIndex(index);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || uploadingVariantIndex === null) return;
    const index = uploadingVariantIndex;
    const variant = variants[index];

    // Variant already exists in the DB — upload immediately, same as before.
    if (variant.id && productId) {
      try {
        const image = await productVariantsService.uploadVariantImage(storeId, productId, variant.id, file, 0, true);
        updateVariant(index, { imageUrl: image.imageUrl, pendingImageFile: null, pendingImagePreviewUrl: null });
        notify.success('Imagen de variante actualizada.');
      } catch (err) {
        notify.fromError(err);
      } finally {
        setUploadingVariantIndex(null);
      }
      return;
    }

    // No real variant id yet (new product, or a new row added while
    // editing) — keep the file locally with a preview; it's uploaded and
    // attached to the real variant right after the product is saved.
    if (variant.pendingImagePreviewUrl) URL.revokeObjectURL(variant.pendingImagePreviewUrl);
    updateVariant(index, { pendingImageFile: file, pendingImagePreviewUrl: URL.createObjectURL(file) });
    setUploadingVariantIndex(null);
  }

  const stockModalVariant = stockModalIndex !== null ? variants[stockModalIndex] : null;

  // Drives which combination-building UI shows: a 2-D matrix (the common
  // Color x Talla case, where availability legitimately differs per value —
  // Verde only in 39/40/41, Azul only in 38/40/42), a manual add-one-at-a-
  // time form for 3+ options, or the original single-button flow for 0-1
  // options (no real combination ambiguity there, e.g. a loción's lone
  // Presentación option).
  const activeOptions = options.filter((o) => o.isActive && o.values.some((v) => v.isActive));

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Variantes de venta</h3>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
              Venta
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {isMenu
              ? 'Tamaños o presentaciones que el cliente elige y que pueden tener disponibilidad o precio propio.'
              : 'Tallas, colores o presentaciones que el cliente elige para comprar y que pueden tener stock, SKU o precio propio.'}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-gray-700">
          <button
            type="button"
            onClick={() => onHasVariantsChange(!hasVariants)}
            className={[
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
              hasVariants ? 'bg-indigo-600' : 'bg-gray-200',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                hasVariants ? 'translate-x-4' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
          Activar variantes
        </label>
      </div>

      {!hasVariants ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          {isMenu
            ? 'El plato usa el precio y la disponibilidad general. Activa variantes si se vende en tamaños o presentaciones diferentes.'
            : 'El producto usa precio, stock y SKU base (sección de arriba). Activa variantes si se vende en tallas, colores u otras combinaciones que necesiten su propio stock y precio.'}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
            {isMenu
              ? 'Cada variante empieza disponible sin límite. Cambia únicamente las presentaciones que manejen una cantidad exacta.'
              : 'El stock y el SKU ahora se gestionan por variante. El precio base se usa solo como sugerencia inicial al generar variantes.'}
          </div>

          <div className="space-y-3">
            {options.map((option, optionIndex) => (
              <div key={optionIndex} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <Input
                    id={`variant-option-name-${optionIndex}`}
                    label="Nombre visible"
                    placeholder="Ej: Talla, Color"
                    value={option.name}
                    onChange={(e) => updateOption(optionIndex, { name: e.target.value })}
                    className="min-w-[180px] flex-1"
                  />
                  <Select
                    id={`variant-option-type-${optionIndex}`}
                    label="Tipo"
                    value={option.type}
                    onChange={(e) => updateOption(optionIndex, { type: e.target.value as ProductVariantOptionType })}
                    options={Object.entries(OPTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                    className="min-w-[160px]"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(optionIndex)}
                    className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500"
                    aria-label="Eliminar opción"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={option.useAsPublicFilter}
                    onChange={(e) => updateOption(optionIndex, { useAsPublicFilter: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <span>
                    <span className="font-medium text-gray-900">Usar también como filtro público</span>
                    <span className="block text-xs text-gray-500">
                      Los valores de las variantes activas y disponibles aparecerán como filtro en el catálogo.
                    </span>
                  </span>
                </label>

                <label className="mt-2 flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={option.controlsMedia}
                    onChange={(e) => setMediaOption(optionIndex, e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <span>
                    <span className="font-medium text-gray-900">Esta será la opción visual principal del producto</span>
                    <span className="block text-xs text-gray-500">
                      Sube fotos por valor (ej. Verde) y todas sus tallas las comparten. Solo una opción puede serlo.
                    </span>
                  </span>
                </label>

                {option.controlsMedia ? (
                  <div className="mt-3 space-y-2">
                    {option.values.map((value, valueIndex) => (
                      <div key={valueIndex} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5">
                        {option.type === 'color' && value.colorHex ? (
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full border border-gray-300"
                            style={{ backgroundColor: value.colorHex }}
                          />
                        ) : null}
                        <span className="w-24 shrink-0 truncate text-sm font-medium text-gray-800">{value.value}</span>
                        <div className="flex flex-1 flex-wrap items-center gap-1.5">
                          {(value.images ?? []).map((image, imageIndex) => (
                            <div key={image.id} className="group relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                              <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => void removeSavedValueImage(optionIndex, valueIndex, imageIndex)}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                aria-label="Quitar imagen"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          {(value.pendingImagePreviewUrls ?? []).map((url, fileIndex) => (
                            <div key={url} className="group relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                              <img src={url} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removePendingValueImage(optionIndex, valueIndex, fileIndex)}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                aria-label="Quitar imagen"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleValueUploadClick(optionIndex, valueIndex)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:text-indigo-500"
                            aria-label={`Agregar imagen a ${value.value}`}
                          >
                            <ImagePlus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeValue(optionIndex, valueIndex)}
                          className="shrink-0 text-gray-400 hover:text-red-500"
                          aria-label={`Quitar ${value.value}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {option.values.map((value, valueIndex) => (
                      <span
                        key={valueIndex}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
                      >
                        {option.type === 'color' && value.colorHex ? (
                          <span
                            className="h-3 w-3 rounded-full border border-gray-300"
                            style={{ backgroundColor: value.colorHex }}
                          />
                        ) : null}
                        {value.value}
                        <button
                          type="button"
                          onClick={() => removeValue(optionIndex, valueIndex)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={`Quitar ${value.value}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-col gap-2 md:flex-row">
                  <Input
                    id={`variant-option-value-${optionIndex}`}
                    label="Agregar valor"
                    placeholder={option.type === 'size' ? 'Ej: 38, M, XL' : 'Ej: Rojo, Negro'}
                    value={draftValueByOption[optionIndex] ?? ''}
                    onChange={(e) => setDraftValueByOption((current) => ({ ...current, [optionIndex]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addValue(optionIndex);
                      }
                    }}
                    className="flex-1"
                  />
                  <div className="md:self-end">
                    <Button type="button" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => addValue(optionIndex)}>
                      Agregar valor
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => onOptionsChange([...options, emptyOption()])}>
              Agregar opción
            </Button>
            {activeOptions.length <= 1 ? (
              <Button type="button" leftIcon={<Wand2 className="h-4 w-4" />} onClick={handleGenerateVariants}>
                Generar variantes
              </Button>
            ) : null}
          </div>

          {activeOptions.length === 2 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Combinaciones válidas</p>
              <p className="text-xs text-gray-500">
                Marca solo las que existen — {activeOptions[0].name} y {activeOptions[1].name} no tienen por qué compartir los mismos valores.
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">{activeOptions[0].name}</th>
                      {activeOptions[1].values.filter((v) => v.isActive).map((cv) => (
                        <th key={cv.clientKey} className="px-3 py-2 text-center">{cv.value}</th>
                      ))}
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeOptions[0].values.filter((v) => v.isActive).map((rv) => {
                      const colValues = activeOptions[1].values.filter((v) => v.isActive);
                      const allChecked = colValues.every((cv) =>
                        isCombinationActive({ [activeOptions[0].name]: rv.value, [activeOptions[1].name]: cv.value })
                      );
                      return (
                        <tr key={rv.clientKey}>
                          <td className="px-3 py-2 font-medium text-gray-800">{rv.value}</td>
                          {colValues.map((cv) => {
                            const comboValues = { [activeOptions[0].name]: rv.value, [activeOptions[1].name]: cv.value };
                            const active = isCombinationActive(comboValues);
                            const draft = findCombinationDraft(comboValues);
                            const archived = !!draft && draft.status !== 'active';
                            return (
                              <td key={cv.clientKey} className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={(e) => setCombinationActive(comboValues, e.target.checked)}
                                  title={archived ? 'Archivada (tiene historial) — márcala para reactivarla' : undefined}
                                  className={[
                                    'h-4 w-4 rounded border-gray-300 text-indigo-600',
                                    archived ? 'ring-2 ring-amber-300' : '',
                                  ].join(' ')}
                                />
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setRowActive(activeOptions[0], rv.value, activeOptions[1], !allChecked)}
                              className="text-xs font-medium text-indigo-600 hover:underline"
                            >
                              {allChecked ? 'Ninguna' : 'Todas'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button type="button" variant="secondary" leftIcon={<Wand2 className="h-4 w-4" />} onClick={handleGenerateVariants}>
                Generar todas las combinaciones
              </Button>
            </div>
          ) : activeOptions.length >= 3 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Combinaciones válidas</p>
              <AddCombinationForm
                activeOptions={activeOptions}
                onAdd={(values) => setCombinationActive(values, true)}
              />
              <Button type="button" variant="secondary" leftIcon={<Wand2 className="h-4 w-4" />} onClick={handleGenerateVariants}>
                Generar todas las combinaciones
              </Button>
            </div>
          ) : null}

          {options.some((o) => o.controlsMedia) ? (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showVariantsAsCards}
                onChange={(e) => onShowVariantsAsCardsChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              <span>
                <span className="font-medium text-gray-900">Mostrar cada color/modelo como card en el catálogo</span>
                <span className="block text-xs text-gray-500">Si no, se muestra una sola card con swatches.</span>
              </span>
            </label>
          ) : null}

          {variants.length > 0 ? (
            <>
            <p className="text-xs text-gray-500">
              {isMenu
                ? '“Disponible sin límite” es lo recomendado para platos. Si eliges “Cantidad limitada”, registra las unidades y ajústalas cuando cambien.'
                : 'El stock inicial se registra al guardar; después se ajusta con el botón “Ajustar”.'}{' '}
              La imagen exacta por combinación es opcional y avanzada — normalmente basta con la foto por Color/Modelo de arriba.
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Variante</th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Precio</th>
                    <th className="px-3 py-2 text-left">{isMenu ? 'Disponibilidad' : 'Stock'}</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left text-gray-400" title="Opcional — solo si esta combinación exacta necesita una foto distinta a la de su Color/Modelo">
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        Imagen exacta
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left">Predet.</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {variants.map((variant, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 font-medium text-gray-900">{variantLabel(variant.optionValues)}</td>
                      <td className="px-3 py-2">
                        <Input
                          id={`variant-sku-${index}`}
                          value={variant.sku}
                          onChange={(e) => updateVariant(index, { sku: e.target.value })}
                          onBlur={() => void handleSkuBlur(index)}
                          error={skuErrors[index]}
                          className="w-32"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <MoneyInput
                          id={`variant-price-${index}`}
                          value={variant.price}
                          onChange={(v) => updateVariant(index, { price: v })}
                          placeholder={basePrice !== '' ? String(basePrice) : '0'}
                          className="w-32"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="min-w-[150px] space-y-2">
                          {isMenu ? (
                            <Select
                              id={`variant-availability-${index}`}
                              value={variant.stockPolicy}
                              onChange={(event) => updateVariant(index, {
                                stockPolicy: event.target.value as ProductVariantDraft['stockPolicy'],
                              })}
                              options={[
                                { value: 'allow_backorder', label: 'Disponible sin límite' },
                                { value: 'deny', label: 'Cantidad limitada' },
                              ]}
                              className="min-w-[170px]"
                            />
                          ) : null}

                          {(!isMenu || variant.stockPolicy === 'deny') && (
                            variant.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{variant.stockQuantity}</span>
                                <span className="text-xs text-gray-400">uds.</span>
                                {productId ? (
                                  <button
                                    type="button"
                                    onClick={() => setStockModalIndex(index)}
                                    className="text-xs font-medium text-indigo-600 hover:underline"
                                  >
                                    Ajustar
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <IntegerInput
                                min={0}
                                placeholder="Cantidad inicial"
                                value={variant.stockQuantity}
                                onChange={(value) => updateVariant(index, { stockQuantity: value })}
                                className="w-32"
                              />
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => updateVariant(index, { status: variant.status === 'active' ? 'inactive' : 'active' })}
                          className={[
                            'rounded-full px-2.5 py-1 text-xs font-medium',
                            variant.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
                          ].join(' ')}
                        >
                          {variant.status === 'active' ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleUploadClick(index)}
                          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-gray-400 hover:border-indigo-300"
                          title="Imagen (opcional)"
                        >
                          {variant.imageUrl || variant.pendingImagePreviewUrl ? (
                            <img
                              src={variant.imageUrl ?? variant.pendingImagePreviewUrl ?? undefined}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImagePlus className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setDefaultVariant(index)}
                          aria-label="Marcar como predeterminada"
                        >
                          <Star
                            className={['h-4 w-4', variant.isDefault ? 'fill-amber-400 text-amber-400' : 'text-gray-300'].join(' ')}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeVariant(index)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label="Eliminar variante"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6 text-center text-sm text-gray-500">
              Agrega valores y marca qué combinaciones existen realmente.
            </div>
          )}
        </>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFileSelected(e)} />
      <input
        ref={valueFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleValueFilesSelected(e)}
      />

      {stockModalVariant && stockModalVariant.id && productId ? (
        <StockAdjustmentModal
          open={stockModalIndex !== null}
          storeId={storeId}
          productId={productId}
          variantId={stockModalVariant.id}
          productName={variantLabel(stockModalVariant.optionValues)}
          currentStock={typeof stockModalVariant.stockQuantity === 'number' ? stockModalVariant.stockQuantity : 0}
          onClose={() => setStockModalIndex(null)}
          onStockUpdated={(_id, newStock) => {
            if (stockModalIndex !== null) updateVariant(stockModalIndex, { stockQuantity: newStock });
          }}
          restaurantMode={isMenu}
        />
      ) : null}
    </div>
  );
}
