import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import type { Product } from '@/features/products/products.types';

interface HomeSectionProductPickerProps {
  products: Product[];
  selectedProductIds: string[];
  onChange: (productIds: string[]) => void;
}

/** Multi-select product picker for manual "featured products" selection —
 * mirrors ProductCollectionsMultiSelect's search/chips pattern. */
export function HomeSectionProductPicker({
  products,
  selectedProductIds,
  onChange,
}: HomeSectionProductPickerProps) {
  const [query, setQuery] = useState('');

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((p) => p.name.toLowerCase().includes(normalized));
  }, [query, products]);

  const selectedProducts = useMemo(
    () => selectedProductIds.map((id) => productsById.get(id)).filter((p): p is Product => Boolean(p)),
    [selectedProductIds, productsById]
  );

  function toggle(productId: string) {
    if (selectedProductIds.includes(productId)) {
      onChange(selectedProductIds.filter((id) => id !== productId));
    } else {
      onChange([...selectedProductIds, productId]);
    }
  }

  return (
    <div className="space-y-3">
      {selectedProducts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedProducts.map((product) => (
            <span
              key={product.id}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
            >
              {product.name}
              <button
                type="button"
                onClick={() => toggle(product.id)}
                className="text-gray-400 transition-colors hover:text-gray-700"
                aria-label={`Quitar ${product.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Aún no has seleccionado productos.
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar producto"
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-center text-sm text-gray-400">No se encontraron productos.</p>
        )}
        {filtered.map((product) => {
          const selected = selectedProductIds.includes(product.id);
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => toggle(product.id)}
              className={[
                'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                selected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {product.mainImageUrl ? (
                  <img src={product.mainImageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{product.name}</span>
              {selected && <Check className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
