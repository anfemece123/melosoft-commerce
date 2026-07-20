import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { useLocationChangeWithCheck } from '@/lib/locations/useLocationChangeWithCheck';
import { LocationConflictModal } from '@/components/public/locations/LocationConflictModal';
import type { StorefrontTheme } from '../storefront/storefrontTheme';
import { withAlpha } from '../storefront/storefrontTheme';
import { CartDrawerHeader } from './CartDrawerHeader';
import { CartItemsList } from './CartItemsList';
import { CartSummary } from './CartSummary';
import { CheckoutPaymentSelector } from './CheckoutPaymentSelector';
import { CheckoutLocationSelector } from './CheckoutLocationSelector';
import { CheckoutCustomerForm } from './CheckoutCustomerForm';
import { CheckoutActions } from './CheckoutActions';
import { CheckoutResultMessage } from './CheckoutResultMessage';
import { useCartCheckout } from './useCartCheckout';
import { useCartLocationAvailability } from './useCartLocationAvailability';
import { getPickupLocations } from '@/lib/orders/fulfillment';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  theme: StorefrontTheme;
  storeName: string;
  storeSlug: string;
  currency: string;
  whatsappNumber: string | null;
  allowsPickup: boolean | null;
  allowsLocalDelivery: boolean | null;
  allowsNationalShipping?: boolean | null;
  localDeliveryNotes?: string | null;
  shippingNotes?: string | null;
  localDeliveryBaseFee?: number | null;
  localDeliveryFreeFrom?: number | null;
  nationalShippingBaseFee?: number | null;
  nationalShippingFreeFrom?: number | null;
  cashOnDeliveryEnabled?: boolean | null;
  onlineCheckoutEnabled?: boolean | null;
}

