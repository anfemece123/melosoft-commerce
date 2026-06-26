import { useMemo, useState } from 'react';
import { Edit3, Plus } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { notify } from '@/lib/notifications';
import { productCategoriesService } from '@/features/products/productCategoriesService';
import type { StoreProductCategory } from '@/features/products/productCategories.types';

interface ProductCategoryManagerProps {
  storeId: string;
  categories: StoreProductCategory[];
  selectedCategory: string;
  usageCountByCategory: Record<string, number>;
  onSelectCategory: (value: string) => void;
  onCategoriesChange: (categories: StoreProductCategory[]) => void;
  onCategoryRenamed?: (previousName: string, nextName: string) => void;
}

export function ProductCategoryManager({
  storeId,
  categories,
  selectedCategory,
  usageCountByCategory,
  onSelectCategory,
  onCategoriesChange,
  onCategoryRenamed,
}: ProductCategoryManagerProps) {
  const [draftName, setDraftName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const normalizedDraft = draftName.trim().toLowerCase();

  const canCreate = normalizedDraft.length > 0 && !categories.some(
    (category) => category.name.trim().toLowerCase() === normalizedDraft
  );

  const totalVisible = useMemo(
    () => categories.reduce((sum, category) => sum + (usageCountByCategory[category.name] ?? 0), 0),
    [categories, usageCountByCategory]
  );

  async function handleCreate() {
    const name = draftName.trim();
    if (!name || creating) return;

    setCreating(true);
    try {
      const created = await productCategoriesService.createStoreCategory({ storeId, name });
      onCategoriesChange(
        [...categories, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      );
      setDraftName('');
      notify.success('Categoría creada correctamente.');
    } catch (err) {
      notify.fromError(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(categoryId: string) {
    const name = editingName.trim();
    if (!name) return;

    try {
      const updated = await productCategoriesService.renameStoreCategory(categoryId, name);
      onCategoriesChange(
        categories.map((category) => (category.id === categoryId ? updated : category))
      );
      const current = categories.find((category) => category.id === categoryId);
      if (current && current.name === selectedCategory) {
        onSelectCategory(updated.name);
      }
      if (current && current.name !== updated.name) {
        onCategoryRenamed?.(current.name, updated.name);
      }
      setEditingId(null);
      setEditingName('');
      notify.success('Categoría actualizada.');
    } catch (err) {
      notify.fromError(err);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Categorías</h3>
            <p className="text-sm text-gray-500">
              {categories.length} registradas • {totalVisible} {totalVisible === 1 ? 'producto en uso' : 'productos en uso'}
            </p>
          </div>
          <div className="flex w-full gap-2 md:w-auto md:min-w-[340px]">
            <Input
              id="new-category"
              placeholder="Nueva categoría"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => void handleCreate()}
              disabled={!canCreate}
              isLoading={creating}
            >
              Agregar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectCategory('')}
            className={[
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              selectedCategory
                ? 'border-gray-200 text-gray-600 hover:border-gray-300'
                : 'border-indigo-600 bg-indigo-50 text-indigo-700',
            ].join(' ')}
          >
            Todas
          </button>

          {categories.map((category) => {
            const selected = selectedCategory === category.name;
            const usage = usageCountByCategory[category.name] ?? 0;
            const isEditing = editingId === category.id;

            if (isEditing) {
              return (
                <div key={category.id} className="flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1.5">
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className="w-32 bg-transparent text-sm text-indigo-900 outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleRename(category.id)}
                    className="text-xs font-medium text-indigo-700"
                  >
                    Guardar
                  </button>
                </div>
              );
            }

            return (
              <div
                key={category.id}
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  selected
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                <button type="button" onClick={() => onSelectCategory(category.name)}>
                  {category.name}
                  <span className="ml-1 text-xs text-gray-400">{usage}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(category.id);
                    setEditingName(category.name);
                  }}
                  className="text-gray-400 transition-colors hover:text-gray-600"
                  aria-label={`Editar ${category.name}`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
