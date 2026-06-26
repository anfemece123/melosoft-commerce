import { useEffect, useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { notify } from '@/lib/notifications';
import { productCategoriesService } from '@/features/products/productCategoriesService';
import type { StoreProductCategory } from '@/features/products/productCategories.types';

interface ProductCategoryFieldProps {
  storeId: string;
  value: string;
  label?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function ProductCategoryField({
  storeId,
  value,
  label = 'Categoría',
  placeholder = 'Escribe o elige una categoría',
  onChange,
}: ProductCategoryFieldProps) {
  const [categories, setCategories] = useState<StoreProductCategory[]>([]);
  const [query, setQuery] = useState(value);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await productCategoriesService.getStoreCategories(storeId);
        if (mounted) setCategories(data);
      } catch (err) {
        notify.fromError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [storeId]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(normalizedQuery));
  }, [categories, normalizedQuery]);

  const alreadyExists = categories.some((category) => category.name.trim().toLowerCase() === normalizedQuery);

  async function handleCreateCategory() {
    const name = query.trim();
    if (!name || creating) return;

    setCreating(true);
    try {
      const created = await productCategoriesService.createStoreCategory({ storeId, name });
      setCategories((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      onChange(created.name);
      setQuery(created.name);
      notify.success('Categoría creada correctamente.');
    } catch (err) {
      notify.fromError(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input
        id="category"
        label={label}
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          onChange(nextValue);
        }}
        hint="Puedes escribir una nueva o elegir una existente."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setQuery('');
            onChange('');
          }}
          className={[
            'rounded-full border px-3 py-1.5 text-sm transition-colors',
            value
              ? 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
              : 'border-indigo-600 bg-indigo-50 text-indigo-700',
          ].join(' ')}
        >
          Sin categoría
        </button>

        {filteredCategories.map((category) => {
          const selected = value.trim().toLowerCase() === category.name.trim().toLowerCase();
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                onChange(category.name);
                setQuery(category.name);
              }}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                selected
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              {selected ? <Check className="h-3.5 w-3.5" /> : null}
              {category.name}
            </button>
          );
        })}

        {!loading && normalizedQuery && !alreadyExists ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={creating}
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => void handleCreateCategory()}
            className="rounded-full"
          >
            Crear "{query.trim()}"
          </Button>
        ) : null}
      </div>
    </div>
  );
}
