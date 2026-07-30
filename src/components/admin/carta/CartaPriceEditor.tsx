import { RotateCcw } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';

interface CartaPriceEditorProps {
  productId: string;
  productName: string;
  currency: string;
  ecommercePrice: number;
  cartaPrice: number | null;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onReset: () => void;
}

export function CartaPriceEditor({
  productId,
  productName,
  currency,
  ecommercePrice,
  cartaPrice,
  value,
  onChange,
  onBlur,
  onReset,
}: CartaPriceEditorProps) {
  const inputId = `carta-price-${productId}`;
  const hasIndependentPrice = cartaPrice !== null;

  return (
    <div className="w-full sm:w-48 sm:shrink-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-[11px] font-bold text-gray-700">Precio en carta</label>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-600">Solo carta</span>
      </div>
      <div className="relative">
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-label={`Precio en la carta de ${productName}`}
          className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-12 text-sm font-bold text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-gray-400">{currency}</span>
      </div>
      <div className="mt-1 flex min-h-5 items-start justify-between gap-2">
        <span className="text-[10px] leading-4 text-gray-400">
          {hasIndependentPrice ? 'Independiente del ecommerce' : `Usando ${formatCurrency(ecommercePrice, 'es-CO', currency)}`}
        </span>
        {hasIndependentPrice && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
            title={`Volver al precio del ecommerce: ${formatCurrency(ecommercePrice, 'es-CO', currency)}`}
          >
            <RotateCcw className="h-3 w-3" /> Usar ecommerce
          </button>
        )}
      </div>
    </div>
  );
}
