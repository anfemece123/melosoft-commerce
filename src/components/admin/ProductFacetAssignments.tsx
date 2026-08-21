import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { facetsService } from '@/features/facets/facetsService';
import type { FacetCategoryAssignment, FacetInputType, StoreFacet, StoreFacetValue } from '@/features/facets/facets.types';
import type { PublicStoreCategory } from '@/types/common.types';
import { notify } from '@/lib/notifications';
import { scrollToFirstError } from '@/hooks/useScrollToFirstFormikError';

interface ProductFacetAssignmentsProps {
  storeId: string;
  facets: StoreFacet[];
  categories: PublicStoreCategory[];
  selectedFacetValueIds: string[];
  selectedCategory: PublicStoreCategory | null;
  onChange: (valueIds: string[]) => void;
  onFacetsChange: (facets: StoreFacet[]) => void;
}

type FacetScope = 'all' | 'current' | 'manual';

interface CreateFacetFormState {
  name: string;
  inputType: FacetInputType;
  showInCatalogFilters: boolean;
  showInMegaMenu: boolean;
  scope: FacetScope;
  manualCategoryIds: string[];
}

interface EditFacetFormState extends CreateFacetFormState {
  showInProductForm: boolean;
}

function emptyCreateFacetForm(defaultScope: FacetScope): CreateFacetFormState {
  return {
    name: '',
    inputType: 'single_select',
    showInCatalogFilters: true,
    showInMegaMenu: false,
    scope: defaultScope,
    manualCategoryIds: [],
  };
}

function facetToEditForm(facet: StoreFacet): EditFacetFormState {
  return {
    name: facet.name,
    inputType: facet.inputType,
    showInProductForm: facet.showInProductForm,
    showInCatalogFilters: facet.showInCatalogFilters,
    showInMegaMenu: facet.showInMegaMenu,
    scope: facet.appliesToAllCategories ? 'all' : 'manual',
    manualCategoryIds: facet.applicableCategories.map((assignment) => assignment.categoryId),
  };
}

function facetFormToApplicability(form: Pick<EditFacetFormState, 'scope' | 'manualCategoryIds'>): {
  appliesToAllCategories: boolean;
  applicableCategories: FacetCategoryAssignment[];
} {
  if (form.scope === 'all') return { appliesToAllCategories: true, applicableCategories: [] };
  return {
    appliesToAllCategories: false,
    applicableCategories: form.manualCategoryIds.map((categoryId) => ({
      categoryId,
      appliesToChildren: true,
    })),
  };
}

