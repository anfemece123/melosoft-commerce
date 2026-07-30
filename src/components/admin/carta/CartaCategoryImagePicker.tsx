import { Check, ImageIcon } from 'lucide-react';
import type { CartaCategoryImagePosition, CartaCategoryImageSize, CartaProductImageMode } from '@/features/carta/carta.types';
import type { Product } from '@/features/products/products.types';
import type { PublicStoreCategory } from '@/types/common.types';

interface CartaCategoryImagePickerProps {
  categories: PublicStoreCategory[];
  products: Product[];
  defaultMode: CartaProductImageMode;
  modes: Record<string, CartaProductImageMode>;
  selections: Record<string, string>;
  positions: Record<string, CartaCategoryImagePosition>;
  sizes: Record<string, CartaCategoryImageSize>;
  onModesChange: (modes: Record<string, CartaProductImageMode>) => void;
  onChange: (selections: Record<string, string>) => void;
  onPositionsChange: (positions: Record<string, CartaCategoryImagePosition>) => void;
  onSizesChange: (sizes: Record<string, CartaCategoryImageSize>) => void;
}

interface ImageOption {
  value: string;
  imageUrl: string;
  label: string;
}

const POSITION_OPTIONS: Array<{ value: CartaCategoryImagePosition; label: string }> = [
  { value: 'above_heading', label: 'Sobre el título' },
  { value: 'below_heading', label: 'Bajo el título' },
  { value: 'beside_left', label: 'Lateral izquierda' },
  { value: 'beside_right', label: 'Lateral derecha' },
];

const SIZE_OPTIONS: Array<{ value: CartaCategoryImageSize; label: string }> = [
  { value: 'small', label: 'Pequeña' },
  { value: 'medium', label: 'Mediana' },
  { value: 'large', label: 'Grande' },
];

const MODE_LABELS: Record<CartaProductImageMode, string> = {
  all: 'Imagen por producto',
  first_per_category: 'Una imagen',
  none: 'Sin imágenes',
};

const MODE_OPTIONS: Array<{ value: 'inherit' | CartaProductImageMode; label: string }> = [
  { value: 'inherit', label: 'Usar general' },
  { value: 'all', label: 'Cada producto' },
  { value: 'first_per_category', label: 'Una imagen' },
  { value: 'none', label: 'Sin imágenes' },
];

export function CartaCategoryImagePicker({
  categories,
  products,
  defaultMode,
  modes,
  selections,
  positions,
  sizes,
  onModesChange,
  onChange,
  onPositionsChange,
  onSizesChange,
}: CartaCategoryImagePickerProps) {
  function changeCategoryMode(categoryId: string, mode: 'inherit' | CartaProductImageMode) {
    const nextModes = { ...modes };
    if (mode === 'inherit') delete nextModes[categoryId];
    else nextModes[categoryId] = mode;
    onModesChange(nextModes);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {categories.map((category) => {
        const productOptions: ImageOption[] = products
          .filter((product) => product.categoryId === category.id && product.showInCarta && product.status === 'active' && product.mainImageUrl)
          .map((product) => ({
            value: `product:${product.id}`,
            imageUrl: product.mainImageUrl!,
            label: product.name,
          }));
        const options: ImageOption[] = [
          ...(category.imageUrl ? [{ value: 'category', imageUrl: category.imageUrl, label: 'Imagen de la categoría' }] : []),
          ...productOptions,
        ];
        const requestedSelection = selections[category.id];
        const selectedValue = options.some((option) => option.value === requestedSelection)
          ? requestedSelection
          : options[0]?.value;
        const selectedLabel = options.find((option) => option.value === selectedValue)?.label;
        const selectedPosition = positions[category.id] ?? 'beside_right';
        const selectedSize = sizes[category.id] ?? 'medium';
        const customMode = modes[category.id] as CartaProductImageMode | undefined;
        const selectedMode = customMode ?? 'inherit';
        const effectiveMode = customMode ?? defaultMode;

        return (
          <div key={category.id} className="border-b border-gray-100 p-3.5 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-gray-800">{category.name}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-gray-500">
                  {selectedMode === 'inherit' ? `Hereda: ${MODE_LABELS[defaultMode]}` : 'Configuración propia de esta categoría'}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-indigo-600">{MODE_LABELS[effectiveMode]}</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {MODE_OPTIONS.map((option) => {
                const selected = option.value === selectedMode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeCategoryMode(category.id, option.value)}
                    className={`rounded-lg border px-2 py-2 text-[10px] font-semibold transition ${selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    aria-label={`${option.label} en ${category.name}`}
                    aria-pressed={selected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {effectiveMode === 'first_per_category' && (options.length === 0 ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-700">
                <ImageIcon className="h-4 w-4 shrink-0" />
                Sube una foto a la categoría o a uno de sus productos para poder elegirla.
              </div>
            ) : (
              <>
                <p className="mt-3 text-[11px] font-medium text-gray-600">{selectedLabel ? `Imagen elegida: ${selectedLabel}` : 'Elige una imagen'}</p>
                <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                  {options.map((option) => {
                    const selected = option.value === selectedValue;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange({ ...selections, [category.id]: option.value })}
                        className={`group relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition ${selected ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-transparent hover:border-gray-300'}`}
                        aria-label={`Usar ${option.label} en ${category.name}`}
                        aria-pressed={selected}
                        title={option.label}
                      >
                        <img src={option.imageUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[9px] font-semibold text-white">{option.label}</span>
                        {selected && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow"><Check className="h-3 w-3" /></span>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Ubicación de la imagen de categoría</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {POSITION_OPTIONS.map((option) => {
                      const selected = option.value === selectedPosition;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onPositionsChange({ ...positions, [category.id]: option.value })}
                          className={`rounded-lg border px-2 py-2 text-[10px] font-semibold transition ${selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                          aria-pressed={selected}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Tamaño adaptable</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SIZE_OPTIONS.map((option) => {
                      const selected = option.value === selectedSize;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onSizesChange({ ...sizes, [category.id]: option.value })}
                          className={`rounded-lg border px-2 py-2 text-[10px] font-semibold transition ${selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                          aria-pressed={selected}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ))}
          </div>
        );
      })}
    </div>
  );
}
