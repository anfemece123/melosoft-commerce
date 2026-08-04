import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsDown,
  ChevronsUp,
  GripVertical,
  ImageIcon,
  Layers3,
  Package,
  UtensilsCrossed,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { Select } from '@/components/ui/Select';
import { categoriesService } from '@/features/categories/categoriesService';
import { collectionsService } from '@/features/collections/collectionsService';
import {
  catalogOrderingService,
  type CatalogOrderingContext,
} from '@/features/products/catalogOrderingService';
import { productsService } from '@/features/products/productsService';
import type { Product } from '@/features/products/products.types';
import { selectCurrentCommerceSettings } from '@/features/stores/stores.selectors';
import { notify } from '@/lib/notifications';
import type { PublicStoreCategory, PublicStoreCollection } from '@/types/common.types';

type SaveStatus = 'idle' | 'saving' | 'saved';
type MoveDirection = 'top' | 'up' | 'down' | 'bottom';

function parseContext(value: string): CatalogOrderingContext {
  if (value.startsWith('category:')) return { type: 'category', id: value.slice('category:'.length) };
  if (value.startsWith('collection:')) return { type: 'collection', id: value.slice('collection:'.length) };
  return { type: 'catalog' };
}

function categoryLabel(category: PublicStoreCategory, categories: PublicStoreCategory[]): string {
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function moveId(ids: string[], id: string, direction: MoveDirection): string[] {
  const currentIndex = ids.indexOf(id);
  if (currentIndex < 0) return ids;
  const targetIndex = direction === 'top'
    ? 0
    : direction === 'bottom'
      ? ids.length - 1
      : direction === 'up'
        ? Math.max(0, currentIndex - 1)
        : Math.min(ids.length - 1, currentIndex + 1);
  return currentIndex === targetIndex ? ids : arrayMove(ids, currentIndex, targetIndex);
}

interface SortableOrderRowProps {
  id: string;
  position: number;
  total: number;
  disabled: boolean;
  children: ReactNode;
  onMove: (direction: MoveDirection) => void;
}

function SortableOrderRow({ id, position, total, disabled, children, onMove }: SortableOrderRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl border bg-white px-2.5 py-2 transition-shadow ${isDragging ? 'z-10 border-indigo-300 shadow-xl' : 'border-gray-200'}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="cursor-grab touch-none rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing disabled:cursor-not-allowed"
        aria-label={`Mover elemento en posición ${position + 1}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-gray-400">{position + 1}</span>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center">
        <OrderButton label="Enviar al principio" disabled={disabled || position === 0} onClick={() => onMove('top')}><ChevronsUp className="h-4 w-4" /></OrderButton>
        <OrderButton label="Subir una posición" disabled={disabled || position === 0} onClick={() => onMove('up')}><ArrowUp className="h-4 w-4" /></OrderButton>
        <OrderButton label="Bajar una posición" disabled={disabled || position === total - 1} onClick={() => onMove('down')}><ArrowDown className="h-4 w-4" /></OrderButton>
        <OrderButton label="Enviar al final" disabled={disabled || position === total - 1} onClick={() => onMove('bottom')}><ChevronsDown className="h-4 w-4" /></OrderButton>
      </div>
    </div>
  );
}

function OrderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactElement<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 disabled:opacity-25"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export function CatalogOrderingPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const commerceSettings = useAppSelector(selectCurrentCommerceSettings);
  const isMenu = commerceSettings?.catalogType === 'menu';
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [collections, setCollections] = useState<PublicStoreCollection[]>([]);
  const [contextValue, setContextValue] = useState('catalog');
  const [orderedProductIds, setOrderedProductIds] = useState<string[]>([]);
  const [loadedContextValue, setLoadedContextValue] = useState<string | null>(null);
  const [productSaveStatus, setProductSaveStatus] = useState<SaveStatus>('idle');
  const [categoryParentValue, setCategoryParentValue] = useState('root');
  const [categorySaveStatus, setCategorySaveStatus] = useState<SaveStatus>('idle');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void Promise.all([
      productsService.getProductsByStore(storeId),
      categoriesService.getStoreCategories(storeId),
      collectionsService.getStoreCollections(storeId),
    ])
      .then(([productRows, categoryRows, collectionRows]) => {
        if (cancelled) return;
        setProducts(productRows.filter((product) => product.status !== 'archived'));
        setCategories(categoryRows);
        setCollections(collectionRows);
      })
      .catch((error: unknown) => {
        if (!cancelled) notify.error(error instanceof Error ? error.message : 'No pudimos cargar el orden del catálogo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [storeId]);

  const context = useMemo(() => parseContext(contextValue), [contextValue]);

  useEffect(() => {
    if (!storeId || loading) return;
    let cancelled = false;
    void catalogOrderingService.getProductOrder(storeId, context)
      .then((ids) => {
        if (!cancelled) {
          setOrderedProductIds(ids);
          setLoadedContextValue(contextValue);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setOrderedProductIds([]);
          setLoadedContextValue(contextValue);
          notify.error(error instanceof Error ? error.message : 'No pudimos cargar las posiciones.');
        }
      });
    return () => { cancelled = true; };
  }, [context, contextValue, loading, storeId]);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const orderedProducts = useMemo(() => {
    const ordered = orderedProductIds
      .map((id) => productsById.get(id))
      .filter((product): product is Product => Boolean(product));
    const present = new Set(ordered.map((product) => product.id));
    const relevantMissing = products.filter((product) => {
      if (present.has(product.id)) return false;
      if (context.type === 'category') return product.categoryId === context.id;
      if (context.type === 'collection') return product.collections.some((collection) => collection.id === context.id);
      return true;
    });
    return [...ordered, ...relevantMissing];
  }, [context, orderedProductIds, products, productsById]);

  const categoryParentId = categoryParentValue === 'root' ? null : categoryParentValue;
  const productOrderLoading = loadedContextValue !== contextValue;
  const categorySiblings = useMemo(() => categories
    .filter((category) => category.parentId === categoryParentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [categories, categoryParentId]);

  if (!storeId) return null;
  if (loading) return <PanelLoadingState label="Cargando orden del catálogo…" />;

  async function persistProductOrder(nextIds: string[], previousIds: string[]): Promise<void> {
    if (!storeId || productSaveStatus === 'saving') return;
    setOrderedProductIds(nextIds);
    setProductSaveStatus('saving');
    try {
      await catalogOrderingService.reorderProducts(storeId, context, nextIds);
      setProductSaveStatus('saved');
    } catch (error) {
      setOrderedProductIds(previousIds);
      setProductSaveStatus('idle');
      notify.error(error instanceof Error ? error.message : 'No pudimos guardar el orden.');
    }
  }

  function handleProductDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id || productSaveStatus === 'saving') return;
    const currentIds = orderedProducts.map((product) => product.id);
    const oldIndex = currentIds.indexOf(String(active.id));
    const newIndex = currentIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void persistProductOrder(arrayMove(currentIds, oldIndex, newIndex), currentIds);
  }

  function handleProductMove(productId: string, direction: MoveDirection): void {
    const currentIds = orderedProducts.map((product) => product.id);
    const nextIds = moveId(currentIds, productId, direction);
    if (nextIds === currentIds) return;
    void persistProductOrder(nextIds, currentIds);
  }

  async function persistCategoryOrder(nextIds: string[], previousIds: string[]): Promise<void> {
    if (!storeId || categorySaveStatus === 'saving') return;
    setCategories((current) => current.map((category) => {
      const index = nextIds.indexOf(category.id);
      return index >= 0 ? { ...category, sortOrder: index } : category;
    }));
    setCategorySaveStatus('saving');
    try {
      await catalogOrderingService.reorderCategories(storeId, categoryParentId, nextIds);
      setCategorySaveStatus('saved');
    } catch (error) {
      setCategories((current) => current.map((category) => {
        const index = previousIds.indexOf(category.id);
        return index >= 0 ? { ...category, sortOrder: index } : category;
      }));
      setCategorySaveStatus('idle');
      notify.error(error instanceof Error ? error.message : 'No pudimos guardar el orden de categorías.');
    }
  }

  function handleCategoryDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id || categorySaveStatus === 'saving') return;
    const currentIds = categorySiblings.map((category) => category.id);
    const oldIndex = currentIds.indexOf(String(active.id));
    const newIndex = currentIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void persistCategoryOrder(arrayMove(currentIds, oldIndex, newIndex), currentIds);
  }

  function handleCategoryMove(categoryId: string, direction: MoveDirection): void {
    const currentIds = categorySiblings.map((category) => category.id);
    const nextIds = moveId(currentIds, categoryId, direction);
    if (nextIds === currentIds) return;
    void persistCategoryOrder(nextIds, currentIds);
  }

  const contextOptions = [
    { value: 'catalog', label: 'Catálogo general · pantalla inicial' },
    ...categories.map((category) => ({ value: `category:${category.id}`, label: `Categoría · ${categoryLabel(category, categories)}` })),
    ...collections.map((collection) => ({ value: `collection:${collection.id}`, label: `Colección · ${collection.name}` })),
  ];
  const parentsWithChildren = categories.filter((category) => categories.some((child) => child.parentId === category.id));
  const categoryParentOptions = [
    { value: 'root', label: 'Categorías principales' },
    ...parentsWithChildren.map((category) => ({ value: category.id, label: `Subcategorías de ${category.name}` })),
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Orden del catálogo</h2>
        <p className="mt-1 text-sm text-gray-500">
          Controla exactamente lo que verá primero el cliente. Los cambios se guardan automáticamente.
        </p>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm leading-6 text-indigo-900">
        El orden general controla la entrada sin filtros. Cada categoría y colección conserva su propio orden independiente. Si el cliente elige precio, nombre o más recientes, su elección reemplaza temporalmente este orden.
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">Orden de categorías</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">Ordena cada nivel de navegación sin mezclar categorías principales y subcategorías.</p>
            </div>
            <SaveIndicator status={categorySaveStatus} />
          </div>
          <div className="max-w-sm">
            <Select
              value={categoryParentValue}
              onChange={(event) => {
                setCategoryParentValue(event.target.value);
                setCategorySaveStatus('idle');
              }}
              options={categoryParentOptions}
              label="Nivel"
              disabled={categorySaveStatus === 'saving'}
            />
          </div>
          {categorySiblings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-500">No hay categorías en este nivel.</div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleCategoryDragEnd}>
              <SortableContext items={categorySiblings.map((category) => category.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {categorySiblings.map((category, index) => (
                    <SortableOrderRow
                      key={category.id}
                      id={category.id}
                      position={index}
                      total={categorySiblings.length}
                      disabled={categorySaveStatus === 'saving'}
                      onMove={(direction) => handleCategoryMove(category.id, direction)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-gray-800">{category.name}</span>
                        {categories.some((child) => child.parentId === category.id) ? <Badge variant="neutral">Tiene subcategorías</Badge> : null}
                      </div>
                    </SortableOrderRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {isMenu ? <UtensilsCrossed className="h-4 w-4 text-indigo-600" /> : <Package className="h-4 w-4 text-indigo-600" />}
                <h3 className="font-semibold text-gray-900">Orden de {isMenu ? 'platos' : 'productos'}</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">Arrastra un elemento o utiliza sus controles para moverlo con precisión.</p>
            </div>
            <SaveIndicator status={productSaveStatus} />
          </div>
          <div className="max-w-lg">
            <Select
              value={contextValue}
              onChange={(event) => {
                setContextValue(event.target.value);
                setProductSaveStatus('idle');
              }}
              options={contextOptions}
              label="Vista que quieres ordenar"
              disabled={productSaveStatus === 'saving'}
            />
          </div>

          {productOrderLoading ? (
            <PanelLoadingState label="Cargando posiciones…" />
          ) : orderedProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">No hay productos en esta vista.</div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleProductDragEnd}>
              <SortableContext items={orderedProducts.map((product) => product.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {orderedProducts.map((product, index) => (
                    <SortableOrderRow
                      key={product.id}
                      id={product.id}
                      position={index}
                      total={orderedProducts.length}
                      disabled={productSaveStatus === 'saving'}
                      onMove={(direction) => handleProductMove(product.id, direction)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                          {product.mainImageUrl ? (
                            <img src={product.mainImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center"><ImageIcon className="h-4 w-4 text-gray-300" /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
                            {product.status === 'draft' ? <Badge variant="warning">Borrador</Badge> : null}
                            {!product.isAvailable ? <Badge variant="neutral">No disponible</Badge> : null}
                          </div>
                          <p className="truncate text-xs text-gray-500">
                            {categories.find((category) => category.id === product.categoryId)?.name ?? 'Sin categoría'}
                          </p>
                        </div>
                      </div>
                    </SortableOrderRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <span role="status" aria-live="polite" className="text-xs font-medium text-indigo-600">Guardando…</span>;
  if (status === 'saved') return <span role="status" aria-live="polite" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check className="h-3.5 w-3.5" /> Orden guardado</span>;
  return <span className="text-xs text-gray-400">Guardado automático</span>;
}
