import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  BadgePercent,
  FolderTree,
  GripVertical,
  Layers3,
  List,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { categoriesService } from '@/features/categories/categoriesService';
import { collectionsService } from '@/features/collections/collectionsService';
import { facetsService } from '@/features/facets/facetsService';
import type { StoreFacet } from '@/features/facets/facets.types';
import type {
  HeaderNavigationItem,
  HeaderNavigationItemType,
  PublicHeaderSettings,
  PublicStoreCategory,
  PublicStoreCollection,
} from '@/types/common.types';
import { MAX_CUSTOM_HEADER_ITEMS } from '@/lib/storefront/headerSettings';

interface HeaderNavigationEditorProps {
  storeId: string;
  settings: PublicHeaderSettings;
  onChange: (settings: PublicHeaderSettings) => void;
}

interface NavigationTarget {
  key: string;
  type: HeaderNavigationItemType;
  targetId: string | null;
  label: string;
  description: string;
  group: 'quick' | 'category' | 'collection' | 'attribute';
}

const GROUP_LABELS: Record<NavigationTarget['group'], string> = {
  quick: 'Enlaces del catálogo',
  category: 'Categorías y subcategorías',
  collection: 'Colecciones',
  attribute: 'Valores de atributos',
};

const GROUP_ORDER: NavigationTarget['group'][] = [
  'quick',
  'category',
  'collection',
  'attribute',
];

function targetKey(type: HeaderNavigationItemType, targetId: string | null): string {
  return `${type}:${targetId ?? ''}`;
}

