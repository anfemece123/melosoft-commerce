import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  Minus,
  PackagePlus,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AmendOrderItemsPayload,
  NewOrderItemAmendment,
  Order,
} from '@/features/orders/orders.types';
import { productsService } from '@/features/products/productsService';
import { productOptionsService } from '@/features/products/productOptionsService';
import { productVariantsService } from '@/features/products/productVariantsService';
import type { Product, ProductOptionGroup } from '@/features/products/products.types';
import type {
  ProductVariant,
  ProductVariantOption,
} from '@/features/products/productVariants.types';
import { formatCurrency } from '@/utils/formatCurrency';
import { scrollToFirstError } from '@/hooks/useScrollToFirstFormikError';

interface OrderItemsAmendDialogProps {
  order: Order;
  onConfirm: (payload: AmendOrderItemsPayload) => Promise<void>;
  onClose: () => void;
}

type OptionSelections = Record<string, string[]>;

interface PendingAddition extends NewOrderItemAmendment {
  clientId: string;
  productName: string;
  productImageUrl: string | null;
  variantLabel: string | null;
  customizationLabels: string[];
  unitPriceEstimate: number;
}

function getProductPrice(product: Product): number {
  return product.salePrice ?? product.regularPrice;
}

function getVariantLabel(variant: ProductVariant, options: ProductVariantOption[]): string | null {
  const values = [...options]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(option => {
      const selected = variant.selectedValues.find(value => value.optionId === option.id);
      return option.values.find(value => value.id === selected?.optionValueId)?.value ?? null;
    })
    .filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join(' / ') : variant.sku;
}

function buildInitialSelections(groups: ProductOptionGroup[]): OptionSelections {
  return Object.fromEntries(groups.map(group => {
    const defaults = group.items.filter(item => item.isActive && item.isDefault).map(item => item.id);
    return [group.id, group.selectionType === 'single' ? defaults.slice(0, 1) : defaults];
  }));
}

function validateSelections(groups: ProductOptionGroup[], selections: OptionSelections): string | null {
  for (const group of groups) {
    const count = (selections[group.id] ?? []).length;
    const minimum = group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect;
    if (count < minimum) return `Completa la opción obligatoria “${group.name}”.`;
    if (group.selectionType === 'single' && count > 1) return `Selecciona solo una opción en “${group.name}”.`;
    if (group.maxSelect !== null && count > group.maxSelect) {
      return `“${group.name}” permite máximo ${group.maxSelect} opciones.`;
    }
  }
  return null;
}

