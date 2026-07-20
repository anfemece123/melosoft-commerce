import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import type { PublicStoreCategory } from '@/types/common.types';

interface HomeSectionCategoryPickerProps {
  categories: PublicStoreCategory[];
  selectedCategoryIds: string[];
  onChange: (categoryIds: string[]) => void;
}

/** Multi-select category picker for manual "featured categories" selection —
 * same search/chips pattern as HomeSectionProductPicker, mirroring
 * ProductCategorySelect but multi-select instead of single-select. */
export function HomeSectionCategoryPicker({
  categories,
  selectedCategoryIds,
  onChange,
}: HomeSectionCategoryPickerProps) {
  const [query, setQuery] = useState('');

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(normalized));
  }, [query, categories]);

  const selectedCategories = useMemo(
    () =>
      selectedCategoryIds
        .map((id) => categoriesById.get(id))
        .filter((c): c is PublicStoreCategory => Boolean(c)),
    [selectedCategoryIds, categoriesById]
  );

  function toggle(categoryId: string) {
    if (selectedCategoryIds.includes(categoryId)) {
      onChange(selectedCategoryIds.filter((id) => id !== categoryId));
    } else {
      onChange([...selectedCategoryIds, categoryId]);
    }
  }

  return (
    <div className="space-y-3">
      {selectedCategories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedCategories.map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
            >
              {category.name}
              <button
                type="button"
                onClick={() => toggle(category.id)}
                className="text-gray-400 transition-colors hover:text-gray-700"
                aria-label={`Quitar ${category.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Aún no has seleccionado categorías.
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar categoría"
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filtered.length === 0 && <p className="text-sm text-gray-400">No se encontraron categorías.</p>}
        {filtered.map((category) => {
          const selected = selectedCategoryIds.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => toggle(category.id)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                selected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              {selected ? <Check className="h-3.5 w-3.5" /> : null}
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
