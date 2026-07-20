import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { useCartCheckout } from '@/components/public/cart/useCartCheckout';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { useLocationChangeWithCheck } from '@/lib/locations/useLocationChangeWithCheck';
import { getPickupLocations } from '@/lib/orders/fulfillment';
import { LocationConflictModal } from '@/components/public/locations/LocationConflictModal';
import { CheckoutLocationSelector } from '@/components/public/cart/CheckoutLocationSelector';
import { CheckoutPaymentSelector } from '@/components/public/cart/CheckoutPaymentSelector';
import { CheckoutCustomerForm } from '@/components/public/cart/CheckoutCustomerForm';
import { CheckoutActions } from '@/components/public/cart/CheckoutActions';
import { CheckoutResultMessage } from '@/components/public/cart/CheckoutResultMessage';
import { CartItemsList } from '@/components/public/cart/CartItemsList';
import { StorefrontBackButton } from '@/components/public/storefront/StorefrontBackButton';
import { withAlpha } from '@/components/public/storefront/storefrontTheme';
import { formatCurrency } from '@/utils/formatCurrency';
import { useResolvedStoreSlug } from '@/lib/storefront/storefrontDomainContext';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

export function StoreCheckoutPage() {
  const { storeSlug: routeStoreSlug } = useParams<{ storeSlug: string }>();
  const storeSlug = useResolvedStoreSlug(routeStoreSlug);
  const navigate = useNavigate();
  const { branding } = usePublicStoreBranding();
  const { locations } = useSelectedLocation();
  const { requestLocationChange, confirmLocationChange, cancelLocationChange, pendingChange, checking } =
    useLocationChangeWithCheck();
  const [ready, setReady] = useState(false);

  // useCartCheckout/useEffect must run on every render, in the same order,
  // regardless of whether storeSlug/branding have resolved yet — the
  // `!storeSlug || !branding` guard below runs *after* every hook call for
  // that reason. storeSlug/branding fields are only read inside this hook
  // from user-triggered handlers (onSubmit) or from values already typed
  // as nullable, so passing safe fallbacks here while they're still
  // unresolved cannot fire any premature side effect — the guard return
  // below prevents the form/JSX that could ever trigger onSubmit from
  // rendering in the first place.
  const checkout = useCartCheckout({
    storeSlug: storeSlug ?? '',
    allowsPickup: branding?.allowsPickup ?? null,
    allowsLocalDelivery: branding?.allowsLocalDelivery ?? null,
    allowsNationalShipping: branding?.allowsNationalShipping ?? null,
    localDeliveryBaseFee: branding?.localDeliveryBaseFee,
    localDeliveryFreeFrom: branding?.localDeliveryFreeFrom,
    nationalShippingBaseFee: branding?.nationalShippingBaseFee,
    nationalShippingFreeFrom: branding?.nationalShippingFreeFrom,
    cashOnDeliveryEnabled: branding?.cashOnDeliveryEnabled,
    onlineCheckoutEnabled: branding?.onlineCheckoutEnabled,
  });

  useEffect(() => {
    if (!ready) {
      setReady(true);
      checkout.setStep('form');
    }
  }, [checkout, ready]);

  if (!storeSlug || !branding) return null;

  const theme = buildStorefrontTheme({
    mode: branding.themeMode,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    backgroundColor: branding.backgroundColor,
    textColor: branding.textColor,
    buttonRadius: branding.buttonRadius,
  });

  const checkoutMethod = checkout.formik.values.fulfillmentMethod;
  const pickupLocations = getPickupLocations(locations);
  const showLocationSelector = checkoutMethod === 'pickup' && pickupLocations.length > 1;
  const paymentLabel = checkout.paymentChoice === 'online' ? 'Pago online con Wompi' : 'Pago contraentrega';
  const locationLabel = checkout.operationalLocation
    ? [
      checkout.operationalLocation.name,
      checkout.operationalLocation.city,
      checkout.operationalLocation.department,
    ].filter(Boolean).join(' · ')
    : 'Asignación automática';

  if (checkout.items.length === 0 && checkout.step !== 'confirmed' && checkout.step !== 'redirecting_to_wompi') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: theme.mutedText }}>
          Checkout
        </p>
        <h1 className="mt-3 text-3xl font-semibold" style={{ color: theme.text }}>
          Tu carrito está vacío
        </h1>
        <p className="mt-3 text-sm" style={{ color: theme.mutedText }}>
          Agrega productos antes de continuar con el pedido.
        </p>
        <Link
          to={buildStorefrontPath(storeSlug, '/catalog')}
          className="mt-6 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: theme.primary }}
        >
          Ir al catálogo
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">
      {pendingChange && (
        <LocationConflictModal
          theme={theme}
          targetLocation={pendingChange.location}
          result={pendingChange.result}
          onCancel={cancelLocationChange}
          onConfirm={confirmLocationChange}
        />
      )}

      {checkout.step === 'confirmed' && checkout.orderResult ? (
        <section className="mx-auto max-w-3xl border-y" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
          <div className="border-b px-6 py-5" style={{ borderColor: theme.border }}>
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: theme.mutedText }}>
              Pedido confirmado
            </p>
            <h1 className="mt-2 text-3xl font-semibold" style={{ color: theme.text }}>
              Todo quedó listo
            </h1>
          </div>
          <CheckoutResultMessage
            theme={theme}
            currency={branding.currency}
            orderResult={checkout.orderResult}
            storeName={branding.storeName}
            whatsappNumber={branding.whatsappNumber}
            onClose={() => void navigate(buildStorefrontPath(storeSlug))}
            fulfillmentMethod={checkout.formik.values.fulfillmentMethod}
            operationalLocationName={checkout.operationalLocation?.name ?? null}
            city={
              checkout.formik.values.fulfillmentMethod === 'national_shipping'
                ? checkout.formik.values.shippingCityName || null
                : checkout.operationalLocation?.city ?? null
            }
            shippingAddress={checkout.formik.values.shippingAddress || null}
            deliveryNeighborhood={checkout.formik.values.deliveryNeighborhood || null}
            deliveryReference={checkout.formik.values.deliveryReference || null}
          />
        </section>
      ) : checkout.step === 'redirecting_to_wompi' ? (
        <section className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-5 border-y px-6 py-16 text-center" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
          <div
            className="h-16 w-16 rounded-full border-4 animate-spin"
            style={{ borderColor: withAlpha(theme.primary, 0.18), borderTopColor: theme.primary }}
          />
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: theme.text }}>
              Abriendo pasarela de pago
            </h1>
            <p className="mt-2 text-sm" style={{ color: theme.mutedText }}>
              Te estamos redirigiendo a Wompi para completar tu compra de forma segura.
            </p>
          </div>
        </section>
      ) : (
        <>
          <StorefrontBackButton
            storeSlug={storeSlug}
            className="mb-6"
            color={theme.text}
            label="Volver al carrito"
            fallbackPath={buildStorefrontPath(storeSlug, '/cart')}
          />

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="space-y-8">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: theme.mutedText }}>
                  Checkout
                </p>
                <h1 className="text-3xl font-semibold tracking-tight" style={{ color: theme.text }}>
                  Datos del pedido
                </h1>
                <p className="text-sm" style={{ color: theme.mutedText }}>
                  Completa solo lo necesario para confirmar tu compra.
                </p>
              </div>

              <div className="border-y" style={{ borderColor: theme.border }}>
                {showLocationSelector ? (
                  <div className="py-5">
                    <CheckoutLocationSelector
                      theme={theme}
                      locations={pickupLocations}
                      selectedLocation={checkout.selectedLocation}
                      disabled={checkout.step === 'submitting' || checking}
                      title="Punto de retiro"
                      helperText="Elige dónde vas a recoger el pedido."
                      onSelectLocation={requestLocationChange}
                    />
                  </div>
                ) : null}

                <div className={`${showLocationSelector ? 'border-t' : ''} py-6`} style={{ borderColor: theme.border }}>
                  <div className="mb-4 space-y-1">
                    <p className="text-base font-semibold" style={{ color: theme.text }}>
                      Entrega y contacto
                    </p>
                    <p className="text-sm" style={{ color: theme.mutedText }}>
                      Define cómo recibirás tu pedido y deja tus datos.
                    </p>
                  </div>
                  <div className="space-y-5">
                    <CheckoutCustomerForm
                      theme={theme}
                      formik={checkout.formik}
                      hasFulfillmentChoice={checkout.hasFulfillmentChoice}
                      availableFulfillmentMethods={checkout.availableFulfillmentMethods}
                      locations={locations}
                      selectedLocation={checkout.selectedLocation}
                      localDeliveryCities={checkout.localDeliveryCities}
                      operationalLocation={checkout.operationalLocation}
                      currency={branding.currency}
                      localDeliveryBaseFee={branding.localDeliveryBaseFee}
                      localDeliveryFreeFrom={branding.localDeliveryFreeFrom}
                      nationalShippingBaseFee={branding.nationalShippingBaseFee}
                      nationalShippingFreeFrom={branding.nationalShippingFreeFrom}
                      localDeliveryNotes={branding.localDeliveryNotes}
                      nationalShippingNotes={branding.shippingNotes}
                      onSelectSuggestedLocation={requestLocationChange}
                    />
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="border-y" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
                <div className="flex items-center gap-2 border-b px-1 py-4" style={{ borderColor: theme.border }}>
                  <ShoppingBag className="h-5 w-5" style={{ color: theme.primary }} />
                  <p className="font-semibold" style={{ color: theme.text }}>
                    Resumen del pedido
                  </p>
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  <CartItemsList
                    items={checkout.items}
                    theme={theme}
                    currency={branding.currency}
                    onUpdateQuantity={checkout.updateQuantity}
                    onRemove={checkout.removeItem}
                  />
                </div>

                <div className="border-t px-1 py-4 text-sm" style={{ borderColor: theme.border }}>
                  {checkout.hasAnyPaymentMethod ? (
                    <div className="mb-4 space-y-3 border-b pb-4" style={{ borderColor: theme.border }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: theme.mutedText }}>Pago</span>
                        {!checkout.showPaymentChoice ? (
                          <span className="text-sm font-medium" style={{ color: theme.text }}>
                            {paymentLabel}
                          </span>
                        ) : null}
                      </div>
                      <CheckoutPaymentSelector
                        theme={theme}
                        showPaymentChoice={checkout.showPaymentChoice}
                        showOnline={checkout.showOnline}
                        paymentChoice={checkout.paymentChoice}
                        onChange={checkout.setPaymentChoice}
                      />
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-4">
                    <span style={{ color: theme.mutedText }}>
                      {checkoutMethod === 'pickup' ? 'Punto de retiro' : 'Preparación'}
                    </span>
                    <span className="text-right" style={{ color: theme.text }}>
                      {locationLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: theme.mutedText }}>Productos</span>
                    <span style={{ color: theme.text }}>{checkout.totalItems}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span style={{ color: theme.mutedText }}>Subtotal</span>
                    <span style={{ color: theme.text }}>
                      {formatCurrency(checkout.subtotalPrice, 'es-CO', branding.currency)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span style={{ color: theme.mutedText }}>Envío</span>
                    <span style={{ color: checkout.shippingIsFree ? theme.primary : theme.text }}>
                      {checkout.shippingIsFree ? 'Gratis' : formatCurrency(checkout.shippingAmount, 'es-CO', branding.currency)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span style={{ color: theme.mutedText }}>Total a pagar</span>
                    <span className="text-xl font-bold" style={{ color: theme.primary }}>
                      {formatCurrency(checkout.grandTotal, 'es-CO', branding.currency)}
                    </span>
                  </div>
                </div>

                <CheckoutActions
                  theme={theme}
                  isSubmitting={checkout.step === 'submitting'}
                  hasSelectedLocation={Boolean(checkout.operationalLocation)}
                  paymentChoice={checkout.paymentChoice}
                  onSubmit={() => { void checkout.formik.submitForm(); }}
                />
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