function FacetScopeFields({
  form,
  categories,
  radioName,
  onChange,
}: {
  form: Pick<EditFacetFormState, 'scope' | 'manualCategoryIds'>;
  categories: PublicStoreCategory[];
  radioName: string;
  onChange: (next: Pick<EditFacetFormState, 'scope' | 'manualCategoryIds'>) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-sm font-medium text-gray-900">¿Dónde se usará?</p>
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name={radioName}
            checked={form.scope === 'all'}
            onChange={() => onChange({ ...form, scope: 'all' })}
            className="h-4 w-4 border-gray-300 text-indigo-600"
          />
          En todas las categorías
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name={radioName}
            checked={form.scope === 'manual'}
            onChange={() => onChange({ ...form, scope: 'manual' })}
            className="h-4 w-4 border-gray-300 text-indigo-600"
          />
          Elegir categorías específicas
        </label>
      </div>
      {form.scope === 'manual' && (
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
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

function facetAppliesToCategory(facet: StoreFacet, category: PublicStoreCategory | null): boolean {
  if (facet.appliesToAllCategories) return true;
  if (!category) return false;
  return facet.applicableCategories.some((assignment) => {
    if (assignment.categoryId === category.id) return true;
    if (assignment.appliesToChildren && category.parentId && assignment.categoryId === category.parentId) return true;
    return false;
  });
}

export function ProductFacetAssignments({
  storeId,
  facets,
  categories,
  selectedFacetValueIds,
  selectedCategory,
  onChange,
  onFacetsChange,
}: ProductFacetAssignmentsProps) {
  const [showCreateFacet, setShowCreateFacet] = useState(false);
  const [createFacetForm, setCreateFacetForm] = useState<CreateFacetFormState>(
    emptyCreateFacetForm(selectedCategory ? 'current' : 'all'),
  );
  const [creatingFacet, setCreatingFacet] = useState(false);
  const [newValueByFacetId, setNewValueByFacetId] = useState<Record<string, string>>({});
  const [creatingValueFacetId, setCreatingValueFacetId] = useState<string | null>(null);
  const [createFacetError, setCreateFacetError] = useState<string | undefined>();
  const [valueErrors, setValueErrors] = useState<Record<string, string | undefined>>({});
  const [editingFacetId, setEditingFacetId] = useState<string | null>(null);
  const [editFacetForm, setEditFacetForm] = useState<EditFacetFormState | null>(null);
  const [editFacetError, setEditFacetError] = useState<string | undefined>();
  const [savingFacetId, setSavingFacetId] = useState<string | null>(null);
  const [facetToDelete, setFacetToDelete] = useState<StoreFacet | null>(null);
  const [deletingFacetId, setDeletingFacetId] = useState<string | null>(null);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueText, setEditingValueText] = useState('');
  const [savingValueId, setSavingValueId] = useState<string | null>(null);
  const [valueToDelete, setValueToDelete] = useState<{ facet: StoreFacet; value: StoreFacetValue } | null>(null);
  const [deletingValueId, setDeletingValueId] = useState<string | null>(null);

  const visibleFacets = useMemo(
    () => facets
      .filter((facet) => facet.isActive && facet.showInProductForm && facetAppliesToCategory(facet, selectedCategory))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [facets, selectedCategory],
  );

  function getSelectedValuesForFacet(facetId: string): string[] {
    const facet = visibleFacets.find((candidate) => candidate.id === facetId);
    if (!facet) return [];
    const allowedIds = new Set(facet.values.map((value) => value.id));
    return selectedFacetValueIds.filter((valueId) => allowedIds.has(valueId));
  }

  function toggleFacetValue(facetId: string, valueId: string, isMulti: boolean) {
    const currentFacetValueIds = getSelectedValuesForFacet(facetId);
    const selected = currentFacetValueIds.includes(valueId);

    if (isMulti) {
      if (selected) {
        onChange(selectedFacetValueIds.filter((currentValueId) => currentValueId !== valueId));
      } else {
        onChange([...selectedFacetValueIds, valueId]);
      }
      return;
    }

    const otherFacetValueIds = selectedFacetValueIds.filter((currentValueId) => !currentFacetValueIds.includes(currentValueId));
    if (selected) {
      onChange(otherFacetValueIds);
      return;
    }
    onChange([...otherFacetValueIds, valueId]);
  }

  async function handleCreateFacet() {
    const name = createFacetForm.name.trim();
    if (creatingFacet) return;
    if (!name) {
      setCreateFacetError('Escribe el nombre de la característica.');
      scrollToFirstError({ fieldName: 'new-facet-name' });
      return;
    }

    setCreateFacetError(undefined);
    const appliesToAllCategories = createFacetForm.scope === 'all';
    let applicableCategories: FacetCategoryAssignment[] = [];
    if (createFacetForm.scope === 'current' && selectedCategory) {
      applicableCategories = [{ categoryId: selectedCategory.id, appliesToChildren: true }];
    } else if (createFacetForm.scope === 'manual') {
      applicableCategories = createFacetForm.manualCategoryIds.map((categoryId) => ({
        categoryId,
        appliesToChildren: true,
      }));
    }

    setCreatingFacet(true);
    try {
      const created = await facetsService.createFacet({
        storeId,
        name,
        slug: '',
        inputType: createFacetForm.inputType,
        showInProductForm: true,
        showInCatalogFilters: createFacetForm.showInCatalogFilters,
        showInMegaMenu: createFacetForm.showInMegaMenu,
        appliesToAllCategories,
        applicableCategories,
        sortOrder: facets.length,
      });
      onFacetsChange([...facets, created]);
      setCreateFacetForm(emptyCreateFacetForm(selectedCategory ? 'current' : 'all'));
      setShowCreateFacet(false);
      notify.success('Característica creada. Ahora puedes asignarle valores.');
    } catch (err) {
      notify.fromError(err);
    } finally {
      setCreatingFacet(false);
    }
  }

  async function handleCreateValue(facet: StoreFacet) {
    const draft = newValueByFacetId[facet.id]?.trim() ?? '';
    if (creatingValueFacetId === facet.id) return;
    if (!draft) {
      setValueErrors((current) => ({ ...current, [facet.id]: 'Escribe el nuevo valor.' }));
      scrollToFirstError({ fieldName: `facet-value-${facet.id}` });
      return;
    }

    setValueErrors((current) => ({ ...current, [facet.id]: undefined }));
    setCreatingValueFacetId(facet.id);
    try {
      const created = await facetsService.findOrCreateFacetValue(storeId, facet.id, draft);
      const nextFacets = facets.map((currentFacet) => (
        currentFacet.id === facet.id
          ? {
              ...currentFacet,
              values: currentFacet.values.some((value) => value.id === created.id)
                ? currentFacet.values
                : [...currentFacet.values, created].sort((a, b) => a.sortOrder - b.sortOrder || a.value.localeCompare(b.value)),
            }
          : currentFacet
      ));
      onFacetsChange(nextFacets);
      if (facet.inputType === 'multi_select') {
        if (!selectedFacetValueIds.includes(created.id)) {
          onChange([...selectedFacetValueIds, created.id]);
        }
      } else {
        const currentFacetValueIds = getSelectedValuesForFacet(facet.id);
        const otherFacetValueIds = selectedFacetValueIds.filter((valueId) => !currentFacetValueIds.includes(valueId));
        onChange([...otherFacetValueIds, created.id]);
      }
      setNewValueByFacetId((current) => ({ ...current, [facet.id]: '' }));
      notify.success('Valor creado y asignado al producto.');
    } catch (err) {
      notify.fromError(err);
    } finally {
      setCreatingValueFacetId(null);
    }
  }

  function startEditingFacet(facet: StoreFacet) {
    setEditingFacetId(facet.id);
    setEditFacetForm(facetToEditForm(facet));
    setEditFacetError(undefined);
  }

  function cancelEditingFacet() {
    setEditingFacetId(null);
    setEditFacetForm(null);
    setEditFacetError(undefined);
  }

  async function handleSaveFacet(facet: StoreFacet) {
    if (!editFacetForm || savingFacetId === facet.id) return;
    const name = editFacetForm.name.trim();
    if (!name) {
      setEditFacetError('Escribe el nombre de la característica.');
      scrollToFirstError({ fieldName: `edit-facet-name-${facet.id}` });
      return;
    }

    setEditFacetError(undefined);
    setSavingFacetId(facet.id);
    try {
      const { appliesToAllCategories, applicableCategories } = facetFormToApplicability(editFacetForm);
      const updated = await facetsService.updateFacet(facet.id, {
        name,
        inputType: editFacetForm.inputType,
        showInProductForm: editFacetForm.showInProductForm,
        showInCatalogFilters: editFacetForm.showInCatalogFilters,
        showInMegaMenu: editFacetForm.showInMegaMenu,
        appliesToAllCategories,
      });
      await facetsService.setFacetCategories(facet.id, applicableCategories);
      onFacetsChange(facets.map((currentFacet) => (
        currentFacet.id === facet.id
          ? { ...updated, applicableCategories }
          : currentFacet
      )));
      cancelEditingFacet();
      notify.success('Característica actualizada.');
    } catch (err) {
      notify.fromError(err, 'No se pudo actualizar la característica.');
    } finally {
      setSavingFacetId(null);
    }
  }

  async function handleDeleteFacet(facet: StoreFacet) {
    if (deletingFacetId === facet.id) return;
    setDeletingFacetId(facet.id);
    try {
      await facetsService.deleteFacet(facet.id);
      const deletedValueIds = new Set(facet.values.map((value) => value.id));
      onFacetsChange(facets.filter((currentFacet) => currentFacet.id !== facet.id));
      onChange(selectedFacetValueIds.filter((valueId) => !deletedValueIds.has(valueId)));
      if (editingFacetId === facet.id) cancelEditingFacet();
      setFacetToDelete(null);
      notify.success('Característica eliminada.');
    } catch (err) {
      notify.fromError(err, 'No se pudo eliminar la característica.');
    } finally {
      setDeletingFacetId(null);
    }
  }

  function startEditingValue(value: StoreFacetValue) {
    setEditingValueId(value.id);
    setEditingValueText(value.value);
  }

  function cancelEditingValue() {
    setEditingValueId(null);
    setEditingValueText('');
  }

  async function handleSaveValue(facet: StoreFacet, value: StoreFacetValue) {
    const nextValue = editingValueText.trim();
    if (!nextValue || savingValueId === value.id) return;
    setSavingValueId(value.id);
    try {
      const updatedValue = await facetsService.updateFacetValue(value.id, { value: nextValue });
      onFacetsChange(facets.map((currentFacet) => (
        currentFacet.id === facet.id
          ? {
              ...currentFacet,
              values: currentFacet.values.map((currentValue) => (
                currentValue.id === value.id ? updatedValue : currentValue
              )),
            }
          : currentFacet
      )));
      cancelEditingValue();
      notify.success('Valor actualizado.');
    } catch (err) {
      notify.fromError(err, 'No se pudo actualizar el valor.');
    } finally {
      setSavingValueId(null);
    }
  }

  async function handleDeleteValue(facet: StoreFacet, value: StoreFacetValue) {
    if (deletingValueId === value.id) return;
    setDeletingValueId(value.id);
    try {
      await facetsService.deleteFacetValue(value.id);
      onFacetsChange(facets.map((currentFacet) => (
        currentFacet.id === facet.id
          ? { ...currentFacet, values: currentFacet.values.filter((currentValue) => currentValue.id !== value.id) }
          : currentFacet
      )));
      onChange(selectedFacetValueIds.filter((valueId) => valueId !== value.id));
      if (editingValueId === value.id) cancelEditingValue();
      setValueToDelete(null);
      notify.success('Valor eliminado.');
    } catch (err) {
      notify.fromError(err, 'No se pudo eliminar el valor.');
    } finally {
      setDeletingValueId(null);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-violet-600" />
            <h3 className="text-lg font-semibold text-gray-900">Atributos del producto</h3>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
              Filtro
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Datos que describen el producto y ayudan a filtrarlo en el catálogo. No manejan stock, precio ni SKU.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => {
            if (showCreateFacet) {
              setCreateFacetForm(emptyCreateFacetForm(selectedCategory ? 'current' : 'all'));
              setCreateFacetError(undefined);
            } else {
              setCreateFacetForm(emptyCreateFacetForm(selectedCategory ? 'current' : 'all'));
            }
            setShowCreateFacet((current) => !current);
          }}
        >
          Crear característica
        </Button>
      </div>

      {!selectedCategory ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Selecciona una categoría principal para ver las características recomendadas de este
          producto. Por ahora se muestran solo las características globales.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <p className="font-medium text-gray-900">
            Características sugeridas para: {selectedCategory.name}
          </p>
        </div>
      )}

      {showCreateFacet ? (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            Nueva característica
          </div>
          <Input
            id="new-facet-name"
            name="new-facet-name"
            label="Nombre de la característica"
            value={createFacetForm.name}
            onChange={(event) => {
              setCreateFacetForm((current) => ({ ...current, name: event.target.value }));
              setCreateFacetError(undefined);
            }}
            error={createFacetError}
            placeholder="Ej: Marca, Talla, Color, Nivel, Material"
          />
          <Select
            id="new-facet-input-type"
            label="Tipo de selección"
            value={createFacetForm.inputType}
            onChange={(event) => setCreateFacetForm((current) => ({ ...current, inputType: event.target.value as FacetInputType }))}
            options={[
              { value: 'single_select', label: 'Selección única' },
              { value: 'multi_select', label: 'Selección múltiple' },
            ]}
          />

          <div className="space-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-sm font-medium text-gray-900">¿Dónde se usará?</p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="facet-scope"
                  checked={createFacetForm.scope === 'all'}
                  onChange={() => setCreateFacetForm((current) => ({ ...current, scope: 'all' }))}
                  className="h-4 w-4 border-gray-300 text-indigo-600"
                />
                En todas las categorías
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="facet-scope"
                  checked={createFacetForm.scope === 'current'}
                  disabled={!selectedCategory}
                  onChange={() => setCreateFacetForm((current) => ({ ...current, scope: 'current' }))}
                  className="h-4 w-4 border-gray-300 text-indigo-600 disabled:opacity-40"
                />
                {selectedCategory ? `Solo en ${selectedCategory.name}` : 'Solo en la categoría principal seleccionada'}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="facet-scope"
                  checked={createFacetForm.scope === 'manual'}
                  onChange={() => setCreateFacetForm((current) => ({ ...current, scope: 'manual' }))}
                  className="h-4 w-4 border-gray-300 text-indigo-600"
                />
                Elegir categorías manualmente
              </label>
            </div>

            {createFacetForm.scope === 'manual' && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
                {categories.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-gray-500">No hay categorías creadas todavía.</p>
                ) : (
                  categories.map((category) => {
                    const checked = createFacetForm.manualCategoryIds.includes(category.id);
                    return (
                      <label key={category.id} className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setCreateFacetForm((current) => ({
                            ...current,
                            manualCategoryIds: checked
                              ? current.manualCategoryIds.filter((id) => id !== category.id)
                              : [...current.manualCategoryIds, category.id],
                          }))}
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

          <div className="space-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={createFacetForm.showInCatalogFilters}
                onChange={(event) => setCreateFacetForm((current) => ({ ...current, showInCatalogFilters: event.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              <span>
                <span className="font-medium text-gray-900">Filtros del catálogo</span>
                <span className="block text-xs text-gray-500">
                  Permite que el cliente filtre productos usando esta característica.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={createFacetForm.showInMegaMenu}
                onChange={(event) => setCreateFacetForm((current) => ({ ...current, showInMegaMenu: event.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              <span>
                <span className="font-medium text-gray-900">Mega menús de categoría</span>
                <span className="block text-xs text-gray-500">
                  Muestra sus valores al desplegar una categoría en la navegación pública.
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" isLoading={creatingFacet} onClick={() => void handleCreateFacet()}>
              Crear característica
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateFacet(false);
                setCreateFacetForm(emptyCreateFacetForm(selectedCategory ? 'current' : 'all'));
                setCreateFacetError(undefined);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {visibleFacets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6 text-center">
          <p className="text-sm font-medium text-gray-900">
            {selectedCategory
              ? 'Esta categoría todavía no tiene características asignadas.'
              : 'Aún no tienes características filtrables.'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Crea características como Marca, Género, Nivel, Talla o Color para mejorar los filtros del catálogo.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleFacets.map((facet) => {
            const selectedIds = getSelectedValuesForFacet(facet.id);
            const isMulti = facet.inputType === 'multi_select';
            const draftValue = newValueByFacetId[facet.id] ?? '';

            return (
              <div key={facet.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{facet.name}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {isMulti ? 'Selección múltiple' : 'Selección única'}
                      </span>
                      {facet.showInCatalogFilters ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Filtro público
                        </span>
                      ) : null}
                      {facet.showInMegaMenu ? (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                          Mega menú de categoría
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {isMulti
                        ? 'Puedes elegir varios valores para este producto.'
                        : 'Elige un único valor para este producto.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditingFacet(facet)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                      aria-label={`Editar característica ${facet.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacetToDelete(facet)}
                      disabled={deletingFacetId === facet.id}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label={`Eliminar característica ${facet.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <SlidersHorizontal className="ml-1 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {editingFacetId === facet.id && editFacetForm ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                    <p className="text-sm font-semibold text-gray-900">Editar característica</p>
                    <Input
                      id={`edit-facet-name-${facet.id}`}
                      name={`edit-facet-name-${facet.id}`}
                      label="Nombre"
                      value={editFacetForm.name}
                      onChange={(event) => {
                        setEditFacetForm((current) => current ? { ...current, name: event.target.value } : current);
                        setEditFacetError(undefined);
                      }}
                      error={editFacetError}
                    />
                    <Select
                      label="Tipo de selección"
                      value={editFacetForm.inputType}
                      onChange={(event) => setEditFacetForm((current) => current ? { ...current, inputType: event.target.value as FacetInputType } : current)}
                      options={[
                        { value: 'single_select', label: 'Selección única' },
                        { value: 'multi_select', label: 'Selección múltiple' },
                      ]}
                    />
                    <FacetScopeFields
                      form={editFacetForm}
                      categories={categories}
                      radioName={`edit-facet-scope-${facet.id}`}
                      onChange={(next) => setEditFacetForm((current) => current ? { ...current, ...next } : current)}
                    />
                    <div className="space-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
                      {(
                        [
                          ['showInProductForm', 'Mostrar en formulario de producto'],
                          ['showInCatalogFilters', 'Mostrar en filtros del catálogo'],
                          ['showInMegaMenu', 'Mostrar dentro de mega menús de categoría'],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={editFacetForm[key]}
                            onChange={(event) => setEditFacetForm((current) => current ? { ...current, [key]: event.target.checked } : current)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        isLoading={savingFacetId === facet.id}
                        onClick={() => void handleSaveFacet(facet)}
                      >
                        Guardar cambios
                      </Button>
                      <Button type="button" variant="secondary" onClick={cancelEditingFacet}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {facet.values.length > 0 ? (
                    facet.values.map((value) => {
                      const selected = selectedIds.includes(value.id);
                      if (editingValueId === value.id) {
                        return (
                          <div key={value.id} className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2 py-1">
                            <input
                              type="text"
                              value={editingValueText}
                              onChange={(event) => setEditingValueText(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void handleSaveValue(facet, value);
                                }
                                if (event.key === 'Escape') cancelEditingValue();
                              }}
                              aria-label={`Editar valor ${value.value}`}
                              className="h-6 w-28 bg-transparent px-1 text-sm text-gray-800 outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveValue(facet, value)}
                              disabled={!editingValueText.trim() || savingValueId === value.id}
                              className="rounded-full p-1 text-indigo-600 hover:bg-indigo-100 disabled:opacity-40"
                              aria-label={`Guardar valor ${value.value}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingValue}
                              className="rounded-full p-1 text-gray-500 hover:bg-gray-200"
                              aria-label="Cancelar edición del valor"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={value.id}
                          className={[
                            'group inline-flex items-center rounded-full border text-sm transition-colors',
                            selected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <button
                            type="button"
                            onClick={() => toggleFacetValue(facet.id, value.id, isMulti)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5"
                          >
                            {selected ? <Check className="h-3.5 w-3.5" /> : null}
                            {value.value}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingValue(value)}
                            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white hover:text-indigo-600"
                            aria-label={`Editar valor ${value.value}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setValueToDelete({ facet, value })}
                            disabled={deletingValueId === value.id}
                            className="mr-1 rounded-full p-1 text-gray-400 transition-colors hover:bg-white hover:text-red-600 disabled:opacity-50"
                            aria-label={`Eliminar valor ${value.value}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Aún no hay valores creados para esta característica.
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2 md:flex-row">
                  <Input
                    id={`facet-value-${facet.id}`}
                    name={`facet-value-${facet.id}`}
                    label="Crear nuevo valor"
                    placeholder={`Ej: ${facet.name === 'Marca' ? 'Bullpadel' : 'Nuevo valor'}`}
                    value={draftValue}
                    onChange={(event) => {
                      setNewValueByFacetId((current) => ({ ...current, [facet.id]: event.target.value }));
                      setValueErrors((current) => ({ ...current, [facet.id]: undefined }));
                    }}
                    error={valueErrors[facet.id]}
                    className="flex-1"
                  />
                  <div className="md:self-end">
                    <Button
                      type="button"
                      variant="secondary"
                      leftIcon={<Plus className="h-4 w-4" />}
                      isLoading={creatingValueFacetId === facet.id}
                      onClick={() => void handleCreateValue(facet)}
                    >
                      Crear valor
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={facetToDelete !== null}
        title="Eliminar característica"
        message={facetToDelete
          ? `Se eliminará “${facetToDelete.name}”, sus valores y las asignaciones de esos valores en los productos. Esta acción no se puede deshacer.`
          : ''}
        confirmLabel="Eliminar característica"
        isLoading={facetToDelete ? deletingFacetId === facetToDelete.id : false}
        onCancel={() => {
          if (!deletingFacetId) setFacetToDelete(null);
        }}
        onConfirm={() => {
          if (facetToDelete) void handleDeleteFacet(facetToDelete);
        }}
      />

      <ConfirmDialog
        open={valueToDelete !== null}
        title="Eliminar valor"
        message={valueToDelete
          ? `Se eliminará el valor “${valueToDelete.value.value}” de la característica “${valueToDelete.facet.name}” y de los productos que lo usan.`
          : ''}
        confirmLabel="Eliminar valor"
        isLoading={valueToDelete ? deletingValueId === valueToDelete.value.id : false}
        onCancel={() => {
          if (!deletingValueId) setValueToDelete(null);
        }}
        onConfirm={() => {
          if (valueToDelete) void handleDeleteValue(valueToDelete.facet, valueToDelete.value);
        }}
      />
    </div>
  );
}
