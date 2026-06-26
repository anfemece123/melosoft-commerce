import { useEffect, useState } from 'react';
import { useFormik, type FormikProps } from 'formik';
import {
  Trash2, Plus, Minus, ShoppingBag, X, ArrowLeft,
  CheckCircle, Home, StoreIcon, ChevronRight, Loader2, MapPin, AlertTriangle,
} from 'lucide-react';
import { useCart } from '@/lib/cart/cartContext';
import { formatCurrency } from '@/utils/formatCurrency';
import { ordersService } from '@/features/orders/ordersService';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { useLocationChangeWithCheck } from '@/lib/locations/useLocationChangeWithCheck';
import { LocationConflictModal } from '@/components/public/locations/LocationConflictModal';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';
import { notify } from '@/lib/notifications';
import { checkoutSchema, type CheckoutFormValues } from '@/schemas/order.schema';
import type { StorefrontTheme } from '../storefront/storefrontTheme';
import type { WebOrderResult } from '@/features/orders/orders.types';
import type { PublicStoreLocation } from '@/features/locations/locations.types';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  theme: StorefrontTheme;
  storeName: string;
  storeSlug: string;
  whatsappNumber: string | null;
  allowsPickup: boolean | null;
  allowsLocalDelivery: boolean | null;
}

type DrawerStep = 'cart' | 'form' | 'submitting' | 'confirmed';

interface CheckoutFieldProps {
  formik: FormikProps<CheckoutFormValues>;
  theme: StorefrontTheme;
  name: keyof CheckoutFormValues;
  label: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
}

function CheckoutField({ formik, theme, name, label, required, placeholder, type = 'text' }: CheckoutFieldProps) {
  const touched = formik.touched[name];
  const error = formik.errors[name];
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: theme.mutedText }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={formik.values[name] as string}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        placeholder={placeholder}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2"
        style={{
          backgroundColor: theme.surface,
          color: theme.text,
          borderColor: touched && error ? '#ef4444' : theme.border,
        }}
      />
      {touched && error && (
        <p className="text-xs text-red-500">{error as string}</p>
      )}
    </div>
  );
}

function resolveDefaultFulfillment(
  allowsPickup: boolean | null,
  allowsLocalDelivery: boolean | null
): 'delivery' | 'pickup' {
  if (allowsPickup === true && allowsLocalDelivery !== true) return 'pickup';
  return 'delivery';
}

function showFulfillmentChoice(
  allowsPickup: boolean | null,
  allowsLocalDelivery: boolean | null
): boolean {
  return allowsPickup === true && allowsLocalDelivery !== false;
}

// Returns unique {city, department} pairs from active locations
function getUniqueCities(locations: PublicStoreLocation[]): { city: string; department: string | null }[] {
  const seen = new Set<string>();
  const result: { city: string; department: string | null }[] = [];
  for (const loc of locations) {
    if (!loc.city) continue;
    if (!seen.has(loc.city)) {
      seen.add(loc.city);
      result.push({ city: loc.city, department: loc.department });
    }
  }
  return result;
}

