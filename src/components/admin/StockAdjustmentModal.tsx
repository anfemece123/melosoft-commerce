import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { IntegerInput } from '@/components/forms/IntegerInput';
import { inventoryService } from '@/features/products/inventoryService';
import type { InventoryMovement, MovementType } from '@/features/products/inventory.types';
import { notify } from '@/lib/notifications';

type Direction = 'add' | 'remove';

interface DirectionOption {
  label: string;
  movementType: MovementType;
}

const ADD_OPTIONS: DirectionOption[] = [
  { label: 'Ingreso de inventario', movementType: 'stock_in' },
  { label: 'Devolución de cliente', movementType: 'returned' },
  { label: 'Corrección de inventario', movementType: 'correction' },
  { label: 'Ajuste manual', movementType: 'manual_adjustment' },
];

const REMOVE_OPTIONS: DirectionOption[] = [
  { label: 'Venta fuera de la plataforma', movementType: 'stock_out' },
  { label: 'Producto dañado', movementType: 'damaged' },
  { label: 'Producto perdido', movementType: 'lost' },
  { label: 'Corrección de inventario', movementType: 'correction' },
  { label: 'Ajuste manual', movementType: 'manual_adjustment' },
];

function formatMovementDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  );
}

interface StockAdjustmentModalProps {
  open: boolean;
  storeId: string;
  productId: string;
  productName: string;
  currentStock: number;
  onClose: () => void;
  onStockUpdated: (productId: string, newStock: number) => void;
  /** When set, adjusts this variant's stock (adjust_variant_stock RPC)
   * instead of the parent product's — used from ProductVariantsEditor. */
  variantId?: string;
  /** Restaurant menus speak in available portions/units instead of retail
   * inventory jargon. The underlying audited stock movement is identical. */
  restaurantMode?: boolean;
}

export function StockAdjustmentModal({
  open,
  storeId,
  productId,
  productName,
  currentStock,
  onClose,
  onStockUpdated,
  variantId,
  restaurantMode = false,
}: StockAdjustmentModalProps) {
  const [direction, setDirection] = useState<Direction>('add');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quantityError, setQuantityError] = useState('');
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirection('add');
    setQuantity('');
    setSelectedIndex(0);
    setNotes('');
    setQuantityError('');
    setLoadingHistory(true);
    const fetchMovements = variantId
      ? inventoryService.getVariantMovements(variantId)
      : inventoryService.getProductMovements(productId);
    fetchMovements
      .then(setMovements)
      .catch(() => setMovements([]))
      .finally(() => setLoadingHistory(false));
  }, [open, productId, variantId]);

  useEffect(() => {
    setSelectedIndex(0);
    setQuantityError('');
  }, [direction]);

  if (!open) return null;

  const options = direction === 'add' ? ADD_OPTIONS : REMOVE_OPTIONS;
  const selectedOption = options[selectedIndex];
  const qty = typeof quantity === 'number' ? quantity : 0;
  const projectedStock = direction === 'add' ? currentStock + qty : currentStock - qty;

  async function handleSubmit() {
    setQuantityError('');
    if (!quantity || qty <= 0) {
      setQuantityError('Ingresa una cantidad válida mayor a 0.');
      return;
    }
    if (direction === 'remove' && qty > currentStock) {
      setQuantityError(
        restaurantMode
          ? `Cantidad insuficiente. Disponible: ${currentStock}.`
          : `Stock insuficiente. Disponible: ${currentStock}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const quantityChange = direction === 'add' ? qty : -qty;
      const result = variantId
        ? await inventoryService.adjustVariantStock({
            storeId,
            variantId,
            movementType: selectedOption.movementType,
            quantityChange,
            reason: selectedOption.label,
            notes: notes.trim() || null,
          })
        : await inventoryService.adjustStock({
            storeId,
            productId,
            movementType: selectedOption.movementType,
            quantityChange,
            reason: selectedOption.label,
            notes: notes.trim() || null,
          });
      onStockUpdated(productId, result.newStock);
      notify.success(
        direction === 'add'
          ? `${qty} unidades agregadas. ${restaurantMode ? 'Disponibles' : 'Stock actual'}: ${result.newStock}.`
          : `${qty} unidades quitadas. ${restaurantMode ? 'Disponibles' : 'Stock actual'}: ${result.newStock}.`
      );
      onClose();
    } catch (err) {
      notify.fromError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500 shrink-0" />
              <h2 className="font-semibold text-gray-900">
                {restaurantMode ? 'Ajustar unidades disponibles' : 'Ajustar stock'}
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Stock display */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">
                {restaurantMode ? 'Disponibles ahora' : 'Stock actual'}
              </p>
              <p className="text-2xl font-bold text-gray-900">{currentStock}</p>
              <p className="text-xs text-gray-400">unidades</p>
            </div>
            {qty > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5">Resultado</p>
                <p
                  className={`text-2xl font-bold ${
                    projectedStock < 0 ? 'text-red-600' : 'text-indigo-600'
                  }`}
                >
                  {projectedStock}
                </p>
                <p className="text-xs text-gray-400">unidades</p>
              </div>
            )}
          </div>

          {/* Direction toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection('add')}
              className={[
                'flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors',
                direction === 'add'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              <TrendingUp className="w-4 h-4" />
              Agregar
            </button>
            <button
              type="button"
              onClick={() => setDirection('remove')}
              className={[
                'flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors',
                direction === 'remove'
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              <TrendingDown className="w-4 h-4" />
              Quitar
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <IntegerInput
              id="stock-qty"
              label={`Cantidad a ${direction === 'add' ? 'agregar' : 'quitar'} *`}
              min={1}
              placeholder="0"
              value={quantity}
              onChange={(value) => {
                setQuantityError('');
                setQuantity(value);
              }}
              error={quantityError}
            />

            <Select
              id="stock-reason"
              label="Motivo *"
              value={String(selectedIndex)}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              options={options.map((opt, idx) => ({
                value: String(idx),
                label: opt.label,
              }))}
            />

            <div className="space-y-1">
              <label
                htmlFor="stock-notes"
                className="block text-sm font-medium text-gray-700"
              >
                Nota{' '}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                id="stock-notes"
                rows={2}
                placeholder="Observación adicional..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Movement history */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Historial reciente
            </p>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : movements.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">
                Sin movimientos registrados
              </p>
            ) : (
              <div className="space-y-3">
                {movements.map((mv) => (
                  <div key={mv.id} className="flex items-start gap-3">
                    <span
                      className={[
                        'shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                        mv.quantityChange > 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700',
                      ].join(' ')}
                    >
                      {mv.quantityChange > 0 ? '+' : '−'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium truncate">
                        {mv.reason}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatMovementDate(mv.createdAt)}
                        {mv.notes && ` · ${mv.notes}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-semibold ${
                          mv.quantityChange > 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {mv.quantityChange > 0
                          ? `+${mv.quantityChange}`
                          : mv.quantityChange}
                      </p>
                      <p className="text-xs text-gray-400">→ {mv.stockAfter}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 flex gap-3 justify-end">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={direction === 'remove' ? 'danger' : 'primary'}
            isLoading={submitting}
            onClick={() => void handleSubmit()}
          >
            {direction === 'add'
              ? (restaurantMode ? 'Agregar unidades' : 'Agregar stock')
              : (restaurantMode ? 'Quitar unidades' : 'Quitar stock')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
