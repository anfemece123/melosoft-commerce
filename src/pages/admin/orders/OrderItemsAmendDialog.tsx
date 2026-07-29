import { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Minus, Plus, Save, Trash2, X } from 'lucide-react';
import type { AmendOrderItemsPayload, Order } from '@/features/orders/orders.types';
import { formatCurrency } from '@/utils/formatCurrency';
import { scrollToFirstError } from '@/hooks/useScrollToFirstFormikError';

interface OrderItemsAmendDialogProps {
  order: Order;
  onConfirm: (payload: AmendOrderItemsPayload) => Promise<void>;
  onClose: () => void;
}

export function OrderItemsAmendDialog({ order, onConfirm, onClose }: OrderItemsAmendDialogProps) {
  const titleId = useId();
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries((order.items ?? []).map(item => [item.id, item.quantity])),
  );
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const retained = (order.items ?? []).filter(item => (quantities[item.id] ?? 0) > 0);
  const productSubtotal = useMemo(
    () => retained.reduce((sum, item) => sum + item.unitPrice * quantities[item.id], 0),
    [quantities, retained],
  );
  const changed = (order.items ?? []).some(item => (quantities[item.id] ?? 0) !== item.quantity);
  const canSave = changed && retained.length > 0 && reason.trim().length >= 5;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  function setQuantity(id: string, value: number) {
    const normalized = Number.isFinite(value) ? Math.trunc(value) : 0;
    setQuantities(current => ({ ...current, [id]: Math.max(0, Math.min(999, normalized)) }));
  }

  async function submit() {
    if (saving) return;
    setSubmitAttempted(true);
    if (!canSave) {
      scrollToFirstError({
        fieldName: retained.length === 0 || !changed ? 'orderItems' : 'itemChangeReason',
      });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        items: retained.map(item => ({ orderItemId: item.id, quantity: quantities[item.id] })),
        reason: reason.trim(),
        expectedUpdatedAt: order.updatedAt,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo modificar el pedido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="font-semibold text-gray-900">Modificar productos</h2>
            <p className="mt-0.5 text-xs text-gray-500">Solo antes de preparar el pedido y sin un pago en línea cerrado.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Al guardar se recalculan el subtotal, el domicilio y el inventario en una sola operación. Los precios originales del pedido se conservan.
          </div>

          <div data-field-name="orderItems" tabIndex={-1} aria-invalid={submitAttempted && (retained.length === 0 || !changed)} className="overflow-hidden rounded-xl border border-gray-200">
            {(order.items ?? []).map((item, index) => {
              const quantity = quantities[item.id] ?? 0;
              const removed = quantity === 0;
              return (
                <div key={item.id} className={`flex items-center gap-3 px-3 py-3 ${index > 0 ? 'border-t border-gray-100' : ''} ${removed ? 'bg-gray-50 opacity-60' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${removed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.productNameSnapshot ?? item.name}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{formatCurrency(item.unitPrice, 'es-CO', order.currency)} c/u{item.variantLabelSnapshot ? ` · ${item.variantLabelSnapshot}` : ''}</p>
                  </div>
                  {!removed ? (
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label="Restar uno" onClick={() => setQuantity(item.id, quantity - 1)} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"><Minus className="h-3.5 w-3.5" /></button>
                      <input aria-label={`Cantidad de ${item.name}`} inputMode="numeric" value={quantity} onChange={e => setQuantity(item.id, Number(e.target.value) || 0)} className="w-12 rounded-md border border-gray-200 px-1 py-1.5 text-center text-sm font-semibold outline-none focus:border-indigo-400" />
                      <button type="button" aria-label="Sumar uno" onClick={() => setQuantity(item.id, quantity + 1)} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"><Plus className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Retirar producto" title="Retirar producto" onClick={() => setQuantity(item.id, 0)} className="ml-1 rounded-md p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setQuantity(item.id, item.quantity)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Restaurar</button>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-3">
              <span className="text-sm text-gray-500">Nuevo subtotal de productos</span>
              <strong className="text-sm text-gray-900">{formatCurrency(productSubtotal, 'es-CO', order.currency)}</strong>
            </div>
          </div>

          {retained.length === 0 && <p data-error-for="orderItems" role="alert" className="mt-2 text-xs text-red-600">El pedido debe conservar al menos un producto. Para eliminarlo completo, cancela el pedido.</p>}
          {submitAttempted && !changed && <p data-error-for="orderItems" role="alert" className="mt-2 text-xs text-red-600">Modifica al menos una cantidad para guardar.</p>}

          <label className="mt-4 block space-y-1.5">
            <span className="text-xs font-medium text-gray-600">Motivo del cambio *</span>
            <input id="itemChangeReason" name="itemChangeReason" value={reason} maxLength={500} placeholder="Ej. El cliente solicitó reducir la cantidad" onChange={e => setReason(e.target.value)} aria-invalid={submitAttempted && reason.trim().length < 5} aria-describedby={submitAttempted && reason.trim().length < 5 ? 'itemChangeReason-error' : undefined} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            {submitAttempted && reason.trim().length < 5 && <span id="itemChangeReason-error" data-error-for="itemChangeReason" role="alert" className="text-xs text-red-600">Explica el motivo con al menos 5 caracteres.</span>}
            <span className="text-xs text-gray-400">La modificación quedará registrada con tu usuario.</span>
          </label>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar modificación
          </button>
        </div>
      </div>
    </div>
  );
}
