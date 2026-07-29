import { useEffect, useId, useState } from 'react';
import { AlertTriangle, Loader2, Save, X } from 'lucide-react';
import type { Order, UpdateOrderDetailsPayload } from '@/features/orders/orders.types';
import { normalizeFulfillmentMethod } from '@/lib/orders/fulfillmentLabels';
import { scrollToFirstError } from '@/hooks/useScrollToFirstFormikError';

interface OrderDetailsEditDialogProps {
  order: Order;
  onConfirm: (payload: UpdateOrderDetailsPayload) => Promise<void>;
  onClose: () => void;
}

function optional(value: string): string | null {
  return value.trim() || null;
}

export function OrderDetailsEditDialog({ order, onConfirm, onClose }: OrderDetailsEditDialogProps) {
  const titleId = useId();
  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone);
  const [customerEmail, setCustomerEmail] = useState(order.customerEmail ?? '');
  const [shippingAddress, setShippingAddress] = useState(order.shippingAddress ?? '');
  const [city, setCity] = useState(order.city ?? '');
  const [department, setDepartment] = useState(order.department ?? '');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState(order.deliveryNeighborhood ?? '');
  const [deliveryReference, setDeliveryReference] = useState(order.deliveryReference ?? '');
  const [notes, setNotes] = useState(order.notes ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isPickup = normalizeFulfillmentMethod(order.fulfillmentMethod) === 'pickup';
  const phoneValid = /^3\d{9}$/.test(customerPhone.trim()) || /^573\d{9}$/.test(customerPhone.trim());
  const emailValid = !customerEmail.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());
  const deliveryValid = isPickup || (shippingAddress.trim().length >= 5 && city.trim().length > 0);
  const comparablePhone = customerPhone.trim().replace(/^57(?=3\d{9}$)/, '');
  const changed =
    customerName.trim() !== order.customerName ||
    comparablePhone !== order.customerPhone ||
    optional(customerEmail) !== order.customerEmail ||
    (!isPickup && optional(shippingAddress) !== order.shippingAddress) ||
    (!isPickup && optional(city) !== order.city) ||
    (!isPickup && optional(department) !== order.department) ||
    (!isPickup && optional(deliveryNeighborhood) !== order.deliveryNeighborhood) ||
    (!isPickup && optional(deliveryReference) !== order.deliveryReference) ||
    optional(notes) !== order.notes;
  const canSave = changed && customerName.trim().length > 0 && phoneValid && emailValid && deliveryValid && reason.trim().length >= 5;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  async function submit() {
    if (saving) return;
    setSubmitAttempted(true);
    if (!canSave) {
      const firstInvalidField = !customerName.trim()
        ? 'customerName'
        : !phoneValid
          ? 'customerPhone'
          : !emailValid
            ? 'customerEmail'
            : !isPickup && shippingAddress.trim().length < 5
              ? 'shippingAddress'
              : !isPickup && !city.trim()
                ? 'city'
                : !changed
                  ? 'orderChanges'
                  : 'changeReason';
      scrollToFirstError({ fieldName: firstInvalidField });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: optional(customerEmail),
        shippingAddress: isPickup ? null : optional(shippingAddress),
        city: isPickup ? null : optional(city),
        department: isPickup ? null : optional(department),
        deliveryNeighborhood: isPickup ? null : optional(deliveryNeighborhood),
        deliveryReference: isPickup ? null : optional(deliveryReference),
        notes: optional(notes),
        reason: reason.trim(),
        expectedUpdatedAt: order.updatedAt,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="font-semibold text-gray-900">Editar cliente y entrega</h2>
            <p className="mt-0.5 text-xs text-gray-500">Pedido #{order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {order.status === 'shipped' && (
            <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              El pedido ya fue despachado. Si cambias la dirección, confirma también el cambio con la transportadora.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Nombre del cliente *</span>
              <input id="customerName" name="customerName" aria-invalid={submitAttempted && !customerName.trim()} aria-describedby={submitAttempted && !customerName.trim() ? 'customerName-error' : undefined} className={inputClass} value={customerName} maxLength={120} onChange={e => setCustomerName(e.target.value)} />
              {submitAttempted && !customerName.trim() && <span id="customerName-error" data-error-for="customerName" role="alert" className="text-xs text-red-600">Escribe el nombre del cliente.</span>}
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Celular colombiano *</span>
              <input id="customerPhone" name="customerPhone" className={inputClass} inputMode="numeric" value={customerPhone} maxLength={12} onChange={e => setCustomerPhone(e.target.value.replace(/\s/g, ''))} aria-invalid={(submitAttempted || customerPhone.length > 0) && !phoneValid} aria-describedby={!phoneValid && (submitAttempted || customerPhone.length > 0) ? 'customerPhone-error' : undefined} />
              {!phoneValid && (submitAttempted || customerPhone.length > 0) && <span id="customerPhone-error" data-error-for="customerPhone" role="alert" className="text-xs text-red-600">Usa 10 dígitos, por ejemplo 3001234567.</span>}
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Correo</span>
              <input id="customerEmail" name="customerEmail" className={inputClass} type="email" value={customerEmail} maxLength={320} onChange={e => setCustomerEmail(e.target.value)} aria-invalid={submitAttempted && !emailValid} aria-describedby={submitAttempted && !emailValid ? 'customerEmail-error' : undefined} />
              {submitAttempted && !emailValid && <span id="customerEmail-error" data-error-for="customerEmail" role="alert" className="text-xs text-red-600">Escribe un correo válido o deja el campo vacío.</span>}
            </label>

            {!isPickup && (
              <>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-gray-600">Dirección de entrega *</span>
                  <input id="shippingAddress" name="shippingAddress" className={inputClass} value={shippingAddress} maxLength={250} onChange={e => setShippingAddress(e.target.value)} aria-invalid={submitAttempted && shippingAddress.trim().length < 5} aria-describedby={submitAttempted && shippingAddress.trim().length < 5 ? 'shippingAddress-error' : undefined} />
                  {submitAttempted && shippingAddress.trim().length < 5 && <span id="shippingAddress-error" data-error-for="shippingAddress" role="alert" className="text-xs text-red-600">Escribe una dirección de entrega completa.</span>}
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-gray-600">Ciudad *</span>
                  <input id="city" name="city" className={inputClass} value={city} maxLength={100} onChange={e => setCity(e.target.value)} aria-invalid={submitAttempted && !city.trim()} aria-describedby={submitAttempted && !city.trim() ? 'city-error' : undefined} />
                  {submitAttempted && !city.trim() && <span id="city-error" data-error-for="city" role="alert" className="text-xs text-red-600">Escribe la ciudad de entrega.</span>}
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-gray-600">Departamento</span>
                  <input className={inputClass} value={department} maxLength={100} onChange={e => setDepartment(e.target.value)} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-gray-600">Barrio</span>
                  <input className={inputClass} value={deliveryNeighborhood} maxLength={120} onChange={e => setDeliveryNeighborhood(e.target.value)} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-gray-600">Referencia de entrega</span>
                  <input className={inputClass} value={deliveryReference} maxLength={250} onChange={e => setDeliveryReference(e.target.value)} />
                </label>
              </>
            )}

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Notas del pedido</span>
              <textarea className={`${inputClass} min-h-20 resize-y`} value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Motivo del cambio *</span>
              <input id="changeReason" name="changeReason" className={inputClass} value={reason} maxLength={500} placeholder="Ej. El cliente corrigió el número por teléfono" onChange={e => setReason(e.target.value)} aria-invalid={submitAttempted && reason.trim().length < 5} aria-describedby={submitAttempted && reason.trim().length < 5 ? 'changeReason-error' : undefined} />
              {submitAttempted && reason.trim().length < 5 && <span id="changeReason-error" data-error-for="changeReason" role="alert" className="text-xs text-red-600">Explica el motivo con al menos 5 caracteres.</span>}
              <span className="text-xs text-gray-400">Quedará registrado en el historial del pedido.</span>
            </label>
          </div>

          {!changed && <p data-field-name="orderChanges" data-error-summary={submitAttempted ? 'true' : undefined} tabIndex={-1} role={submitAttempted ? 'alert' : undefined} className={`mt-3 text-xs ${submitAttempted ? 'text-red-600' : 'text-gray-400'}`}>Modifica al menos un dato para guardar.</p>}

          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
