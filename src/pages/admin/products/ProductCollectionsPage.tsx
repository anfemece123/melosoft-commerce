import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { collectionsService } from '@/features/collections/collectionsService';
import type { PublicStoreCollection } from '@/types/common.types';
import { notify } from '@/lib/notifications';

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

  useEffect(() => { void load(); }, [storeId]);

  if (!storeId) return null;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(collection: PublicStoreCollection) {
    setEditingId(collection.id);
    setForm({ name: collection.name, showOnHome: collection.showOnHome, showInMenu: collection.showInMenu });
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.name.trim()) { notify.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        showOnHome: form.showOnHome,
        showInMenu: form.showInMenu,
      };
      if (editingId) {
        await collectionsService.updateCollection(editingId, payload);
        notify.success('Colección actualizada');
      } else {
        await collectionsService.createCollection(storeId as string, payload);
        notify.success('Colección creada');
      }
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
              label="Nombre"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Ofertas, Black Friday, Más vendidos"
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
        <div className="py-8 text-center text-sm text-gray-400">Cargando colecciones…</div>
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