function createClientId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function OrderItemsAmendDialog({ order, onConfirm, onClose }: OrderItemsAmendDialogProps) {
  const titleId = useId();
  const loadSequence = useRef(0);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries((order.items ?? []).map(item => [item.id, item.quantity])),
  );
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [catalog, setCatalog] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantOptions, setVariantOptions] = useState<ProductVariantOption[]>([]);
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [optionSelections, setOptionSelections] = useState<OptionSelections>({});
  const [addQuantity, setAddQuantity] = useState(1);
  const [customizationNote, setCustomizationNote] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [additions, setAdditions] = useState<PendingAddition[]>([]);

  const selectedProduct = catalog.find(product => product.id === selectedProductId) ?? null;
  const activeVariants = variants.filter(variant => variant.status === 'active');
  const selectedVariant = activeVariants.find(variant => variant.id === selectedVariantId) ?? null;
  const activeOptionGroups = optionGroups
    .filter(group => group.isActive)
    .map(group => ({ ...group, items: group.items.filter(item => item.isActive) }))
    .filter(group => group.items.length > 0);

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-CO');
    if (!query) return catalog.slice(0, 100);
    return catalog
      .filter(product => `${product.name} ${product.sku ?? ''}`.toLocaleLowerCase('es-CO').includes(query))
      .slice(0, 100);
  }, [catalog, search]);

  const retained = (order.items ?? []).filter(item => (quantities[item.id] ?? 0) > 0);
  const currentSubtotal = useMemo(
    () => retained.reduce((sum, item) => sum + item.unitPrice * quantities[item.id], 0),
    [quantities, retained],
  );
  const additionsSubtotal = useMemo(
    () => additions.reduce((sum, item) => sum + item.unitPriceEstimate * item.quantity, 0),
    [additions],
  );
  const productSubtotal = currentSubtotal + additionsSubtotal;
  const existingChanged = (order.items ?? []).some(item => (quantities[item.id] ?? 0) !== item.quantity);
  const changed = existingChanged || additions.length > 0;
  const hasAnyLine = retained.length + additions.length > 0;
  const canSave = changed && hasAnyLine && reason.trim().length >= 5;

  const selectedCustomizationPrice = activeOptionGroups.reduce((total, group) => {
    const selected = optionSelections[group.id] ?? [];
    return total + group.items
      .filter(item => selected.includes(item.id))
      .reduce((sum, item) => sum + item.priceDelta, 0);
  }, 0);
  const selectedBasePrice = selectedProduct
    ? selectedVariant?.price ?? getProductPrice(selectedProduct)
    : 0;
  const selectedUnitPrice = selectedBasePrice + selectedCustomizationPrice;

  useEffect(() => {
    let active = true;
    void productsService.getProductsByStore(order.storeId)
      .then(products => {
        if (!active) return;
        setCatalog(products.filter(product => product.status === 'active' && product.isAvailable));
        setCatalogError(null);
      })
      .catch(() => {
        if (!active) return;
        setCatalogError('No se pudo cargar el catálogo. Intenta nuevamente.');
      })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [order.storeId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  function setQuantity(id: string, value: number) {
    const normalized = Number.isFinite(value) ? Math.trunc(value) : 0;
    setQuantities(current => ({ ...current, [id]: Math.max(0, Math.min(999, normalized)) }));
  }

  function resetComposer() {
    loadSequence.current += 1;
    setSelectedProductId('');
    setVariants([]);
    setVariantOptions([]);
    setOptionGroups([]);
    setSelectedVariantId('');
    setOptionSelections({});
    setAddQuantity(1);
    setCustomizationNote('');
    setAddError(null);
    setDetailsLoading(false);
  }

  async function selectProduct(productId: string) {
    const sequence = loadSequence.current + 1;
    loadSequence.current = sequence;
    setSelectedProductId(productId);
    setVariants([]);
    setVariantOptions([]);
    setOptionGroups([]);
    setSelectedVariantId('');
    setOptionSelections({});
    setCustomizationNote('');
    setAddError(null);
    if (!productId) {
      setDetailsLoading(false);
      return;
    }

    const product = catalog.find(item => item.id === productId);
    if (!product) return;
    setDetailsLoading(true);
    try {
      const [loadedVariants, loadedVariantOptions, loadedOptionGroups] = await Promise.all([
        productVariantsService.getProductVariants(product.id),
        productVariantsService.getProductVariantOptions(product.id),
        productOptionsService.getProductOptionGroups(product.id),
      ]);
      if (loadSequence.current !== sequence) return;
      const availableVariants = loadedVariants.filter(variant => variant.status === 'active');
      setVariants(availableVariants);
      setVariantOptions(loadedVariantOptions.filter(option => option.isActive));
      setOptionGroups(loadedOptionGroups);
      setOptionSelections(buildInitialSelections(loadedOptionGroups.filter(group => group.isActive)));
      const defaultVariant = availableVariants.find(variant => variant.isDefault)
        ?? (availableVariants.length === 1 ? availableVariants[0] : null);
      setSelectedVariantId(defaultVariant?.id ?? '');
    } catch {
      if (loadSequence.current === sequence) {
        setAddError('No se pudieron cargar las opciones de este producto.');
      }
    } finally {
      if (loadSequence.current === sequence) setDetailsLoading(false);
    }
  }

  function toggleOption(group: ProductOptionGroup, itemId: string) {
    setAddError(null);
    setOptionSelections(current => {
      const selected = current[group.id] ?? [];
      if (group.selectionType === 'single') {
        return { ...current, [group.id]: selected[0] === itemId ? [] : [itemId] };
      }
      if (selected.includes(itemId)) {
        return { ...current, [group.id]: selected.filter(id => id !== itemId) };
      }
      if (group.maxSelect !== null && selected.length >= group.maxSelect) {
        setAddError(`“${group.name}” permite máximo ${group.maxSelect} opciones.`);
        return current;
      }
      return { ...current, [group.id]: [...selected, itemId] };
    });
  }

  function addSelectedProduct() {
    let validationMessage: string | null;
    if (!selectedProduct) validationMessage = 'Selecciona un producto del catálogo.';
    else if (detailsLoading) validationMessage = 'Espera mientras cargamos las opciones del producto.';
    else if (activeVariants.length > 0 && !selectedVariant) {
      validationMessage = 'Selecciona una variante para agregar el producto.';
    } else if (!Number.isInteger(addQuantity) || addQuantity < 1 || addQuantity > 999) {
      validationMessage = 'La cantidad debe estar entre 1 y 999.';
    } else {
      validationMessage = validateSelections(activeOptionGroups, optionSelections);
    }
    if (!validationMessage && selectedProduct && customizationNote.trim().length > selectedProduct.specialInstructionsMaxLength) {
      validationMessage = `Las indicaciones permiten máximo ${selectedProduct.specialInstructionsMaxLength} caracteres.`;
    }
    if (!validationMessage && selectedProduct) {
      if (selectedVariant?.stockPolicy === 'deny') {
        const originallyReserved = (order.items ?? [])
          .filter(item => item.variantId === selectedVariant.id)
          .reduce((total, item) => total + item.quantity, 0);
        const desiredExisting = retained
          .filter(item => item.variantId === selectedVariant.id)
          .reduce((total, item) => total + quantities[item.id], 0);
        const desiredAdditions = additions
          .filter(item => item.variantId === selectedVariant.id)
          .reduce((total, item) => total + item.quantity, 0);
        const availableForOrder = selectedVariant.stockQuantity + originallyReserved;
        if (desiredExisting + desiredAdditions + addQuantity > availableForOrder) {
          validationMessage = `Solo hay ${availableForOrder} unidad${availableForOrder === 1 ? '' : 'es'} disponibles de esta variante para el pedido.`;
        }
      } else if (!selectedVariant && selectedProduct.trackInventory) {
        const originallyReserved = (order.items ?? [])
          .filter(item => item.productId === selectedProduct.id && item.variantId === null)
          .reduce((total, item) => total + item.quantity, 0);
        const desiredExisting = retained
          .filter(item => item.productId === selectedProduct.id && item.variantId === null)
          .reduce((total, item) => total + quantities[item.id], 0);
        const desiredAdditions = additions
          .filter(item => item.productId === selectedProduct.id && item.variantId === null)
          .reduce((total, item) => total + item.quantity, 0);
        const availableForOrder = selectedProduct.stock + originallyReserved;
        if (desiredExisting + desiredAdditions + addQuantity > availableForOrder) {
          validationMessage = `Solo hay ${availableForOrder} unidad${availableForOrder === 1 ? '' : 'es'} disponibles de este producto para el pedido.`;
        }
      }
    }
    if (!validationMessage && retained.length + additions.length >= 100) {
      validationMessage = 'El pedido alcanzó el máximo de 100 líneas de productos.';
    }
    if (validationMessage || !selectedProduct) {
      setAddError(validationMessage);
      scrollToFirstError({ fieldName: 'newOrderItemComposer' });
      return;
    }

    const customizations = activeOptionGroups.flatMap(group => {
      const selected = optionSelections[group.id] ?? [];
      return group.items
        .filter(item => selected.includes(item.id))
        .map(item => ({ optionGroupId: group.id, optionItemId: item.id }));
    });
    const customizationLabels = activeOptionGroups.flatMap(group => {
      const selected = optionSelections[group.id] ?? [];
      const labels = group.items.filter(item => selected.includes(item.id)).map(item => item.label);
      return labels.length > 0 ? [`${group.name}: ${labels.join(', ')}`] : [];
    });
    const variantLabel = selectedVariant ? getVariantLabel(selectedVariant, variantOptions) : null;
    const normalizedNote = customizationNote.trim() || null;
    const lineKey = JSON.stringify({
      productId: selectedProduct.id,
      variantId: selectedVariant?.id ?? null,
      customizations: customizations.map(item => item.optionItemId).sort(),
      note: normalizedNote,
    });

    setAdditions(current => {
      const matchingIndex = current.findIndex(item => JSON.stringify({
        productId: item.productId,
        variantId: item.variantId,
        customizations: item.customizations.map(customization => customization.optionItemId).sort(),
        note: item.customizationNotes,
      }) === lineKey);
      if (matchingIndex < 0) {
        return [...current, {
          clientId: createClientId(),
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          productImageUrl: selectedVariant?.images[0]?.imageUrl ?? selectedProduct.mainImageUrl,
          variantId: selectedVariant?.id ?? null,
          variantLabel,
          quantity: addQuantity,
          customizations,
          customizationLabels,
          customizationNotes: normalizedNote,
          unitPriceEstimate: selectedUnitPrice,
        }];
      }
      return current.map((item, index) => index === matchingIndex
        ? { ...item, quantity: Math.min(999, item.quantity + addQuantity) }
        : item);
    });
    resetComposer();
    setSubmitAttempted(false);
  }

  function setAdditionQuantity(clientId: string, value: number) {
    const quantity = Math.max(1, Math.min(999, Number.isFinite(value) ? Math.trunc(value) : 1));
    setAdditions(current => current.map(item => item.clientId === clientId ? { ...item, quantity } : item));
  }

  async function submit() {
    if (saving) return;
    setSubmitAttempted(true);
    if (!canSave) {
      scrollToFirstError({
        fieldName: !hasAnyLine || !changed ? 'orderItems' : 'itemChangeReason',
      });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        items: [
          ...retained.map(item => ({ orderItemId: item.id, quantity: quantities[item.id] })),
          ...additions.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            customizationNotes: item.customizationNotes,
            customizations: item.customizations,
          })),
        ],
        reason: reason.trim(),
        expectedUpdatedAt: order.updatedAt,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo modificar el pedido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="font-semibold text-gray-900">Modificar productos</h2>
            <p className="mt-0.5 text-xs text-gray-500">Cambia cantidades, retira líneas o agrega productos del catálogo.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Al guardar se recalculan los totales y el inventario en una sola operación. Los productos actuales conservan su precio original; los nuevos usan el precio vigente del catálogo.
          </div>

          <section aria-labelledby="current-order-items-title">
            <h3 id="current-order-items-title" className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Productos actuales</h3>
            <div data-field-name="orderItems" tabIndex={-1} aria-invalid={submitAttempted && (!hasAnyLine || !changed)} className="overflow-hidden rounded-xl border border-gray-200">
              {(order.items ?? []).map((item, index) => {
                const quantity = quantities[item.id] ?? 0;
                const removed = quantity === 0;
                return (
                  <div key={item.id} className={`flex items-center gap-3 px-3 py-3 ${index > 0 ? 'border-t border-gray-100' : ''} ${removed ? 'bg-gray-50 opacity-60' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${removed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.productNameSnapshot ?? item.name}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{formatCurrency(item.unitPrice, 'es-CO', order.currency)} c/u{item.variantLabelSnapshot ? ` · ${item.variantLabelSnapshot}` : ''}</p>
                    </div>
                    {!removed ? (
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Restar uno" onClick={() => setQuantity(item.id, quantity - 1)} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"><Minus className="h-3.5 w-3.5" /></button>
                        <input aria-label={`Cantidad de ${item.name}`} inputMode="numeric" value={quantity} onChange={event => setQuantity(item.id, Number(event.target.value) || 0)} className="w-12 rounded-md border border-gray-200 px-1 py-1.5 text-center text-sm font-semibold outline-none focus:border-indigo-400" />
                        <button type="button" aria-label="Sumar uno" onClick={() => setQuantity(item.id, quantity + 1)} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"><Plus className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label="Retirar producto" title="Retirar producto" onClick={() => setQuantity(item.id, 0)} className="ml-1 rounded-md p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setQuantity(item.id, item.quantity)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Restaurar</button>
                    )}
                  </div>
                );
              })}

              {additions.map(item => (
                <div key={item.clientId} className="flex items-start gap-3 border-t border-emerald-100 bg-emerald-50/60 px-3 py-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-emerald-600">
                    {item.productImageUrl ? <img src={item.productImageUrl} alt="" className="h-full w-full object-cover" /> : <PackagePlus className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-gray-800">{item.productName}</p>
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Nuevo</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{formatCurrency(item.unitPriceEstimate, 'es-CO', order.currency)} c/u{item.variantLabel ? ` · ${item.variantLabel}` : ''}</p>
                    {item.customizationLabels.map(label => <p key={label} className="mt-0.5 text-[11px] text-gray-500">{label}</p>)}
                    {item.customizationNotes && <p className="mt-0.5 text-[11px] italic text-gray-500">Indicaciones: {item.customizationNotes}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label={`Restar uno a ${item.productName}`} onClick={() => setAdditionQuantity(item.clientId, item.quantity - 1)} className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50"><Minus className="h-3.5 w-3.5" /></button>
                    <input aria-label={`Cantidad nueva de ${item.productName}`} inputMode="numeric" value={item.quantity} onChange={event => setAdditionQuantity(item.clientId, Number(event.target.value) || 1)} className="w-12 rounded-md border border-gray-200 bg-white px-1 py-1.5 text-center text-sm font-semibold outline-none focus:border-indigo-400" />
                    <button type="button" aria-label={`Sumar uno a ${item.productName}`} onClick={() => setAdditionQuantity(item.clientId, item.quantity + 1)} className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50"><Plus className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`Quitar ${item.productName}`} onClick={() => setAdditions(current => current.filter(addition => addition.clientId !== item.clientId))} className="ml-1 rounded-md p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-3">
                <span className="text-sm text-gray-500">Nuevo subtotal estimado</span>
                <strong className="text-sm text-gray-900">{formatCurrency(productSubtotal, 'es-CO', order.currency)}</strong>
              </div>
            </div>
            {!hasAnyLine && <p data-error-for="orderItems" role="alert" className="mt-2 text-xs text-red-600">El pedido debe conservar al menos un producto. Para eliminarlo completo, cancela el pedido.</p>}
            {submitAttempted && !changed && <p data-error-for="orderItems" role="alert" className="mt-2 text-xs text-red-600">Modifica una cantidad o agrega al menos un producto para guardar.</p>}
          </section>

          <section data-field-name="newOrderItemComposer" tabIndex={-1} aria-invalid={Boolean(addError)} className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-800">Agregar producto</h3>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Buscar en el catálogo</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre o SKU" className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </span>
            </label>
            <label className="mt-3 block space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Producto</span>
              <select value={selectedProductId} onChange={event => void selectProduct(event.target.value)} disabled={catalogLoading} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100">
                <option value="">{catalogLoading ? 'Cargando catálogo…' : 'Selecciona un producto'}</option>
                {filteredCatalog.map(product => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ''}</option>)}
              </select>
            </label>
            {catalogError && <p className="mt-2 text-xs text-red-600">{catalogError}</p>}
            {!catalogLoading && !catalogError && catalog.length === 0 && <p className="mt-2 text-xs text-gray-500">No hay productos activos y disponibles para agregar.</p>}

            {detailsLoading && <div className="mt-4 flex items-center gap-2 text-xs text-indigo-600"><Loader2 className="h-4 w-4 animate-spin" /> Cargando variantes y opciones…</div>}
            {selectedProduct && !detailsLoading && (
              <div className="mt-4 space-y-4">
                {activeVariants.length > 0 && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-gray-600">Variante *</span>
                    <select value={selectedVariantId} onChange={event => { setSelectedVariantId(event.target.value); setAddError(null); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                      <option value="">Selecciona una variante</option>
                      {activeVariants.map(variant => (
                        <option key={variant.id} value={variant.id}>
                          {getVariantLabel(variant, variantOptions) ?? 'Variante'} · {formatCurrency(variant.price ?? getProductPrice(selectedProduct), 'es-CO', order.currency)}
                          {variant.stockPolicy === 'deny' ? ` · ${variant.stockQuantity} disponibles` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {activeOptionGroups.map(group => {
                  const selected = optionSelections[group.id] ?? [];
                  const minimum = group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect;
                  return (
                    <fieldset key={group.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <legend className="px-1 text-xs font-semibold text-gray-700">{group.name}{minimum > 0 ? ' *' : ''}</legend>
                      <p className="mb-2 text-[11px] text-gray-400">
                        {group.selectionType === 'single' ? 'Selecciona una opción.' : group.maxSelect ? `Selecciona hasta ${group.maxSelect}.` : 'Puedes seleccionar varias opciones.'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map(item => {
                          const isSelected = selected.includes(item.id);
                          return (
                            <button key={item.id} type="button" onClick={() => toggleOption(group, item.id)} className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${isSelected ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200'}`}>
                              {item.label}{item.priceDelta > 0 ? ` · +${formatCurrency(item.priceDelta, 'es-CO', order.currency)}` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}

                {selectedProduct.allowsSpecialInstructions && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-gray-600">{selectedProduct.specialInstructionsLabel || 'Indicaciones especiales'} <span className="font-normal text-gray-400">(opcional)</span></span>
                    <textarea value={customizationNote} maxLength={selectedProduct.specialInstructionsMaxLength} onChange={event => setCustomizationNote(event.target.value)} placeholder={selectedProduct.specialInstructionsPlaceholder || 'Ej. sin cebolla, empacar por separado'} rows={2} className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  </label>
                )}

                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="space-y-1.5">
                    <span className="block text-xs font-medium text-gray-600">Cantidad</span>
                    <input type="number" min={1} max={999} value={addQuantity} onChange={event => setAddQuantity(Number(event.target.value))} className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  </label>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400">Precio unitario estimado</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(selectedUnitPrice, 'es-CO', order.currency)}</p>
                  </div>
                </div>
              </div>
            )}

            {addError && <p data-error-for="newOrderItemComposer" role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{addError}</p>}
            <button type="button" onClick={addSelectedProduct} disabled={detailsLoading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50 disabled:opacity-50">
              {detailsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agregar al pedido
            </button>
          </section>

          <label className="mt-4 block space-y-1.5">
            <span className="text-xs font-medium text-gray-600">Motivo del cambio *</span>
            <input id="itemChangeReason" name="itemChangeReason" value={reason} maxLength={500} placeholder="Ej. El cliente solicitó agregar otro producto" onChange={event => setReason(event.target.value)} aria-invalid={submitAttempted && reason.trim().length < 5} aria-describedby={submitAttempted && reason.trim().length < 5 ? 'itemChangeReason-error' : undefined} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            {submitAttempted && reason.trim().length < 5 && <span id="itemChangeReason-error" data-error-for="itemChangeReason" role="alert" className="text-xs text-red-600">Explica el motivo con al menos 5 caracteres.</span>}
            <span className="text-xs text-gray-400">La modificación y los valores anteriores quedarán registrados con tu usuario.</span>
          </label>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
          <p className="hidden text-xs text-gray-400 sm:block">El total definitivo se confirma al guardar.</p>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
            <button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar modificación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