function navigationItemId(): string {
  if (typeof crypto.randomUUID === 'function') return `nav-${crypto.randomUUID()}`;
  return `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function TargetIcon({ type }: { type: HeaderNavigationItemType }) {
  const className = 'h-4 w-4';
  if (type === 'category') return <FolderTree className={className} />;
  if (type === 'collection') return <Layers3 className={className} />;
  if (type === 'facet_value') return <SlidersHorizontal className={className} />;
  if (type === 'featured') return <Sparkles className={className} />;
  if (type === 'sale') return <BadgePercent className={className} />;
  return <List className={className} />;
}

export function HeaderNavigationEditor({
  storeId,
  settings,
  onChange,
}: HeaderNavigationEditorProps) {
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [collections, setCollections] = useState<PublicStoreCollection[]>([]);
  const [facets, setFacets] = useState<StoreFacet[]>([]);
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      categoriesService.getStoreCategories(storeId),
      collectionsService.getStoreCollections(storeId),
      facetsService.getStoreFacets(storeId),
    ]).then(([categoryData, collectionData, facetData]) => {
      if (cancelled) return;
      setCategories(categoryData);
      setCollections(collectionData);
      setFacets(facetData);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los destinos.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const targets = useMemo<NavigationTarget[]>(() => {
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    return [
      {
        key: targetKey('catalog', null),
        type: 'catalog',
        targetId: null,
        label: 'Todos los productos',
        description: 'Catálogo completo',
        group: 'quick',
      },
      {
        key: targetKey('featured', null),
        type: 'featured',
        targetId: null,
        label: 'Destacados',
        description: 'Productos marcados como destacados',
        group: 'quick',
      },
      {
        key: targetKey('sale', null),
        type: 'sale',
        targetId: null,
        label: 'Ofertas',
        description: 'Productos con precio promocional',
        group: 'quick',
      },
      ...categories.map((category): NavigationTarget => {
        const parent = category.parentId ? categoryById.get(category.parentId) : null;
        return {
          key: targetKey('category', category.id),
          type: 'category',
          targetId: category.id,
          label: category.name,
          description: parent ? `Subcategoría de ${parent.name}` : 'Categoría principal',
          group: 'category',
        };
      }),
      ...collections.map((collection): NavigationTarget => ({
        key: targetKey('collection', collection.id),
        type: 'collection',
        targetId: collection.id,
        label: collection.name,
        description: 'Colección de productos',
        group: 'collection',
      })),
      ...facets
        .filter((facet) => facet.isActive)
        .flatMap((facet) =>
          facet.values.map((value): NavigationTarget => ({
            key: targetKey('facet_value', value.id),
            type: 'facet_value',
            targetId: value.id,
            label: value.value,
            description: `Atributo · ${facet.name}`,
            group: 'attribute',
          }))
        ),
    ];
  }, [categories, collections, facets]);

  const targetsByKey = useMemo(
    () => new Map(targets.map((target) => [target.key, target])),
    [targets],
  );
  const usedTargetKeys = useMemo(
    () => new Set(
      settings.navigationItems.map((item) => targetKey(item.type, item.targetId))
    ),
    [settings.navigationItems],
  );
  const availableTargets = targets.filter((target) => !usedTargetKeys.has(target.key));

  function updateItems(navigationItems: HeaderNavigationItem[]) {
    onChange({ ...settings, navigationItems });
  }

  function addTarget() {
    const target = targetsByKey.get(selectedTargetKey);
    if (!target || settings.navigationItems.length >= MAX_CUSTOM_HEADER_ITEMS) return;
    updateItems([
      ...settings.navigationItems,
      {
        id: navigationItemId(),
        type: target.type,
        label: target.label,
        targetId: target.targetId,
      },
    ]);
    setSelectedTargetKey('');
  }

  function moveItem(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= settings.navigationItems.length) return;
    const next = [...settings.navigationItems];
    [next[index], next[destination]] = [next[destination], next[index]];
    updateItems(next);
  }

  function updateLabel(id: string, label: string) {
    updateItems(settings.navigationItems.map((item) =>
      item.id === id ? { ...item, label: label.slice(0, 40) } : item
    ));
  }

  function removeItem(id: string) {
    updateItems(settings.navigationItems.filter((item) => item.id !== id));
  }

  function describeItem(item: HeaderNavigationItem): string {
    return targetsByKey.get(targetKey(item.type, item.targetId))?.description
      ?? 'El destino ya no está disponible';
  }

  if (loading) {
    return <PanelLoadingState label="Cargando opciones de navegación…" />;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
          <Tags className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Navegación personalizada</h3>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            Combina categorías, colecciones y atributos. Por ejemplo, usa “Zapatos” como categoría
            y “Hombre”, “Mujer” o “Unisex” como valores del atributo Género.
          </p>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-xs leading-5 text-sky-900 sm:grid-cols-2">
        <p><strong>Categoría:</strong> qué tipo de producto es.</p>
        <p><strong>Atributo:</strong> una cualidad para segmentarlo o filtrarlo.</p>
      </div>

      {loadError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {loadError}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="header-navigation-target">Destino del enlace</label>
            <select
              id="header-navigation-target"
              value={selectedTargetKey}
              onChange={(event) => setSelectedTargetKey(event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              disabled={availableTargets.length === 0}
            >
              <option value="">Selecciona qué quieres mostrar…</option>
              {GROUP_ORDER.map((group) => {
                const groupTargets = availableTargets.filter((target) => target.group === group);
                if (groupTargets.length === 0) return null;
                return (
                  <optgroup key={group} label={GROUP_LABELS[group]}>
                    {groupTargets.map((target) => (
                      <option key={target.key} value={target.key}>
                        {target.label} — {target.description}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <Button
              type="button"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={addTarget}
              disabled={!selectedTargetKey || settings.navigationItems.length >= MAX_CUSTOM_HEADER_ITEMS}
            >
              Agregar
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            Hasta {MAX_CUSTOM_HEADER_ITEMS} enlaces. En pantallas pequeñas se mostrarán dentro del menú lateral.
          </p>

          {settings.navigationItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
              <p className="text-sm font-medium text-gray-700">Aún no agregaste enlaces.</p>
              <p className="mt-1 text-xs text-gray-500">
                Mientras esté vacío, la tienda mantendrá un enlace seguro al catálogo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {settings.navigationItems.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="hidden text-gray-300 sm:block" aria-hidden="true">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <Input
                      label={`Texto del enlace ${index + 1}`}
                      value={item.label}
                      maxLength={40}
                      onChange={(event) => updateLabel(item.id, event.target.value)}
                      error={!item.label.trim() ? 'Escribe un texto para este enlace' : undefined}
                    />
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                      <TargetIcon type={item.type} />
                      {describeItem(item)}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      aria-label={`Subir ${item.label}`}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === settings.navigationItems.length - 1}
                      aria-label={`Bajar ${item.label}`}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Eliminar ${item.label}`}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-xs leading-5 text-gray-500">
        ¿Falta una opción? Administra las{' '}
        <Link
          to={`/admin/stores/${storeId}/products/categories`}
          className="font-medium text-indigo-600 hover:text-indigo-700"
        >
          categorías
        </Link>
        {' '}o crea valores como Hombre/Mujer desde{' '}
        <Link
          to={`/admin/stores/${storeId}/products/filters`}
          className="font-medium text-indigo-600 hover:text-indigo-700"
        >
          Atributos del producto
        </Link>.
      </p>
    </div>
  );
}
