import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { facetsService } from '@/features/facets/facetsService';
import type { FacetCategoryAssignment, FacetInputType, StoreFacet } from '@/features/facets/facets.types';
import type { PublicStoreCategory } from '@/types/common.types';
import { notify } from '@/lib/notifications';

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

  useEffect(() => {
    if (!showCreateFacet) {
      setCreateFacetForm(emptyCreateFacetForm(selectedCategory ? 'current' : 'all'));
    }
  }, [selectedCategory, showCreateFacet]);

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
    if (!name || creatingFacet) return;

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
    if (!draft || creatingValueFacetId === facet.id) return;

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

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <h3 className="text-lg font-semibold text-gray-900">Características para filtros</h3>
          <p className="mt-1 text-sm text-gray-500">
            Agrega datos como marca, talla, color, nivel o material. Estos datos ayudan a tus
            clientes a filtrar productos en el catálogo.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreateFacet((current) => !current)}
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
            label="Nombre de la característica"
            value={createFacetForm.name}
            onChange={(event) => setCreateFacetForm((current) => ({ ...current, name: event.target.value }))}
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
                <span className="font-medium text-gray-900">Mega menú</span>
                <span className="block text-xs text-gray-500">
                  Úsalo si quieres destacar esta característica dentro de la navegación pública.
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
                          Mega menú
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {isMulti
                        ? 'Puedes elegir varios valores para este producto.'
                        : 'Elige un único valor para este producto.'}
                    </p>
                  </div>
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-gray-400" />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {facet.values.length > 0 ? (
                    facet.values.map((value) => {
                      const selected = selectedIds.includes(value.id);
                      return (
                        <button
                          key={value.id}
                          type="button"
                          onClick={() => toggleFacetValue(facet.id, value.id, isMulti)}
                          className={[
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                            selected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : null}
                          {value.value}
                        </button>
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
                    label="Crear nuevo valor"
                    placeholder={`Ej: ${facet.name === 'Marca' ? 'Bullpadel' : 'Nuevo valor'}`}
                    value={draftValue}
                    onChange={(event) => setNewValueByFacetId((current) => ({ ...current, [facet.id]: event.target.value }))}
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
    </div>
  );
}
