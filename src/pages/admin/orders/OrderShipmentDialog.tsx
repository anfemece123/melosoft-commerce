import { useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, Loader2, PackageCheck, Truck, X } from 'lucide-react';
import type { DispatchOrderPayload, Order } from '@/features/orders/orders.types';
import { normalizeFulfillmentMethod } from '@/lib/orders/fulfillment';
import { scrollToFirstError } from '@/hooks/useScrollToFirstFormikError';

const CARRIERS = [
  'Coordinadora',
  'Servientrega',
  'Inter Rapidísimo',
  'Envía',
  'TCC',
  'Deprisa',
  'DHL',
  'FedEx',
  'UPS',
];

interface OrderShipmentDialogProps {
  order: Order;
  onConfirm: (payload: DispatchOrderPayload) => Promise<void>;
  onClose: () => void;
}

function isValidTrackingUrl(value: string): boolean {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function OrderShipmentDialog({ order, onConfirm, onClose }: OrderShipmentDialogProps) {
  const method = normalizeFulfillmentMethod(order.fulfillmentMethod);
  const isPickup = method === 'pickup';
  const isNational = method === 'national_shipping';
  const [shippingCarrier, setShippingCarrier] = useState(order.shippingCarrier ?? '');
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? '');
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl ?? '');
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState(order.estimatedDeliveryAt ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const trackingUrlError = useMemo(() => {
    const value = trackingUrl.trim();
    if (!value) return null;
    if (value.length > 500) return 'El enlace de rastreo es demasiado largo.';
    if (!isValidTrackingUrl(value)) return 'El enlace de rastreo debe comenzar con http:// o https://.';
    return null;
  }, [trackingUrl]);

  const validationError = useMemo(() => {
    if (isNational && !shippingCarrier.trim()) return 'Selecciona o escribe la transportadora.';
    if (isNational && !trackingNumber.trim()) return 'Ingresa el número de guía del envío.';
    if (trackingUrlError) return trackingUrlError;
    return null;
  }, [isNational, shippingCarrier, trackingNumber, trackingUrlError]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitAttempted(true);
    if (validationError) {
      setError(null);
      const firstInvalidField = isNational && !shippingCarrier.trim()
        ? 'shippingCarrier'
        : isNational && !trackingNumber.trim()
          ? 'trackingNumber'
          : 'trackingUrl';
      scrollToFirstError({ fieldName: firstInvalidField });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        shippingCarrier: isPickup ? null : shippingCarrier.trim() || null,
        trackingNumber: isPickup ? null : trackingNumber.trim() || null,
        trackingUrl: isPickup ? null : trackingUrl.trim() || null,
        estimatedDeliveryAt: isPickup ? null : estimatedDeliveryAt || null,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar el envío.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="shipment-dialog-title"
        onSubmit={handleSubmit}
        noValidate
        onClick={event => event.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
              {isPickup ? <PackageCheck className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="shipment-dialog-title" className="text-lg font-bold text-gray-900">
                {isPickup ? 'Pedido listo para recoger' : isNational ? 'Despachar pedido' : 'Iniciar entrega'}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Pedido #{order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {isPickup ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
              Al confirmar, el cliente recibirá un correo indicando que su pedido está listo para recoger. No se solicitará información de transportadora.
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium text-gray-700">
                  Transportadora {isNational
                    ? <span className="text-red-500">*</span>
                    : <span className="font-normal text-gray-400">(opcional)</span>}
                  <input
                    id="shippingCarrier"
                    name="shippingCarrier"
                    list="shipment-carriers"
                    value={shippingCarrier}
                    onChange={event => setShippingCarrier(event.target.value)}
                    maxLength={120}
                    placeholder={isNational ? 'Ej. Servientrega' : 'Ej. Mensajero propio'}
                    aria-invalid={submitAttempted && isNational && !shippingCarrier.trim()}
                    aria-describedby={submitAttempted && isNational && !shippingCarrier.trim() ? 'shippingCarrier-error' : undefined}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  {submitAttempted && isNational && !shippingCarrier.trim() && <span id="shippingCarrier-error" data-error-for="shippingCarrier" role="alert" className="block text-xs font-normal text-red-600">Selecciona o escribe la transportadora.</span>}
                  <datalist id="shipment-carriers">
                    {CARRIERS.map(carrier => <option key={carrier} value={carrier} />)}
                  </datalist>
                </label>
                <label className="space-y-1.5 text-sm font-medium text-gray-700">
                  Número de guía {isNational
                    ? <span className="text-red-500">*</span>
                    : <span className="font-normal text-gray-400">(opcional)</span>}
                  <input
                    id="trackingNumber"
                    name="trackingNumber"
                    value={trackingNumber}
                    onChange={event => setTrackingNumber(event.target.value)}
                    maxLength={160}
                    autoComplete="off"
                    placeholder="Ej. 1234567890"
                    aria-invalid={submitAttempted && isNational && !trackingNumber.trim()}
                    aria-describedby={submitAttempted && isNational && !trackingNumber.trim() ? 'trackingNumber-error' : undefined}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  {submitAttempted && isNational && !trackingNumber.trim() && <span id="trackingNumber-error" data-error-for="trackingNumber" role="alert" className="block text-xs font-normal text-red-600">Ingresa el número de guía del envío.</span>}
                </label>
              </div>

              <label className="block space-y-1.5 text-sm font-medium text-gray-700">
                Enlace de rastreo <span className="font-normal text-gray-400">(opcional)</span>
                <div className="relative">
                  <ExternalLink className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="trackingUrl"
                    name="trackingUrl"
                    type="url"
                    value={trackingUrl}
                    onChange={event => setTrackingUrl(event.target.value)}
                    maxLength={500}
                    placeholder="https://transportadora.com/rastrear/..."
                    aria-invalid={submitAttempted && Boolean(trackingUrlError)}
                    aria-describedby={submitAttempted && trackingUrlError ? 'trackingUrl-error' : undefined}
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                {submitAttempted && trackingUrlError && <span id="trackingUrl-error" data-error-for="trackingUrl" role="alert" className="block text-xs font-normal text-red-600">{trackingUrlError}</span>}
                <span className="block text-xs font-normal leading-5 text-gray-400">
                  Se incluirá en WhatsApp y como botón directo en el correo del cliente.
                </span>
              </label>

              <label className="block space-y-1.5 text-sm font-medium text-gray-700">
                Fecha estimada de entrega <span className="font-normal text-gray-400">(opcional)</span>
                <div className="relative max-w-xs">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={estimatedDeliveryAt}
                    onChange={event => setEstimatedDeliveryAt(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </label>

              <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-800">
                {isNational
                  ? 'El cliente recibirá la transportadora y la guía por WhatsApp y correo. La fecha estimada y el enlace se incluirán únicamente si los registras.'
                  : 'Puedes registrar transportadora, guía, fecha estimada o enlace para esta entrega local. Solo se comunicarán los datos que completes.'}
              </div>
            </>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPickup ? 'Marcar listo' : isNational ? 'Despachar y notificar' : 'Iniciar entrega'}
          </button>
        </div>
      </form>
    </div>
  );
}
