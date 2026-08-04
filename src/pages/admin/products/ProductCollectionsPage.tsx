import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { collectionsService } from '@/features/collections/collectionsService';
import type { PublicStoreCollection } from '@/types/common.types';
import { notify } from '@/lib/notifications';
import { scrollToFirstError } from '@/hooks/useScrollToFirstFormikError';
import { ImageUploadField } from '@/components/admin/ImageUploadField';

interface CollectionForm {
  name: string;
  showOnHome: boolean;
  showInMenu: boolean;
}

const EMPTY_FORM: CollectionForm = { name: '', showOnHome: false, showInMenu: false };

export function ProductCollectionsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const [collections, setCollections] = useState<PublicStoreCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CollectionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const localPreviewRef = useRef<string | null>(null);

  function replaceImagePreview(url: string | null) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = url?.startsWith('blob:') ? url : null;
    setImagePreviewUrl(url);
  }

  async function load() {
    if (!storeId) return;
    try {
      const data = await collectionsService.getStoreCollections(storeId);
      setCollections(data);
    } catch {
      notify.error('Error cargando colecciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void collectionsService.getStoreCollections(storeId)
      .then((data) => {
        if (!cancelled) setCollections(data);
      })
      .catch(() => {
        if (!cancelled) notify.error('Error cargando colecciones');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [storeId]);
  useEffect(() => () => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
  }, []);

  if (!storeId) return null;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImageRemoved(false);
    replaceImagePreview(null);
    setNameError(undefined);
    setShowForm(true);
  }

  function openEdit(collection: PublicStoreCollection) {
    setEditingId(collection.id);
    setForm({ name: collection.name, showOnHome: collection.showOnHome, showInMenu: collection.showInMenu });
    setImageFile(null);
    setImageRemoved(false);
    replaceImagePreview(collection.imageUrl);
    setNameError(undefined);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImageRemoved(false);
    replaceImagePreview(null);
    setNameError(undefined);
  }

  function selectImage(file: File | null) {
    if (!file) return;
    setImageFile(file);
    setImageRemoved(false);
    replaceImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImageRemoved(true);
    replaceImagePreview(null);
  }

  async function save() {
    if (!form.name.trim()) {
      setNameError('El nombre es requerido.');
      scrollToFirstError({ fieldName: 'collection-name' });
      return;
    }
    setNameError(undefined);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        showOnHome: form.showOnHome,
        showInMenu: form.showInMenu,
      };
      let savedCollectionId = editingId;
      if (savedCollectionId) {
        await collectionsService.updateCollection(savedCollectionId, payload);
      } else {
        const created = await collectionsService.createCollection(storeId as string, payload);
        savedCollectionId = created.id;
      }
      if (imageFile) {
        await collectionsService.setCollectionImage(storeId as string, savedCollectionId, imageFile);
      } else if (editingId && imageRemoved) {
        await collectionsService.clearCollectionImage(savedCollectionId);
      }
      notify.success(editingId ? 'Colección actualizada' : 'Colección creada');
      cancel();
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error guardando colección');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await collectionsService.deleteCollection(id);
      notify.success('Colección eliminada');
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error eliminando colección');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Colecciones</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Agrupa productos en secciones comerciales como Ofertas, Black Friday o Más vendidos, sin
          afectar su categoría principal.
        </p>
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Nueva colección
        </Button>
      </div>

      {showForm && (
        <Card>
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">
              {editingId ? 'Editar colección' : 'Nueva colección'}
            </h3>
            <Input
              id="collection-name"
              name="collection-name"
              label="Nombre"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                setNameError(undefined);
              }}
              error={nameError}
              placeholder="Ej: Ofertas, Black Friday, Más vendidos"
            />
            <ImageUploadField
              id="collection-navigation-image"
              label="Imagen de la colección"
              assetKind="catalog_taxonomy_image"
              previewUrl={imagePreviewUrl}
              onFileSelect={selectImage}
              onClear={imagePreviewUrl ? clearImage : undefined}
              uploading={saving && imageFile !== null}
              aspectClassName="h-24 w-24 rounded-xl"
              hint="Se mostrará en el megamenú y en otros espacios visuales donde aparezca esta colección. Puedes recortar cualquier formato."
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.showOnHome}
                onChange={(e) => setForm((f) => ({ ...f, showOnHome: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              Mostrar en la página de inicio de la tienda
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.showInMenu}
                onChange={(e) => setForm((f) => ({ ...f, showInMenu: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              Mostrar en menú de navegación público
            </label>
            <div className="flex gap-2 pt-1">
              <Button isLoading={saving} onClick={() => void save()}>
                {editingId ? 'Guardar cambios' : 'Crear colección'}
              </Button>
              <Button variant="secondary" onClick={cancel}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <PanelLoadingState label="Cargando colecciones…" />
      ) : collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          No hay colecciones. Crea la primera para destacar productos en grupos especiales.
        </div>
      ) : (
        <div className="space-y-1">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              {collection.imageUrl ? (
                <img src={collection.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                  <ImageIcon className="h-4 w-4" />
                </span>
              )}
              <span className="flex-1 text-sm font-medium text-gray-900">{collection.name}</span>
              {collection.showOnHome && <Badge variant="info">Inicio</Badge>}
              {collection.showInMenu && <Badge variant="success">Menú</Badge>}
              <button
                type="button"
                onClick={() => openEdit(collection)}
                className="text-gray-400 hover:text-indigo-600 transition-colors"
                aria-label="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void remove(collection.id)}
                disabled={deletingId === collection.id}
                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                aria-label="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