export function CartDrawer({
  open,
  onClose,
  theme,
  storeName,
  storeSlug,
  whatsappNumber,
  allowsPickup,
  allowsLocalDelivery,
}: CartDrawerProps) {
  const { items, totalItems, totalPrice, updateQuantity, removeItem, clearCart } = useCart();
  const { locations, selectedLocation } = useSelectedLocation();
  const { requestLocationChange, confirmLocationChange, cancelLocationChange, pendingChange, checking: checkingLocation } =
    useLocationChangeWithCheck();
  const [step, setStep] = useState<DrawerStep>('cart');
  const [orderResult, setOrderResult] = useState<WebOrderResult | null>(null);
  const [cartUnavailableIds, setCartUnavailableIds] = useState<Set<string>>(new Set());

  // Derived location data
  const uniqueCities = getUniqueCities(locations);
  const hasMultipleCities = uniqueCities.length > 1;
  const hasMultipleLocations = locations.length > 1;
  const locationsForSelectedCity = hasMultipleCities
    ? locations.filter(l => l.city === selectedLocation?.city)
    : locations;

  const storeId = selectedLocation?.storeId ?? locations[0]?.storeId ?? null;
  const cartProductIds = items.map(i => i.productId).sort().join(',');

  useEffect(() => {
    if (!open) {
      setStep('cart');
      setOrderResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !storeId || !selectedLocation || items.length === 0) {
      setCartUnavailableIds(new Set());
      return;
    }
    let cancelled = false;
    productAvailabilityService
      .getAvailabilityForLocation(storeId, items.map(i => i.productId), selectedLocation.locationId)
      .then(avail => {
        if (cancelled) return;
        setCartUnavailableIds(
          new Set(Object.entries(avail).filter(([, v]) => v === false).map(([k]) => k)),
        );
      })
      .catch(() => { if (!cancelled) setCartUnavailableIds(new Set()); });
    return () => { cancelled = true; };
  }, [open, storeId, selectedLocation?.locationId, cartProductIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultFulfillment = resolveDefaultFulfillment(allowsPickup, allowsLocalDelivery);
  const hasFulfillmentChoice = showFulfillmentChoice(allowsPickup, allowsLocalDelivery);

  const formik = useFormik<CheckoutFormValues>({
    initialValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      fulfillmentMethod: defaultFulfillment,
      shippingAddress: '',
      deliveryNeighborhood: '',
      deliveryReference: '',
      notes: '',
    },
    validationSchema: checkoutSchema,
    enableReinitialize: false,
    onSubmit: async (values) => {
      if (!selectedLocation) {
        notify.error('Selecciona una sede para continuar.');
        return;
      }
      setStep('submitting');
      try {
        const result = await ordersService.createWebOrder({
          storeSlug,
          customerName: values.customerName.trim(),
          customerPhone: values.customerPhone.trim(),
          customerEmail: values.customerEmail.trim() || null,
          fulfillmentMethod: values.fulfillmentMethod,
          shippingAddress: values.fulfillmentMethod === 'delivery' ? (values.shippingAddress.trim() || null) : null,
          city: selectedLocation.city,
          department: selectedLocation.department,
          deliveryNeighborhood: values.deliveryNeighborhood.trim() || null,
          deliveryReference: values.deliveryReference.trim() || null,
          notes: values.notes.trim() || null,
          storeLocationId: selectedLocation.locationId,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            customizationNotes: item.customizationNotes,
          })),
        });
        setOrderResult(result);
        clearCart();
        setStep('confirmed');
      } catch (err) {
        setStep('form');
        notify.error(err instanceof Error ? err.message : 'Error al confirmar el pedido');
      }
    },
  });

  function handleCityChange(city: string) {
    const loc = locations.find(l => l.city === city);
    if (loc) void requestLocationChange(loc);
  }

  function handleSendWhatsApp() {
    if (!whatsappNumber || !orderResult) return;
    const phone = whatsappNumber.replace(/\D/g, '');
    const lines: string[] = [
      `Hola ${storeName}, acabo de confirmar el pedido ${orderResult.orderNumber}.`,
      `Total: ${formatCurrency(orderResult.totalAmount, 'es-CO', 'COP')}`,
      'Pago: Contraentrega',
    ];
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={step === 'submitting' ? undefined : onClose} />
      {pendingChange && (
        <LocationConflictModal
          theme={theme}
          targetLocation={pendingChange.location}
          result={pendingChange.result}
          onCancel={cancelLocationChange}
          onConfirm={confirmLocationChange}
        />
      )}
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col shadow-2xl"
        style={{ backgroundColor: theme.background, color: theme.text }}
      >
        {/* ── STEP: cart ── */}
        {step === 'cart' && (
          <>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: theme.border }}>
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" style={{ color: theme.primary }} />
                <h2 className="font-semibold">Tu pedido ({totalItems})</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingBag className="mx-auto h-12 w-12 opacity-15" />
                  <p className="mt-3 text-sm opacity-40">Tu pedido está vacío</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex gap-3 rounded-2xl border p-3"
                    style={{ borderColor: theme.border, backgroundColor: theme.surface }}
                  >
                    <div
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-xl"
                      style={{ backgroundColor: `${theme.primary}15` }}
                    >
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ShoppingBag className="h-5 w-5 opacity-30" style={{ color: theme.primary }} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{item.productName}</p>
                      <p className="text-sm font-semibold" style={{ color: theme.primary }}>
                        {formatCurrency(item.unitPrice, 'es-CO', 'COP')}
                      </p>
                      {item.customizationNotes && (
                        <p className="mt-0.5 text-xs opacity-50 line-clamp-1">{item.customizationNotes}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border hover:opacity-70 transition-opacity"
                            style={{ borderColor: theme.border }}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border hover:opacity-70 transition-opacity"
                            style={{ borderColor: theme.border }}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="p-1 hover:opacity-70 transition-opacity"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t px-5 py-5 space-y-3" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
                {cartUnavailableIds.size > 0 && (
                  <div
                    className="rounded-xl border px-3 py-3 space-y-2"
                    style={{ borderColor: '#f59e0b', backgroundColor: '#f59e0b1a' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      <p className="text-xs font-semibold text-amber-700">
                        No disponibles en esta sede:
                      </p>
                    </div>
                    <ul className="space-y-1">
                      {items.filter(i => cartUnavailableIds.has(i.productId)).map(i => (
                        <li key={i.productId} className="flex items-center gap-1.5 text-xs text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          {i.productName}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => { for (const id of cartUnavailableIds) removeItem(id); }}
                      className="w-full rounded-xl border border-amber-300 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      Quitar productos no disponibles
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-60">Total del pedido</span>
                  <span className="text-xl font-bold" style={{ color: theme.primary }}>
                    {formatCurrency(totalPrice, 'es-CO', 'COP')}
                  </span>
                </div>
                <div
                  className="flex items-center justify-center rounded-xl py-2 text-xs font-medium"
                  style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}
                >
                  Pago contraentrega
                </div>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  disabled={cartUnavailableIds.size > 0}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: theme.primary }}
                >
                  Continuar con el pedido
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── STEP: form ── */}
        {(step === 'form' || step === 'submitting') && (
          <>
            <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: theme.border }}>
              {step === 'form' && (
                <button type="button" onClick={() => setStep('cart')} className="rounded-lg p-1 hover:opacity-70">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <h2 className="font-semibold flex-1">Datos del pedido</h2>
              {step === 'form' && (
                <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:opacity-70">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* ── Sede de atención ── */}
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
                  Sede de atención
                </p>

                {/* Case 3: multiple cities → city selector */}
                {hasMultipleCities && (
                  <div className="space-y-1">
                    <label className="block text-xs" style={{ color: theme.mutedText }}>
                      Ciudad
                    </label>
                    <select
                      value={selectedLocation?.city ?? ''}
                      onChange={e => handleCityChange(e.target.value)}
                      disabled={step === 'submitting' || checkingLocation}
                      className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none appearance-none disabled:opacity-60"
                      style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                    >
                      {uniqueCities.map(c => (
                        <option key={c.city} value={c.city}>{c.city}</option>
                      ))}
                    </select>
                    <p className="text-xs opacity-50" style={{ color: theme.mutedText }}>
                      Esta tienda solo atiende en las ciudades donde tiene sucursales activas.
                    </p>
                  </div>
                )}

                {/* Cases 2 & 3: multiple locations → location selector */}
                {hasMultipleLocations && (
                  <div className="space-y-1">
                    <label className="block text-xs" style={{ color: theme.mutedText }}>
                      Sede
                    </label>
                    <select
                      value={selectedLocation?.locationId ?? ''}
                      onChange={e => {
                        const loc = locationsForSelectedCity.find(l => l.locationId === e.target.value);
                        if (loc) void requestLocationChange(loc);
                      }}
                      disabled={step === 'submitting' || checkingLocation}
                      className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none appearance-none disabled:opacity-60"
                      style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                    >
                      {locationsForSelectedCity.map(loc => (
                        <option key={loc.locationId} value={loc.locationId}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Location badge: always shown */}
                {selectedLocation ? (
                  <div
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: `${theme.primary}10` }}
                  >
                    <MapPin className="w-4 h-4 shrink-0" style={{ color: theme.primary }} />
                    <div className="min-w-0">
                      {!hasMultipleLocations && (
                        <p className="text-sm font-medium" style={{ color: theme.text }}>
                          {selectedLocation.name}
                        </p>
                      )}
                      {(selectedLocation.city || selectedLocation.department) && (
                        <p className="text-xs" style={{ color: theme.mutedText }}>
                          {[selectedLocation.city, selectedLocation.department]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-red-500">Selecciona una sede para continuar.</p>
                )}
              </div>

              {/* Fulfillment method */}
              {hasFulfillmentChoice && (
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
                    ¿Cómo deseas recibir tu pedido?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'delivery', label: 'A domicilio', icon: Home },
                        { value: 'pickup', label: 'Retiro en tienda', icon: StoreIcon },
                      ] as const
                    ).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => formik.setFieldValue('fulfillmentMethod', value)}
                        className="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors"
                        style={{
                          borderColor: formik.values.fulfillmentMethod === value ? theme.primary : theme.border,
                          backgroundColor: formik.values.fulfillmentMethod === value ? `${theme.primary}12` : theme.surface,
                          color: formik.values.fulfillmentMethod === value ? theme.primary : theme.mutedText,
                        }}
                      >
                        <Icon className="h-5 w-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!hasFulfillmentChoice && (
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
                  style={{ backgroundColor: `${theme.primary}10`, color: theme.primary }}
                >
                  {formik.values.fulfillmentMethod === 'pickup'
                    ? <><StoreIcon className="h-4 w-4 shrink-0" /> Retiro en tienda</>
                    : <><Home className="h-4 w-4 shrink-0" /> Entrega a domicilio</>}
                </div>
              )}

              {/* Delivery address — city/department come from selectedLocation, not editable */}
              {formik.values.fulfillmentMethod === 'delivery' && (
                <div className="space-y-3">
                  <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
                    Dirección de entrega
                  </p>
                  <CheckoutField
                    formik={formik}
                    theme={theme}
                    name="shippingAddress"
                    label="Dirección"
                    required
                    placeholder="Calle 45 # 23-10, Apto 301"
                  />
                  <CheckoutField
                    formik={formik}
                    theme={theme}
                    name="deliveryNeighborhood"
                    label="Barrio"
                    placeholder="El Poblado"
                  />
                  <CheckoutField
                    formik={formik}
                    theme={theme}
                    name="deliveryReference"
                    label="Referencia"
                    placeholder="Portería principal, timbre 3"
                  />
                </div>
              )}

              {/* Contact info */}
              <div className="space-y-3">
                <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
                  Datos de contacto
                </p>
                <CheckoutField
                  formik={formik}
                  theme={theme}
                  name="customerName"
                  label="Nombre completo"
                  required
                  placeholder="María García"
                />
                <CheckoutField
                  formik={formik}
                  theme={theme}
                  name="customerPhone"
                  label="Teléfono"
                  required
                  placeholder="3001234567"
                  type="tel"
                />
                <CheckoutField
                  formik={formik}
                  theme={theme}
                  name="customerEmail"
                  label="Email (opcional)"
                  placeholder="correo@ejemplo.com"
                  type="email"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-medium" style={{ color: theme.mutedText }}>
                  Notas adicionales (opcional)
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  value={formik.values.notes}
                  onChange={formik.handleChange}
                  placeholder="Indicaciones especiales para tu pedido..."
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                />
              </div>
            </div>

            <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-60">Total a pagar</span>
                <span className="font-bold text-lg" style={{ color: theme.primary }}>
                  {formatCurrency(totalPrice, 'es-CO', 'COP')}
                </span>
              </div>
              <button
                type="button"
                disabled={step === 'submitting' || !selectedLocation}
                onClick={() => { void formik.submitForm(); }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: theme.primary }}
              >
                {step === 'submitting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  'Confirmar pedido'
                )}
              </button>
            </div>
          </>
        )}

        {/* ── STEP: confirmed ── */}
        {step === 'confirmed' && orderResult && (
          <>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: theme.border }}>
              <h2 className="font-semibold">¡Pedido confirmado!</h2>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-5">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primary}18` }}
              >
                <CheckCircle className="h-10 w-10" style={{ color: theme.primary }} />
              </div>

              <div className="space-y-1">
                <p className="text-sm opacity-60">Número de pedido</p>
                <p className="text-2xl font-bold tracking-wider" style={{ color: theme.primary }}>
                  {orderResult.orderNumber}
                </p>
              </div>

              <div
                className="w-full rounded-2xl border px-4 py-3 text-sm space-y-2"
                style={{ borderColor: theme.border, backgroundColor: theme.surface }}
              >
                <div className="flex justify-between">
                  <span className="opacity-60">Total</span>
                  <span className="font-semibold">{formatCurrency(orderResult.totalAmount, 'es-CO', 'COP')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Pago</span>
                  <span className="font-semibold">Contraentrega</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Estado</span>
                  <span className="font-semibold text-amber-600">Pendiente</span>
                </div>
              </div>

              <p className="text-sm opacity-50 leading-relaxed">
                El negocio recibirá tu pedido y te contactará para confirmar la entrega.
              </p>
            </div>

            <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: theme.border }}>
              {whatsappNumber && (
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#25D366' }}
                >
                  Compartir por WhatsApp
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl border py-3 text-sm font-medium transition-opacity hover:opacity-70"
                style={{ borderColor: theme.border, color: theme.mutedText }}
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
