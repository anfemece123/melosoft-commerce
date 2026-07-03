import { useMemo, useState } from 'react';
import { Check, FolderPlus, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { categoriesService } from '@/features/categories/categoriesService';
import type { PublicStoreCategory } from '@/types/common.types';
import { notify } from '@/lib/notifications';

interface ProductCategorySelectProps {
  storeId: string;
  categories: PublicStoreCategory[];
  selectedCategoryId: string | null;
  onChange: (categoryId: string | null) => void;
  onCategoriesChange: (categories: PublicStoreCategory[]) => void;
}

interface CreateCategoryFormState {
  name: string;
  parentId: string;
}

type CreateMode = 'root' | 'child';

const EMPTY_CREATE_FORM: CreateCategoryFormState = {
  name: '',
  parentId: '',
};

function buildCategoryLabel(category: PublicStoreCategory, categoriesById: Map<string, PublicStoreCategory>): string {
  if (!category.parentId) return category.name;
  const parent = categoriesById.get(category.parentId);
  return parent ? `${parent.name} > ${category.name}` : category.name;
}

function sortCategoriesTree(categories: PublicStoreCategory[]): PublicStoreCategory[] {
  const byParentId = new Map<string | null, PublicStoreCategory[]>();

  for (const category of categories) {
    const key = category.parentId ?? null;
    const list = byParentId.get(key) ?? [];
    list.push(category);
    byParentId.set(key, list);
  }

  for (const list of byParentId.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  const result: PublicStoreCategory[] = [];

  function visit(parentId: string | null) {
    const children = byParentId.get(parentId) ?? [];
    for (const child of children) {
      result.push(child);
      visit(child.id);
    }
  }

  visit(null);

  return result;
}

function getCategoryDepth(category: PublicStoreCategory, categoriesById: Map<string, PublicStoreCategory>): number {
  let depth = 0;
  let currentParentId = category.parentId;

  while (currentParentId) {
    const parent = categoriesById.get(currentParentId);
    if (!parent) break;
    depth += 1;
    currentParentId = parent.parentId;
  }

  return depth;
}

export function ProductCategorySelect({
  storeId,
  categories,
  selectedCategoryId,
  onChange,
  onCategoriesChange,
}: ProductCategorySelectProps) {
  const [query, setQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('root');
  const [createForm, setCreateForm] = useState<CreateCategoryFormState>(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const rootCategories = useMemo(
    () => categories
      .filter((category) => !category.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories],
  );

  const sortedCategories = useMemo(
    () => sortCategoriesTree(categories),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return sortedCategories;

    return sortedCategories.filter((category) => {
      const label = buildCategoryLabel(category, categoriesById).toLowerCase();
      return label.includes(normalizedQuery);
    });
  }, [categoriesById, query, sortedCategories]);

  const selectedCategory = selectedCategoryId ? categoriesById.get(selectedCategoryId) ?? null : null;

  function openCreateForm(mode: CreateMode) {
    const suggestedParentId = mode === 'child'
      ? (selectedCategory ? (selectedCategory.parentId ?? selectedCategory.id) : rootCategories[0]?.id ?? '')
      : '';

    setCreateMode(mode);
    setCreateForm({
      name: '',
      parentId: suggestedParentId,
    });
    setShowCreateForm(true);
  }

  async function handleCreateCategory() {
    const name = createForm.name.trim();
    if (!name || creating) return;

    setCreating(true);
    try {
      const created = await categoriesService.createCategory(storeId, {
        name,
        parentId: createForm.parentId || null,
        showInMenu: true,
      });
      const nextCategories = [...categories, created]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      onCategoriesChange(nextCategories);
      onChange(created.id);
      setCreateForm(EMPTY_CREATE_FORM);
      setShowCreateForm(false);
      setQuery('');
      notify.success(
        created.parentId
          ? 'Subcategoría creada y asignada al producto.'
          : 'Categoría creada y asignada al producto.',
      );
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
          <h3 className="text-lg font-semibold text-gray-900">Categoría principal</h3>
          <p className="mt-1 text-sm text-gray-500">
            Elige dónde vive este producto dentro del catálogo. Esto define su ruta principal,
            filtros y navegación.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => openCreateForm('root')}
          >
            Crear categoría
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<FolderPlus className="h-4 w-4" />}
            onClick={() => openCreateForm('child')}
          >
            Crear subcategoría
          </Button>
        </div>
      </div>

      {selectedCategory ? (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700">
            {buildCategoryLabel(selectedCategory, categoriesById)}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-indigo-400 transition-colors hover:text-indigo-700"
              aria-label={`Quitar ${selectedCategory.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Este producto aparecerá en el catálogo general, pero recomendamos asignarle una categoría
          principal.
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar categoría o subcategoría"
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category) => {
            const selected = selectedCategoryId === category.id;
            const depth = getCategoryDepth(category, categoriesById);

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onChange(selected ? null : category.id)}
                className={[
                  'flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors',
                  selected
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
                style={{ paddingLeft: `${12 + depth * 18}px` }}
              >
                <div>
                  <p className="text-sm font-medium">
                    {buildCategoryLabel(category, categoriesById)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {category.parentId ? 'Subcategoría' : 'Categoría principal'}
                  </p>
                </div>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
            No encontramos categorías con ese término.
          </div>
        )}
      </div>

      {showCreateForm ? (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FolderPlus className="h-4 w-4 text-indigo-600" />
            {createMode === 'child' ? 'Nueva subcategoría' : 'Nueva categoría'}
          </div>

          <Input
            id="new-product-category-name"
            label={createMode === 'child' ? 'Nombre de la subcategoría' : 'Nombre de la categoría'}
            placeholder={createMode === 'child' ? 'Ej: Palas de control' : 'Ej: Palas'}
            value={createForm.name}
            onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
          />

          <Select
            id="new-product-category-parent"
            label="Ubicación en el catálogo"
            value={createForm.parentId}
            onChange={(event) => setCreateForm((current) => ({ ...current, parentId: event.target.value }))}
            options={[
              { value: '', label: 'Sin padre (categoría principal)' },
              ...rootCategories.map((category) => ({ value: category.id, label: category.name })),
            ]}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" isLoading={creating} onClick={() => void handleCreateCategory()}>
              Crear y seleccionar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateForm(false);
                setCreateForm(EMPTY_CREATE_FORM);
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
