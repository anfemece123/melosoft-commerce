import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronRight, ImageIcon, Images, Loader2 } from 'lucide-react';
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
import { ImageUploadField } from '@/components/admin/ImageUploadField';

const ProductImagePickerDialog = lazy(async () => {
  const module = await import('@/components/admin/ProductImagePickerDialog');
  return { default: module.ProductImagePickerDialog };
});

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [productImagePickerOpen, setProductImagePickerOpen] = useState(false);
  const localPreviewRef = useRef<string | null>(null);

  function replaceImagePreview(url: string | null) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = url?.startsWith('blob:') ? url : null;
    setImagePreviewUrl(url);
  }

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

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void categoriesService.getStoreCategories(storeId)
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch(() => {
        if (!cancelled) notify.error('Error cargando categorías');
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
    setForm(EMPTY_CAT_FORM);
    setImageFile(null);
    setImageRemoved(false);
    setProductImagePickerOpen(false);
    replaceImagePreview(null);
    setNameError(undefined);
    setShowForm(true);
  }

  function openEdit(cat: PublicStoreCategory) {
    setEditingId(cat.id);
    setForm({ name: cat.name, parentId: cat.parentId ?? '', showInMenu: cat.showInMenu });
    setImageFile(null);
    setImageRemoved(false);
    setProductImagePickerOpen(false);
    replaceImagePreview(cat.imageUrl);
    setNameError(undefined);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_CAT_FORM);
    setImageFile(null);
    setImageRemoved(false);
    setProductImagePickerOpen(false);
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
      let savedCategoryId = editingId;
      if (savedCategoryId) {
        await categoriesService.updateCategory(savedCategoryId, payload);
      } else {
        const created = await categoriesService.createCategory(storeId as string, payload);
        savedCategoryId = created.id;
      }
      if (imageFile) {
        await categoriesService.setCategoryImage(storeId as string, savedCategoryId, imageFile);
      } else if (editingId && imageRemoved) {
        await categoriesService.clearCategoryImage(savedCategoryId);
      }
      notify.success(editingId ? 'Categoría actualizada' : 'Categoría creada');
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
  const pickerCategoryIds = editingId
    ? [editingId, ...categories.filter((category) => category.parentId === editingId).map((category) => category.id)]
    : [];
  const categoryNameById = Object.fromEntries(categories.map((category) => [category.id, category.name]));
  const parentOptions = [
    { value: '', label: '— Sin padre (categoría raíz) —' },
    ...rootCats.map((c) => ({ value: c.id, label: c.name })),
  ];
  const editingCategoryName = editingId
    ? categories.find((category) => category.id === editingId)?.name ?? form.name
    : null;

  function renderCategoryForm(className = '') {
    return (
      <Card className={`border-indigo-200 shadow-none ${className}`}>
        <div className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {editingCategoryName ? `Editando: ${editingCategoryName}` : 'Nueva categoría'}
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
          <ImageUploadField
            id="category-navigation-image"
            label="Imagen de la categoría"
            assetKind="catalog_taxonomy_image"
            previewUrl={imagePreviewUrl}
            onFileSelect={selectImage}
            onClear={imagePreviewUrl ? clearImage : undefined}
            uploading={saving && imageFile !== null}
            aspectClassName="h-24 w-24 rounded-xl"
            hint={editingId
              ? 'Sube una foto o elige la imagen principal de uno de los productos de esta categoría. Siempre podrás ajustar el recorte.'
              : 'Después de crear la categoría también podrás elegir la imagen principal de uno de sus productos.'}
            secondaryAction={editingId ? {
              label: 'Elegir de productos',
              icon: <Images className="h-4 w-4" />,
              onClick: () => setProductImagePickerOpen(true),
            } : undefined}
          />
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700">
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
    );
  }

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

      {showForm && !editingId ? renderCategoryForm() : null}

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
                <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${editingId === cat.id ? 'border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-100' : 'border-gray-200 bg-white'}`}>
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                      <ImageIcon className="h-4 w-4" />
                    </span>
                  )}
                  <span className="flex-1 text-sm font-medium text-gray-900">{cat.name}</span>
                  {!cat.showInMenu && (
                    <Badge variant="default">Oculta en menú</Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="text-gray-400 hover:text-indigo-600 transition-colors"
                    aria-label={`Editar ${cat.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(cat.id)}
                    disabled={deletingId === cat.id}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    aria-label={`Eliminar ${cat.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {showForm && editingId === cat.id ? renderCategoryForm('mt-1') : null}
                {children.map((sub) => (
                  <div key={sub.id}>
                    <div
                      className={`ml-6 mt-1 flex items-center gap-3 rounded-lg border px-4 py-2.5 ${editingId === sub.id ? 'border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-100' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                      {sub.imageUrl ? (
                        <img src={sub.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-gray-400">
                          <ImageIcon className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <span className="flex-1 text-sm text-gray-700">{sub.name}</span>
                      <button
                        type="button"
                        onClick={() => openEdit(sub)}
                        className="text-gray-400 transition-colors hover:text-indigo-600"
                        aria-label={`Editar ${sub.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(sub.id)}
                        disabled={deletingId === sub.id}
                        className="text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
                        aria-label={`Eliminar ${sub.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {showForm && editingId === sub.id ? renderCategoryForm('ml-6 mt-1') : null}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {productImagePickerOpen && editingId ? (
        <Suspense fallback={(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-xl">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando imágenes…
            </div>
          </div>
        )}>
          <ProductImagePickerDialog
            storeId={storeId}
            categoryIds={pickerCategoryIds}
            categoryNameById={categoryNameById}
            categoryName={form.name.trim() || 'esta categoría'}
            onClose={() => setProductImagePickerOpen(false)}
            onSelect={selectImage}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
