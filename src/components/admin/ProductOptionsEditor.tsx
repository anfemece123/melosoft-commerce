import { useEffect, useMemo, useState } from 'react';
import { Archive, BookOpen, Layers3, Link2, Package, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { IntegerInput } from '@/components/forms/IntegerInput';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { productOptionsService, type ProductOptionGroupDraft, type ProductOptionLibraryItem } from '@/features/products/productOptionsService';
import { productsService } from '@/features/products/productsService';
import { productVariantsService } from '@/features/products/productVariantsService';
import type { Product } from '@/features/products/products.types';
import type { ProductVariant } from '@/features/products/productVariants.types';
import { formatCurrency } from '@/utils/formatCurrency';
import { notify } from '@/lib/notifications';
import {
  cloneTemplateGroups,
  restaurantMerchandisingService,
  type ProductOptionTemplate,
} from '@/features/restaurants/restaurantMerchandisingService';

interface ProductOptionsEditorProps {
  currency: string;
  storeId: string;
  productId?: string;
  groups: ProductOptionGroupDraft[];
  onChange: (groups: ProductOptionGroupDraft[]) => void;
  showTemplatePicker?: boolean;
}

function createEmptyItem() {
  return {
    label: '',
    description: '',
    priceDelta: 0,
    linkedProductId: null,
    linkedVariantId: null,
    linkedQuantity: 1,
    priceMode: 'custom' as const,
    isDefault: false,
    isActive: true,
  };
}

function createEmptyGroup(): ProductOptionGroupDraft {
  return {
    name: '',
    description: '',
    selectionType: 'single',
    minSelect: 0,
    maxSelect: 1,
    isRequired: false,
    isActive: true,
    items: [createEmptyItem()],
  };
}

export function ProductOptionsEditor({
  currency,
  storeId,
  productId,
  groups,
  onChange,
  showTemplatePicker = true,
}: ProductOptionsEditorProps) {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariant[]>>({});
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ProductOptionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [libraryItems, setLibraryItems] = useState<ProductOptionLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTargetGroupIndex, setLibraryTargetGroupIndex] = useState<number | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryUpdatingId, setLibraryUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void productsService.getProductsByStore(storeId)
      .then((products) => {
        if (!cancelled) {
          setCatalogProducts(products.filter((product) => product.id !== productId));
        }
      })
      .catch(() => {
        if (!cancelled) setCatalogLoadError('No pudimos cargar el catálogo. Guarda el producto e inténtalo nuevamente.');
      });
    return () => { cancelled = true; };
  }, [productId, storeId]);

  useEffect(() => {
    if (!showTemplatePicker) return;
    let cancelled = false;
    void restaurantMerchandisingService.getTemplates(storeId)
      .then((rows) => {
        if (!cancelled) setTemplates(rows.filter((template) => template.isActive));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [showTemplatePicker, storeId]);

  useEffect(() => {
    let cancelled = false;
    // The loading flag belongs to this route-scoped async synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLibraryLoading(true);
    void productOptionsService.getLibraryItems(storeId)
      .then((items) => {
        if (!cancelled) {
          setLibraryItems(items);
          setLibraryError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLibraryError('No pudimos cargar la biblioteca de adicionales.');
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => { cancelled = true; };
  }, [storeId]);

  const productsById = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, product])),
    [catalogProducts]
  );

  async function ensureVariants(linkedProductId: string): Promise<ProductVariant[]> {
    if (variantsByProduct[linkedProductId]) return variantsByProduct[linkedProductId];
    const variants = await productVariantsService.getProductVariants(linkedProductId);
    const active = variants.filter((variant) => variant.status === 'active');
    setVariantsByProduct((current) => ({ ...current, [linkedProductId]: active }));
    return active;
  }

  useEffect(() => {
    const linkedIds = Array.from(new Set(groups.flatMap((group) => group.items)
      .map((item) => item.linkedProductId)
      .filter((id): id is string => Boolean(id))));
    linkedIds.forEach((id) => { void ensureVariants(id).catch(() => undefined); });
    // The map is a cache; rerunning because it changed would refetch nothing
    // but would make this effect harder to reason about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  function activeCatalogPrice(product: Product, variant?: ProductVariant | null): number {
    return variant?.price ?? product.salePrice ?? product.regularPrice;
  }

  function variantLabel(variant: ProductVariant): string {
    return variant.selectedValues.map((value) => value.value).filter(Boolean).join(' / ')
      || variant.sku
      || 'Presentación';
  }

  function updateGroup(index: number, updater: (group: ProductOptionGroupDraft) => ProductOptionGroupDraft) {
    onChange(groups.map((group, currentIndex) => (currentIndex === index ? updater(group) : group)));
  }

  const filteredLibraryItems = useMemo(() => {
    const normalizedSearch = librarySearch.trim().toLocaleLowerCase();
    if (!normalizedSearch) return libraryItems;
    return libraryItems.filter((item) => [item.label, item.description ?? ''].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)));
  }, [libraryItems, librarySearch]);

  function openLibrary(groupIndex?: number) {
    setLibraryTargetGroupIndex(groupIndex ?? (groups.length === 1 ? 0 : null));
    setLibrarySearch('');
    setLibraryOpen(true);
  }

  function applyLibraryItem(item: ProductOptionLibraryItem) {
    if (libraryTargetGroupIndex === null) {
      notify.info('Selecciona primero el grupo donde quieres agregar el adicional.');
      return;
    }
    const targetGroup = groups[libraryTargetGroupIndex];
    if (!targetGroup) return;
    if (productId && item.linkedProductId === productId) {
      notify.error('Este adicional no puede vincular el mismo plato que estás editando.');
      return;
    }
    if (targetGroup.items.some((currentItem) => currentItem.label.trim().toLocaleLowerCase() === item.label.trim().toLocaleLowerCase())) {
      notify.info(`“${item.label}” ya está agregado en este grupo.`);
      return;
    }
    updateGroup(libraryTargetGroupIndex, (current) => ({
      ...current,
      items: [...current.items, {
        label: item.label,
        description: item.description,
        priceDelta: item.priceDelta,
        linkedProductId: item.linkedProductId,
        linkedVariantId: item.linkedVariantId,
        linkedQuantity: item.linkedQuantity,
        priceMode: item.priceMode,
        isDefault: false,
        isActive: true,
      }],
    }));
    setLibraryOpen(false);
    notify.success(`“${item.label}” agregado al grupo.`);
  }

  async function deactivateLibraryItem(item: ProductOptionLibraryItem) {
    setLibraryUpdatingId(item.id);
    try {
      await productOptionsService.deactivateLibraryItem(item.id);
      setLibraryItems((current) => current.filter((libraryItem) => libraryItem.id !== item.id));
      notify.success('Adicional retirado de la biblioteca.');
    } catch (error) {
      notify.fromError(error, 'No pudimos retirar el adicional de la biblioteca.');
    } finally {
      setLibraryUpdatingId(null);
    }
  }

  return (
    <>
      <Card>
      <CardBody className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Opciones y adicionales del plato</h3>
            <p className="mt-1 text-sm text-gray-500">
              Permite que el cliente elija salsas, acompañamientos, tamaños o extras antes de agregar el plato al carrito.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => onChange([...groups, createEmptyGroup()])}
          >
            Agregar grupo
          </Button>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <strong>Inventario y reutilización:</strong> cada opción que guardes en un plato quedará disponible automáticamente en la biblioteca de la empresa. Si agregas una bebida, postre u otro artículo vendible, vincúlalo con el catálogo para compartir su precio y descontar el mismo inventario.
        </div>

        {showTemplatePicker && templates.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="option-template" className="mb-1 block text-sm font-medium text-gray-700">
                Plantilla reutilizable
              </label>
              <select
                id="option-template"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecciona una plantilla</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Layers3 className="h-4 w-4" />}
              disabled={!selectedTemplateId}
              onClick={() => {
                const template = templates.find((current) => current.id === selectedTemplateId);
                if (!template) return;
                onChange([...groups, ...cloneTemplateGroups(template.groups)]);
                setSelectedTemplateId('');
              }}
            >
              Aplicar plantilla
            </Button>
          </div>
        ) : null}

        {catalogLoadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{catalogLoadError}</div>
        ) : null}

        {!catalogLoadError && catalogProducts.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Para vincular bebidas, postres u otros productos, créalos primero como productos independientes del catálogo. Las preferencias sin inventario, como “sin cebolla”, pueden configurarse como opciones simples.
          </div>
        ) : null}

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6 text-sm text-gray-500">
            Aún no hay opciones configuradas. Ejemplos: Salsas, Acompañamientos, Término de la carne, Tamaño, Bebida, Adiciones.
          </div>
        ) : null}

        <div className="space-y-4">
          {groups.map((group, groupIndex) => (
            <div key={`group-${groupIndex}`} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Grupo {groupIndex + 1}</p>
                  <p className="text-xs text-gray-500">
                    Selección única para tamaño o término; múltiple para salsas, extras o adiciones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white text-red-500 transition-colors hover:bg-red-50"
                  aria-label="Eliminar grupo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  id={`group-name-${groupIndex}`}
                  label="Nombre del grupo"
                  placeholder="Ej: Salsas"
                  value={group.name}
                  onChange={(event) => updateGroup(groupIndex, (current) => ({ ...current, name: event.target.value }))}
                />
                <Textarea
                  id={`group-description-${groupIndex}`}
                  label="Descripción"
                  rows={2}
                  placeholder="Ej: Elige hasta 2 salsas"
                  value={group.description ?? ''}
                  onChange={(event) => updateGroup(groupIndex, (current) => ({ ...current, description: event.target.value }))}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de selección</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'single', label: 'Única' },
                      { value: 'multiple', label: 'Múltiple' },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateGroup(groupIndex, (current) => ({
                          ...current,
                          selectionType: option.value,
                          maxSelect: option.value === 'single' ? 1 : current.maxSelect,
                        }))}
                        className={[
                          'rounded-lg border px-3 py-2 text-sm transition-colors',
                          group.selectionType === option.value
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                        ].join(' ')}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <IntegerInput
                  id={`group-min-${groupIndex}`}
                  label="Mínimo"
                  min={0}
                  value={group.minSelect}
                  onChange={(value) => updateGroup(groupIndex, (current) => ({
                    ...current,
                    minSelect: value,
                  }))}
                />

                <IntegerInput
                  id={`group-max-${groupIndex}`}
                  label="Máximo"
                  min={1}
                  disabled={group.selectionType === 'single'}
                  value={group.maxSelect ?? ''}
                  onChange={(value) => updateGroup(groupIndex, (current) => ({
                    ...current,
                    maxSelect: value === '' ? null : value,
                  }))}
                  hint={group.selectionType === 'single' ? 'Fijo en 1 para selección única' : 'Déjalo vacío si no hay tope'}
                />

                <div className="space-y-3 pt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={group.isRequired}
                      onChange={(event) => updateGroup(groupIndex, (current) => ({
                        ...current,
                        isRequired: event.target.checked,
                        minSelect: event.target.checked && current.minSelect === 0 ? 1 : current.minSelect,
                      }))}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Obligatorio
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={group.isActive}
                      onChange={(event) => updateGroup(groupIndex, (current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Visible en pedidos
                  </label>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">Opciones del grupo</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      leftIcon={<BookOpen className="h-4 w-4" />}
                      onClick={() => openLibrary(groupIndex)}
                      disabled={libraryLoading}
                    >
                      Usar de biblioteca
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      leftIcon={<Plus className="h-4 w-4" />}
                      onClick={() => updateGroup(groupIndex, (current) => ({
                        ...current,
                        items: [...current.items, createEmptyItem()],
                      }))}
                    >
                      Agregar opción
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {group.items.map((item, itemIndex) => (
                    <div key={`group-${groupIndex}-item-${itemIndex}`} className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="mb-4 flex flex-wrap gap-2">
                        {([
                          { linked: false, label: 'Opción simple', icon: <Plus className="h-3.5 w-3.5" /> },
                          { linked: true, label: 'Producto del catálogo', icon: <Link2 className="h-3.5 w-3.5" /> },
                        ] as const).map((source) => {
                          const selected = source.linked === Boolean(item.linkedProductId);
                          return (
                            <button
                              key={source.label}
                              type="button"
                              onClick={() => updateGroup(groupIndex, (current) => ({
                                ...current,
                                items: current.items.map((currentItem, currentIndex) => currentIndex === itemIndex
                                  ? source.linked
                                    ? {
                                        ...currentItem,
                                        linkedProductId: catalogProducts[0]?.id ?? null,
                                        linkedVariantId: null,
                                        linkedQuantity: 1,
                                        priceMode: 'catalog',
                                        label: currentItem.label || catalogProducts[0]?.name || '',
                                        priceDelta: catalogProducts[0] ? activeCatalogPrice(catalogProducts[0]) : currentItem.priceDelta,
                                      }
                                    : { ...currentItem, linkedProductId: null, linkedVariantId: null, linkedQuantity: 1, priceMode: 'custom' }
                                  : currentItem),
                              }))}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                            >
                              {source.icon}{source.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                        <Input
                          id={`item-label-${groupIndex}-${itemIndex}`}
                          label="Nombre"
                          placeholder="Ej: BBQ"
                          value={item.label}
                          onChange={(event) => updateGroup(groupIndex, (current) => ({
                            ...current,
                            items: current.items.map((currentItem, currentIndex) => (
                              currentIndex === itemIndex
                                ? { ...currentItem, label: event.target.value }
                                : currentItem
                            )),
                          }))}
                        />
                        <Input
                          id={`item-description-${groupIndex}-${itemIndex}`}
                          label="Descripción"
                          placeholder="Ej: Salsa aparte"
                          value={item.description ?? ''}
                          onChange={(event) => updateGroup(groupIndex, (current) => ({
                            ...current,
                            items: current.items.map((currentItem, currentIndex) => (
                              currentIndex === itemIndex
                                ? { ...currentItem, description: event.target.value }
                                : currentItem
                            )),
                          }))}
                        />
                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => updateGroup(groupIndex, (current) => ({
                              ...current,
                              items: current.items.filter((_, currentIndex) => currentIndex !== itemIndex),
                            }))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 text-red-500 transition-colors hover:bg-red-50"
                            aria-label="Eliminar opción"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {item.linkedProductId ? (
                        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div>
                              <label htmlFor={`item-product-${groupIndex}-${itemIndex}`} className="mb-1 block text-sm font-medium text-gray-700">Producto que se descontará</label>
                              <select
                                id={`item-product-${groupIndex}-${itemIndex}`}
                                value={item.linkedProductId}
                                onChange={(event) => {
                                  const nextProduct = productsById.get(event.target.value);
                                  void ensureVariants(event.target.value).catch(() => undefined);
                                  updateGroup(groupIndex, (current) => ({
                                    ...current,
                                    items: current.items.map((currentItem, currentIndex) => currentIndex === itemIndex
                                      ? {
                                          ...currentItem,
                                          linkedProductId: event.target.value,
                                          linkedVariantId: null,
                                          label: nextProduct?.name ?? currentItem.label,
                                          priceDelta: nextProduct ? activeCatalogPrice(nextProduct) : currentItem.priceDelta,
                                        }
                                      : currentItem),
                                  }));
                                }}
                                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              >
                                <option value="">Selecciona un producto</option>
                                {catalogProducts.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}{product.status !== 'active' ? ' · Borrador' : !product.isAvailable ? ' · No disponible' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {productsById.get(item.linkedProductId)?.hasVariants ? (
                              <div>
                                <label htmlFor={`item-variant-${groupIndex}-${itemIndex}`} className="mb-1 block text-sm font-medium text-gray-700">Presentación</label>
                                <select
                                  id={`item-variant-${groupIndex}-${itemIndex}`}
                                  value={item.linkedVariantId ?? ''}
                                  onChange={(event) => {
                                    const product = productsById.get(item.linkedProductId!);
                                    const variant = (variantsByProduct[item.linkedProductId!] ?? []).find((candidate) => candidate.id === event.target.value);
                                    updateGroup(groupIndex, (current) => ({
                                      ...current,
                                      items: current.items.map((currentItem, currentIndex) => currentIndex === itemIndex
                                        ? {
                                            ...currentItem,
                                            linkedVariantId: event.target.value || null,
                                            label: product && variant ? `${product.name} · ${variantLabel(variant)}` : currentItem.label,
                                            priceDelta: product && variant ? activeCatalogPrice(product, variant) : currentItem.priceDelta,
                                          }
                                        : currentItem),
                                    }));
                                  }}
                                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                  <option value="">Selecciona una presentación</option>
                                  {(variantsByProduct[item.linkedProductId] ?? []).map((variant) => (
                                    <option key={variant.id} value={variant.id}>
                                      {variantLabel(variant)}{variant.stockPolicy === 'deny' && variant.stockQuantity < 1 ? ' · Agotada' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm text-indigo-800 md:mt-6">
                                <Package className="h-4 w-4" /> Producto sin presentaciones
                              </div>
                            )}

                            <IntegerInput
                              id={`item-linked-qty-${groupIndex}-${itemIndex}`}
                              label="Unidades por selección"
                              min={1}
                              value={item.linkedQuantity}
                              onChange={(value) => updateGroup(groupIndex, (current) => ({
                                ...current,
                                items: current.items.map((currentItem, currentIndex) => currentIndex === itemIndex ? { ...currentItem, linkedQuantity: value } : currentItem),
                              }))}
                              hint="Ej: 1 gaseosa por combo"
                            />
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                            <div>
                              <span className="mb-2 block text-sm font-medium text-gray-700">Precio en esta opción</span>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  { value: 'catalog', label: 'Usar precio actual del catálogo' },
                                  { value: 'custom', label: 'Definir precio especial' },
                                ] as const).map((mode) => (
                                  <button
                                    key={mode.value}
                                    type="button"
                                    onClick={() => {
                                      const product = productsById.get(item.linkedProductId!);
                                      const variant = (variantsByProduct[item.linkedProductId!] ?? []).find((candidate) => candidate.id === item.linkedVariantId);
                                      updateGroup(groupIndex, (current) => ({
                                        ...current,
                                        items: current.items.map((currentItem, currentIndex) => currentIndex === itemIndex
                                          ? { ...currentItem, priceMode: mode.value, priceDelta: mode.value === 'catalog' && product ? activeCatalogPrice(product, variant) : currentItem.priceDelta }
                                          : currentItem),
                                      }));
                                    }}
                                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${item.priceMode === mode.value ? 'border-indigo-600 bg-white text-indigo-700' : 'border-gray-200 bg-white/70 text-gray-600'}`}
                                  >{mode.label}</button>
                                ))}
                              </div>
                            </div>
                            {item.priceMode === 'custom' ? (
                              <MoneyInput
                                id={`item-price-${groupIndex}-${itemIndex}`}
                                label="Precio adicional"
                                currency={currency}
                                value={item.priceDelta}
                                onChange={(value) => updateGroup(groupIndex, (current) => ({ ...current, items: current.items.map((currentItem, currentIndex) => currentIndex === itemIndex ? { ...currentItem, priceDelta: value } : currentItem) }))}
                              />
                            ) : (
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 md:mt-6">
                                {formatCurrency(Number(item.priceDelta) || 0, 'es-CO', currency)}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 max-w-[180px]">
                          <MoneyInput
                            id={`item-price-${groupIndex}-${itemIndex}`}
                            label="Precio adicional"
                            currency={currency}
                            value={item.priceDelta}
                            onChange={(value) => updateGroup(groupIndex, (current) => ({ ...current, items: current.items.map((currentItem, currentIndex) => currentIndex === itemIndex ? { ...currentItem, priceDelta: value } : currentItem) }))}
                          />
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={item.isDefault}
                            onChange={(event) => updateGroup(groupIndex, (current) => ({
                              ...current,
                              items: current.items.map((currentItem, currentIndex) => {
                                if (currentIndex !== itemIndex) {
                                  if (group.selectionType === 'single' && event.target.checked) {
                                    return { ...currentItem, isDefault: false };
                                  }
                                  return currentItem;
                                }
                                return { ...currentItem, isDefault: event.target.checked };
                              }),
                            }))}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Marcada por defecto
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={item.isActive}
                            onChange={(event) => updateGroup(groupIndex, (current) => ({
                              ...current,
                              items: current.items.map((currentItem, currentIndex) => (
                                currentIndex === itemIndex
                                  ? { ...currentItem, isActive: event.target.checked }
                                  : currentItem
                              )),
                            }))}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Disponible
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
      </Card>

    <Modal
      open={libraryOpen}
      title="Biblioteca de adicionales"
      description="Reutiliza adicionales que ya guardaste en otros platos de esta empresa. Al agregarlos, podrás ajustar sus valores para este plato."
      maxWidth="2xl"
      onClose={() => setLibraryOpen(false)}
      footer={<div className="flex justify-end"><Button variant="outline" onClick={() => setLibraryOpen(false)}>Cerrar</Button></div>}
    >
      <div className="space-y-5">
        {groups.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Agrega primero un grupo de opciones para poder reutilizar un adicional.
          </div>
        ) : (
          <div className="space-y-4">
            {libraryTargetGroupIndex === null ? (
              <div>
                <label htmlFor="library-target-group" className="mb-1 block text-sm font-medium text-gray-700">Agregar al grupo</label>
                <select
                  id="library-target-group"
                  value={libraryTargetGroupIndex ?? ''}
                  onChange={(event) => setLibraryTargetGroupIndex(event.target.value === '' ? null : Number(event.target.value))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecciona un grupo</option>
                  {groups.map((group, index) => <option key={`library-group-${index}`} value={index}>{group.name.trim() || `Grupo ${index + 1}`}</option>)}
                </select>
              </div>
            ) : (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                Se agregará al grupo <strong>{groups[libraryTargetGroupIndex]?.name.trim() || `Grupo ${libraryTargetGroupIndex + 1}`}</strong>.
              </div>
            )}

            <Input
              label="Buscar adicional"
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              placeholder="Ej. queso, salsa, bebida..."
              labelAdornment={<Search className="h-3.5 w-3.5 text-gray-400" />}
            />

            {libraryError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{libraryError}</div>
            ) : libraryLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">Cargando biblioteca…</p>
            ) : filteredLibraryItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">
                {libraryItems.length === 0 ? 'Todavía no hay adicionales guardados. Cuando guardes este plato, sus opciones quedarán disponibles aquí.' : 'No encontramos adicionales con esa búsqueda.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {filteredLibraryItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900">{item.label}</p>
                        {item.linkedProductId ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">Producto vinculado</span> : null}
                        {item.priceDelta > 0 ? <span className="text-xs font-semibold text-emerald-700">+{formatCurrency(item.priceDelta, 'es-CO', currency)}</span> : null}
                      </div>
                      {item.description ? <p className="mt-1 text-xs text-gray-500">{item.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button type="button" size="sm" onClick={() => applyLibraryItem(item)}>Agregar al grupo</Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Retirar ${item.label} de la biblioteca`}
                        disabled={libraryUpdatingId === item.id}
                        onClick={() => void deactivateLibraryItem(item)}
                      >
                        <Archive className="h-4 w-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </Modal>
    </>
  );
}
