import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { facetsService } from '@/features/facets/facetsService';
import { categoriesService } from '@/features/categories/categoriesService';
import type { StoreFacet, StoreFacetValue, FacetInputType, FacetCategoryAssignment } from '@/features/facets/facets.types';
import type { PublicStoreCategory } from '@/types/common.types';
import { notify } from '@/lib/notifications';

type FacetScope = 'all' | 'manual';

interface FacetForm {
  name: string;
  inputType: FacetInputType;
  showInProductForm: boolean;
  showInCatalogFilters: boolean;
  showInMegaMenu: boolean;
  scope: FacetScope;
  manualCategoryIds: string[];
}

const EMPTY_FACET_FORM: FacetForm = {
  name: '',
  inputType: 'single_select',
  showInProductForm: true,
  showInCatalogFilters: true,
  showInMegaMenu: false,
  scope: 'all',
  manualCategoryIds: [],
};

const INPUT_TYPE_OPTIONS = [
  { value: 'single_select', label: 'Selección única' },
  { value: 'multi_select', label: 'Selección múltiple' },
];

function CategoryScopeFields({
  form,
  categories,
  onChange,
}: {
  form: FacetForm;
  categories: PublicStoreCategory[];
  onChange: (next: FacetForm) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-sm font-medium text-gray-900">¿Dónde se usará?</p>
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            checked={form.scope === 'all'}
            onChange={() => onChange({ ...form, scope: 'all' })}
            className="h-4 w-4 border-gray-300 text-indigo-600"
          />
          En todas las categorías
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            checked={form.scope === 'manual'}
            onChange={() => onChange({ ...form, scope: 'manual' })}
            className="h-4 w-4 border-gray-300 text-indigo-600"
          />
          Elegir categorías específicas
        </label>
      </div>
      {form.scope === 'manual' && (
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
          {categories.length === 0 ? (
            <p className="px-2 py-1 text-xs text-gray-500">No hay categorías creadas todavía.</p>
          ) : (
            categories.map((category) => {
              const checked = form.manualCategoryIds.includes(category.id);
              return (
                <label key={category.id} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange({
                      ...form,
                      manualCategoryIds: checked
                        ? form.manualCategoryIds.filter((id) => id !== category.id)
                        : [...form.manualCategoryIds, category.id],
                    })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  {category.parentId ? `— ${category.name}` : category.name}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function facetFormToApplicability(form: FacetForm): { appliesToAllCategories: boolean; applicableCategories: FacetCategoryAssignment[] } {
  if (form.scope === 'all') return { appliesToAllCategories: true, applicableCategories: [] };
  return {
    appliesToAllCategories: false,
    applicableCategories: form.manualCategoryIds.map((categoryId) => ({ categoryId, appliesToChildren: true })),
  };
}

function facetToForm(facet: StoreFacet): FacetForm {
  return {
    name: facet.name,
    inputType: facet.inputType,
    showInProductForm: facet.showInProductForm,
    showInCatalogFilters: facet.showInCatalogFilters,
    showInMegaMenu: facet.showInMegaMenu,
    scope: facet.appliesToAllCategories ? 'all' : 'manual',
    manualCategoryIds: facet.applicableCategories.map((a) => a.categoryId),
  };
}

function FacetValueRow({
  value,
  onDelete,
}: {
  value: StoreFacetValue;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await facetsService.deleteFacetValue(value.id);
      onDelete();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error eliminando valor');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
      {value.value}
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className="ml-0.5 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
        aria-label={`Eliminar ${value.value}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function FacetCard({
  facet,
  storeId,
  categories,
  onUpdate,
  onDelete,
}: {
  facet: StoreFacet;
  storeId: string;
  categories: PublicStoreCategory[];
  onUpdate: (updated: StoreFacet) => void;
  onDelete: () => void;
}) {
  const [values, setValues] = useState<StoreFacetValue[]>(facet.values);
  const [newValue, setNewValue] = useState('');
  const [addingValue, setAddingValue] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<FacetForm>(facetToForm(facet));
  const [saving, setSaving] = useState(false);

  async function addValue() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    setAddingValue(true);
    try {
      const created = await facetsService.createFacetValue({
        storeId,
        facetId: facet.id,
        value: trimmed,
        slug: trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        sortOrder: values.length,
      });
      setValues((v) => [...v, created]);
      setNewValue('');
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error agregando valor');
    } finally {
      setAddingValue(false);
    }
  }

  async function saveEdit() {
    if (!editForm.name.trim()) { notify.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const { appliesToAllCategories, applicableCategories } = facetFormToApplicability(editForm);
      const updated = await facetsService.updateFacet(facet.id, {
        name: editForm.name.trim(),
        inputType: editForm.inputType,
        showInProductForm: editForm.showInProductForm,
        showInCatalogFilters: editForm.showInCatalogFilters,
        showInMegaMenu: editForm.showInMegaMenu,
        appliesToAllCategories,
      });
      await facetsService.setFacetCategories(facet.id, applicableCategories);
      onUpdate({ ...updated, applicableCategories });
      setEditing(false);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error guardando característica');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFacet() {
    setDeleting(true);
    try {
      await facetsService.deleteFacet(facet.id);
      onDelete();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error eliminando característica');
      setDeleting(false);
    }
  }

  return (
    <Card>
      <div className="p-4 space-y-3">
        {editing ? (
          <div className="space-y-3">
            <Input
              label="Nombre"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label="Tipo de selección"
              value={editForm.inputType}
              onChange={(e) => setEditForm((f) => ({ ...f, inputType: e.target.value as FacetInputType }))}
              options={INPUT_TYPE_OPTIONS}
            />
            <CategoryScopeFields form={editForm} categories={categories} onChange={setEditForm} />
            <div className="space-y-2">
              {(
                [
                  ['showInProductForm', 'Mostrar en formulario de producto'],
                  ['showInCatalogFilters', 'Mostrar en filtros del catálogo'],
                  ['showInMegaMenu', 'Mostrar en mega menú'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button isLoading={saving} onClick={() => void saveEdit()}>Guardar</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm">{facet.name}</span>
                <Badge variant="default">
                  {facet.inputType === 'multi_select' ? 'Multi' : 'Única'}
                </Badge>
                {facet.showInMegaMenu && <Badge variant="success">Mega menú</Badge>}
                {!facet.showInCatalogFilters && <Badge variant="default">Sin filtro</Badge>}
                {!facet.appliesToAllCategories && <Badge variant="info">Categorías específicas</Badge>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-gray-400 hover:text-indigo-600 transition-colors shrink-0"
              aria-label="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void deleteFacet()}
              disabled={deleting}
              className="text-gray-400 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50"
              aria-label="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Values */}
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Valores</p>
          <div className="flex flex-wrap gap-1.5">
            {values.map((v) => (
              <FacetValueRow
                key={v.id}
                value={v}
                onDelete={() => setValues((prev) => prev.filter((x) => x.id !== v.id))}
              />
            ))}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void addValue(); }
                }}
                placeholder="Nuevo valor…"
                className="h-7 rounded-full border border-dashed border-gray-300 px-2.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => void addValue()}
                disabled={addingValue || !newValue.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-40"
                aria-label="Agregar valor"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ProductFiltersPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const [facets, setFacets] = useState<StoreFacet[]>([]);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FacetForm>(EMPTY_FACET_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!storeId) return;
    try {
      const [facetsData, categoriesData] = await Promise.all([
        facetsService.getStoreFacets(storeId),
        categoriesService.getStoreCategories(storeId),
      ]);
      setFacets(facetsData);
      setCategories(categoriesData);
    } catch {
      notify.error('Error cargando características');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [storeId]);

  if (!storeId) return null;

  async function create() {
    if (!form.name.trim()) { notify.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const { appliesToAllCategories, applicableCategories } = facetFormToApplicability(form);
      const created = await facetsService.createFacet({
        storeId: storeId as string,
        name: form.name.trim(),
        slug: form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        inputType: form.inputType,
        showInProductForm: form.showInProductForm,
        showInCatalogFilters: form.showInCatalogFilters,
        showInMegaMenu: form.showInMegaMenu,
        appliesToAllCategories,
        applicableCategories,
        sortOrder: facets.length,
      });
      setFacets((prev) => [...prev, created]);
      setForm(EMPTY_FACET_FORM);
      setShowForm(false);
      notify.success('Característica creada');
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error creando característica');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Atributos del producto</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Datos como Marca, Género o Nivel que describen el producto y ayudan a filtrarlo. No manejan stock, precio ni SKU.
        </p>
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={() => setShowForm(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Nueva característica
        </Button>
      </div>

      {showForm && (
        <Card>
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">Nueva característica filtrable</h3>
            <Input
              label="Nombre"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Talla, Color, Material"
            />
            <Select
              label="Tipo de selección"
              value={form.inputType}
              onChange={(e) => setForm((f) => ({ ...f, inputType: e.target.value as FacetInputType }))}
              options={INPUT_TYPE_OPTIONS}
            />
            <CategoryScopeFields form={form} categories={categories} onChange={setForm} />
            <div className="space-y-2">
              {(
                [
                  ['showInProductForm', 'Mostrar en formulario de producto'],
                  ['showInCatalogFilters', 'Mostrar en filtros del catálogo público'],
                  ['showInMegaMenu', 'Mostrar en mega menú de navegación'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button isLoading={saving} onClick={() => void create()}>
                Crear característica
              </Button>
              <Button variant="secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FACET_FORM); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400">Cargando características…</div>
      ) : facets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          No hay características. Créalas para activar los filtros del catálogo.
        </div>
      ) : (
        <div className="space-y-3">
          {facets.map((facet) => (
            <FacetCard
              key={facet.id}
              facet={facet}
              storeId={storeId}
              categories={categories}
              onUpdate={(updated) =>
                setFacets((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
              }
              onDelete={() => setFacets((prev) => prev.filter((f) => f.id !== facet.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
