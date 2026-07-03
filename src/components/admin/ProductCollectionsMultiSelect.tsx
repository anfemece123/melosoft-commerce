import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { collectionsService } from '@/features/collections/collectionsService';
import type { PublicStoreCollection } from '@/types/common.types';
import { notify } from '@/lib/notifications';

interface ProductCollectionsMultiSelectProps {
  storeId: string;
  collections: PublicStoreCollection[];
  selectedCollectionIds: string[];
  onChange: (collectionIds: string[]) => void;
  onCollectionsChange: (collections: PublicStoreCollection[]) => void;
}

export function ProductCollectionsMultiSelect({
  storeId,
  collections,
  selectedCollectionIds,
  onChange,
  onCollectionsChange,
}: ProductCollectionsMultiSelectProps) {
  const [query, setQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creating, setCreating] = useState(false);

  const collectionsById = useMemo(
    () => new Map(collections.map((collection) => [collection.id, collection])),
    [collections],
  );

  const sortedCollections = useMemo(
    () => [...collections].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [collections],
  );

  const filteredCollections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedCollections;
    return sortedCollections.filter((collection) => collection.name.toLowerCase().includes(normalizedQuery));
  }, [query, sortedCollections]);

  const selectedCollections = useMemo(
    () => selectedCollectionIds
      .map((id) => collectionsById.get(id))
      .filter((collection): collection is PublicStoreCollection => Boolean(collection)),
    [collectionsById, selectedCollectionIds],
  );

  function toggleCollection(collectionId: string) {
    if (selectedCollectionIds.includes(collectionId)) {
      onChange(selectedCollectionIds.filter((id) => id !== collectionId));
      return;
    }
    onChange([...selectedCollectionIds, collectionId]);
  }

  async function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name || creating) return;

    setCreating(true);
    try {
      const created = await collectionsService.createCollection(storeId, { name });
      const nextCollections = [...collections, created]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      onCollectionsChange(nextCollections);
      onChange([...selectedCollectionIds, created.id]);
      setNewCollectionName('');
      setShowCreateForm(false);
      setQuery('');
      notify.success('Colección creada y asignada al producto.');
    } catch (err) {
      notify.fromError(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-lg font-semibold text-gray-900">Colecciones</h3>
          <p className="mt-1 text-sm text-gray-500">
            Usa colecciones para mostrar este producto en grupos especiales como Ofertas, Más
            vendidos, Black Friday o Regalos. Las colecciones no cambian la categoría principal
            del producto; solo permiten mostrarlo en secciones comerciales.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreateForm((current) => !current)}
        >
          Crear colección
        </Button>
      </div>

      {selectedCollections.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedCollections.map((collection) => (
            <span
              key={collection.id}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
            >
              {collection.name}
              <button
                type="button"
                onClick={() => toggleCollection(collection.id)}
                className="text-gray-400 transition-colors hover:text-gray-700"
                aria-label={`Quitar ${collection.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Aún no tienes colecciones. Puedes crear una si quieres destacar productos en grupos
          especiales.
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Este producto no pertenece a ninguna colección todavía.
        </div>
      )}

      {collections.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar colección"
            className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      )}

      {collections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filteredCollections.map((collection) => {
            const selected = selectedCollectionIds.includes(collection.id);
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => toggleCollection(collection.id)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  selected
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                {selected ? <Check className="h-3.5 w-3.5" /> : null}
                {collection.name}
              </button>
            );
          })}
        </div>
      )}

      {showCreateForm ? (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Plus className="h-4 w-4 text-indigo-600" />
            Nueva colección
          </div>
          <Input
            id="new-collection-name"
            label="Nombre de la colección"
            placeholder="Ej: Ofertas, Black Friday, Más vendidos"
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" isLoading={creating} onClick={() => void handleCreateCollection()}>
              Crear y seleccionar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateForm(false);
                setNewCollectionName('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