export function CartDrawer({
  open,
  onClose,
  theme,
  storeName,
  storeSlug,
  currency,
  whatsappNumber,
  allowsPickup,
  allowsLocalDelivery,
  allowsNationalShipping,
  localDeliveryNotes,
  shippingNotes,
  localDeliveryBaseFee,
  localDeliveryFreeFrom,
  nationalShippingBaseFee,
  nationalShippingFreeFrom,
  cashOnDeliveryEnabled,
  onlineCheckoutEnabled,
}: CartDrawerProps) {
  const navigate = useNavigate();
  const {
    items,
    totalItems,
    totalPrice,
    updateQuantity,
    removeItem,
    selectedLocation,
    step,
    setStep,
    orderResult,
    paymentChoice,
    setPaymentChoice,
    showOnline,
    showPaymentChoice,
    hasAnyPaymentMethod,
    availableFulfillmentMethods,
    hasFulfillmentChoice,
    operationalLocation,
    localDeliveryCities,
    formik,
  } = useCartCheckout({
    storeSlug,
    allowsPickup,
    allowsLocalDelivery,
    allowsNationalShipping: allowsNationalShipping ?? null,
    localDeliveryBaseFee,
    localDeliveryFreeFrom,
    nationalShippingBaseFee,
    nationalShippingFreeFrom,
    cashOnDeliveryEnabled,
    onlineCheckoutEnabled,
  });

  // Lock background scroll while the drawer is open so touch-scrolling the
  // page behind it doesn't fight the drawer's own internal scroll on mobile.
  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  const { locations } = useSelectedLocation();
  const { requestLocationChange, confirmLocationChange, cancelLocationChange, pendingChange, checking: checkingLocation } =
    useLocationChangeWithCheck();
  const { unavailableIds: cartUnavailableIds } = useCartLocationAvailability(items, locations, selectedLocation, open);

  const storeId = selectedLocation?.storeId ?? locations[0]?.storeId ?? null;
  const visibleCartUnavailableIds =
    open && storeId && selectedLocation && items.length > 0
      ? cartUnavailableIds
      : new Set<string>();
  const unavailableItems = items.filter((i) => visibleCartUnavailableIds.has(i.productId));
  const checkoutMethod = formik.values.fulfillmentMethod;
  const pickupLocations = getPickupLocations(locations);
  const showLocationSelector = checkoutMethod === 'pickup' && pickupLocations.length > 1;

  function handleRemoveUnavailable() {
    for (const item of unavailableItems) {
      removeItem(item.lineId);
    }
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
            <CartDrawerHeader
              theme={theme}
              title={`Tu pedido (${totalItems})`}
              icon={<ShoppingBag className="h-5 w-5" style={{ color: theme.primary }} />}
              onClose={onClose}
            />

            <CartItemsList items={items} theme={theme} currency={currency} onUpdateQuantity={updateQuantity} onRemove={removeItem} />

            {items.length > 0 && (
              <CartSummary
                theme={theme}
                currency={currency}
                totalPrice={totalPrice}
                unavailableItems={unavailableItems}
                onRemoveUnavailable={handleRemoveUnavailable}
                paymentSelector={
                  hasAnyPaymentMethod ? (
                    <CheckoutPaymentSelector
                      theme={theme}
                      showPaymentChoice={showPaymentChoice}
                      showOnline={showOnline}
                      paymentChoice={paymentChoice}
                      onChange={setPaymentChoice}
                    />
                  ) : null
                }
                hasAnyPaymentMethod={hasAnyPaymentMethod}
                onViewCart={() => {
                  onClose();
                  void navigate(buildStorefrontPath(storeSlug, '/cart'));
                }}
                onContinue={() => {
                  onClose();
                  void navigate(buildStorefrontPath(storeSlug, '/checkout'));
                }}
              />
            )}
          </>
        )}

        {/* ── STEP: form ── */}
        {(step === 'form' || step === 'submitting') && (
          <>
            <CartDrawerHeader
              theme={theme}
              title="Datos del pedido"
              onBack={() => setStep('cart')}
              onClose={onClose}
              showActions={step === 'form'}
            />

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {showLocationSelector ? (
                <CheckoutLocationSelector
                  theme={theme}
                  locations={pickupLocations}
                  selectedLocation={selectedLocation}
                  disabled={step === 'submitting' || checkingLocation}
                  title="Punto de retiro"
                  helperText="Elige dónde vas a recoger el pedido."
                  onSelectLocation={requestLocationChange}
                />
              ) : null}

              <CheckoutCustomerForm
                theme={theme}
                formik={formik}
                hasFulfillmentChoice={hasFulfillmentChoice}
                availableFulfillmentMethods={availableFulfillmentMethods}
                locations={locations}
                selectedLocation={selectedLocation}
                localDeliveryCities={localDeliveryCities}
                operationalLocation={operationalLocation}
                currency={currency}
                localDeliveryBaseFee={localDeliveryBaseFee}
                localDeliveryFreeFrom={localDeliveryFreeFrom}
                nationalShippingBaseFee={nationalShippingBaseFee}
                nationalShippingFreeFrom={nationalShippingFreeFrom}
                localDeliveryNotes={localDeliveryNotes ?? null}
                nationalShippingNotes={shippingNotes ?? null}
                onSelectSuggestedLocation={requestLocationChange}
              />
            </div>

            <CheckoutActions
              theme={theme}
              isSubmitting={step === 'submitting'}
              hasSelectedLocation={Boolean(operationalLocation)}
              paymentChoice={paymentChoice}
              onSubmit={() => { void formik.submitForm(); }}
            />
          </>
        )}

        {/* ── STEP: redirecting to Wompi ── */}
        {step === 'redirecting_to_wompi' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-5 px-6 py-10 text-center">
            <div
              className="h-16 w-16 rounded-full border-4 animate-spin"
              style={{ borderColor: withAlpha(theme.primary, 0.18), borderTopColor: theme.primary }}
            />
            <div>
              <p className="font-semibold" style={{ color: theme.text }}>Abriendo pasarela de pago...</p>
              <p className="mt-1 text-sm" style={{ color: theme.mutedText }}>Serás redirigido a Wompi para completar tu pago.</p>
            </div>
          </div>
        )}

        {/* ── STEP: confirmed ── */}
        {step === 'confirmed' && orderResult && (
          <>
            <CartDrawerHeader theme={theme} title="¡Pedido confirmado!" onClose={onClose} />
            <CheckoutResultMessage
              theme={theme}
              currency={currency}
              orderResult={orderResult}
              storeName={storeName}
              whatsappNumber={whatsappNumber}
              onClose={onClose}
            />
          </>
        )}
      </div>
    </>
  );
}
