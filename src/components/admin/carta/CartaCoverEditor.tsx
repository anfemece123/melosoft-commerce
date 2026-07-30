import { Check, Image, X } from 'lucide-react';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import type { CartaCoverLayout } from '@/features/carta/carta.types';
import type { Product } from '@/features/products/products.types';

interface CartaCoverEditorProps {
  products: Product[];
  layout: CartaCoverLayout;
  selectedProductIds: string[];
  customImageUrl: string | null;
  backgroundImageUrl: string | null;
  uploadingCustomImage?: boolean;
  customImageError?: string | null;
  uploadingBackgroundImage?: boolean;
  backgroundImageError?: string | null;
  onLayoutChange: (layout: CartaCoverLayout) => void;
  onSelectedProductIdsChange: (ids: string[]) => void;
  onCustomImageFileSelect: (file: File | null) => void;
  onCustomImageClear: () => void;
  onBackgroundImageFileSelect: (file: File | null) => void;
  onBackgroundImageClear: () => void;
}

export function CartaCoverEditor({
  products,
  layout,
  selectedProductIds,
  customImageUrl,
  backgroundImageUrl,
  uploadingCustomImage = false,
  customImageError,
  uploadingBackgroundImage = false,
  backgroundImageError,
  onLayoutChange,
  onSelectedProductIdsChange,
  onCustomImageFileSelect,
  onCustomImageClear,
  onBackgroundImageFileSelect,
  onBackgroundImageClear,
}: CartaCoverEditorProps) {
  const availableProducts = products.filter((product) => product.showInCarta && product.status === 'active' && product.mainImageUrl);
  const selectedProducts = selectedProductIds
    .map((id) => availableProducts.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));

  function selectLayout(nextLayout: CartaCoverLayout) {
    onLayoutChange(nextLayout);
    if (nextLayout === 'single' && selectedProductIds.length > 1) {
      onSelectedProductIdsChange(selectedProductIds.slice(0, 1));
    }
  }

  function toggleProduct(productId: string) {
    if (selectedProductIds.includes(productId)) {
      onSelectedProductIdsChange(selectedProductIds.filter((id) => id !== productId));
      return;
    }
    if (customImageUrl) onCustomImageClear();
    onSelectedProductIdsChange([productId]);
  }

  const layouts: Array<{ key: CartaCoverLayout; title: string; description: string; icon: typeof Image }> = [
    { key: 'none', title: 'Sin imagen central', description: 'Deja el logo y los textos sobre el fondo que elijas.', icon: X },
    { key: 'single', title: 'Una imagen central', description: 'Sube una foto propia o elige una de tus productos.', icon: Image },
  ];

  return (
    <div className="space-y-5">
      <ImageUploadField
        id="carta-cover-background-upload"
        label="Fondo de la portada"
        assetKind="store_hero_background"
        previewUrl={backgroundImageUrl}
        onFileSelect={onBackgroundImageFileSelect}
        onClear={onBackgroundImageClear}
        uploading={uploadingBackgroundImage}
        error={backgroundImageError ?? undefined}
        aspectClassName="h-24 w-40 rounded-xl"
        hint="Se extiende detrás del logo y los textos. JPG, PNG o WebP; recomendamos 1920×1080 px."
        clearLabel="Quitar fondo"
      />

      <div className="border-t border-gray-100 pt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Imagen central</p>
        <div className="grid gap-2">
          {layouts.map((option) => {
            const Icon = option.icon;
            const selected = option.key === layout;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => selectLayout(option.key)}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${selected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className={`block text-sm font-semibold ${selected ? 'text-indigo-700' : 'text-gray-800'}`}>{option.title}</span><span className="mt-0.5 block text-xs text-gray-500">{option.description}</span></span>
                {selected && <Check className="h-4 w-4 text-indigo-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {layout !== 'none' && (
        <>
          <ImageUploadField
            id="carta-cover-upload"
            label="Subir una imagen propia"
            assetKind="carta_cover"
            previewUrl={customImageUrl}
            onFileSelect={onCustomImageFileSelect}
            onClear={onCustomImageClear}
            uploading={uploadingCustomImage}
            error={customImageError ?? undefined}
            aspectClassName="h-24 w-40 rounded-xl"
            hint="JPG, PNG o WebP. Podrás recortarla antes de subirla; recomendamos una foto horizontal de 1920×1080 px."
            clearLabel="Quitar de la portada"
          />

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Fotos de productos seleccionadas</p>
            {selectedProducts.length === 0 ? (
              !customImageUrl && <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">Sube una imagen propia o selecciona abajo una fotografía existente.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {selectedProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">{index + 1}</span>
                    <img src={product.mainImageUrl!} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-700">{product.name}</span>
                    <button type="button" onClick={() => toggleProduct(product.id)} aria-label={`Quitar ${product.name}`} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Fotos de tus productos</p>
            <p className="mt-1 text-xs text-gray-400">{customImageUrl ? 'Si eliges una, reemplazará la imagen que subiste.' : 'Elige una fotografía o sube una propia.'}</p>
            {availableProducts.length === 0 ? (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-700">No encontramos productos visibles con fotografía.</p>
            ) : (
              <div className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1">
                {availableProducts.map((product) => {
                  const selectionIndex = selectedProductIds.indexOf(product.id);
                  const selected = selectionIndex >= 0;
                  return (
                    <button key={product.id} type="button" onClick={() => toggleProduct(product.id)} className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition ${selected ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-transparent hover:border-gray-300'}`} title={product.name}>
                      <img src={product.mainImageUrl!} alt={product.name} className="h-full w-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] font-semibold text-white">{product.name}</span>
                      {selected && <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white shadow">{selectionIndex + 1}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
