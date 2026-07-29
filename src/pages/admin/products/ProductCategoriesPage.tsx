import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { categoriesService } from '@/features/categories/categoriesService';
import type { PublicStoreCategory } from '@/types/common.types';
import { notify } from '@/lib/notifications';
import { scrollToFirstError } from '@/hooks/useScrollToFirstFormikError';

interface CategoryForm {
  name: string;
  parentId: string;
  showInMenu: boolean;
}

const EMPTY_CAT_FORM: CategoryForm = { name: '', parentId: '', showInMenu: true };

export function ProductCategoriesPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_CAT_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();

  async function load() {
    if (!storeId) return;
    try {
      const data = await categoriesService.getStoreCategories(storeId);
      setCategories(data);
    } catch {
      notify.error('Error cargando categorías');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [storeId]);

  if (!storeId) return null;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_CAT_FORM);
    setNameError(undefined);
    setShowForm(true);
  }

  function openEdit(cat: PublicStoreCategory) {
    setEditingId(cat.id);
    setForm({ name: cat.name, parentId: cat.parentId ?? '', showInMenu: cat.showInMenu });
    setNameError(undefined);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_CAT_FORM);
    setNameError(undefined);
  }

  async function save() {
    if (!form.name.trim()) {
      setNameError('El nombre es requerido.');
      scrollToFirstError({ fieldName: 'category-name' });
      return;
    }
    setNameError(undefined);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        parentId: form.parentId || null,
        showInMenu: form.showInMenu,
      };
      if (editingId) {
        await categoriesService.updateCategory(editingId, payload);
        notify.success('Categoría actualizada');
      } else {
        await categoriesService.createCategory(storeId as string, payload);
        notify.success('Categoría creada');
      }
      cancel();
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error guardando categoría');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await categoriesService.deleteCategory(id);
      notify.success('Categoría eliminada');
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error eliminando categoría');
    } finally {
      setDeletingId(null);
    }
  }

  const rootCats = categories.filter((c) => !c.parentId);
  const parentOptions = [
    { value: '', label: '— Sin padre (categoría raíz) —' },
    ...rootCats.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Categorías</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Organiza tus productos en categorías y subcategorías para que tus clientes naveguen mejor.
        </p>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
        <strong>Una categoría indica qué producto es</strong>, por ejemplo Zapatos, Camisetas o Palas.
        Para segmentar por Hombre, Mujer, Unisex, Color o Material utiliza{' '}
        <Link
          to={`/admin/stores/${storeId}/products/filters`}
          className="font-semibold text-sky-700 underline underline-offset-2"
        >
          Atributos del producto
        </Link>.
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Nueva categoría
        </Button>
      </div>

      {showForm && (
        <Card>
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">
              {editingId ? 'Editar categoría' : 'Nueva categoría'}
            </h3>
            <Input
              id="category-name"
              name="category-name"
              label="Nombre"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                setNameError(undefined);
              }}
              error={nameError}
              placeholder="Ej: Zapatos, Camisetas, Bebidas"
            />
            <Select
              label="Categoría padre"
              value={form.parentId}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              options={parentOptions}
            />
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
                {editingId ? 'Guardar cambios' : 'Crear categoría'}
              </Button>
              <Button variant="secondary" onClick={cancel}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <PanelLoadingState label="Cargando categorías…" />
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          No hay categorías. Crea la primera para organizar tu catálogo.
        </div>
      ) : (
        <div className="space-y-1">
          {rootCats.map((cat) => {
            const children = categories.filter((c) => c.parentId === cat.id);
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <span className="flex-1 text-sm font-medium text-gray-900">{cat.name}</span>
                  {!cat.showInMenu && (
                    <Badge variant="default">Oculta en menú</Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="text-gray-400 hover:text-indigo-600 transition-colors"
                    aria-label="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(cat.id)}
                    disabled={deletingId === cat.id}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {children.map((sub) => (
                  <div
                    key={sub.id}
                    className="ml-6 mt-1 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5"
                  >
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="flex-1 text-sm text-gray-700">{sub.name}</span>
                    <button
                      type="button"
                      onClick={() => openEdit(sub)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                      aria-label="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(sub.id)}
                      disabled={deletingId === sub.id}
                      className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
