import { useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { useLocationChangeWithCheck } from '@/lib/locations/useLocationChangeWithCheck';
import { LocationConflictModal } from '@/components/public/locations/LocationConflictModal';
import type { StorefrontTheme } from '../storefront/storefrontTheme';
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
  cashOnDeliveryEnabled,
  onlineCheckoutEnabled,
}: CartDrawerProps) {
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
    hasFulfillmentChoice,
    formik,
  } = useCartCheckout({ storeSlug, allowsPickup, allowsLocalDelivery, cashOnDeliveryEnabled, onlineCheckoutEnabled });

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
                onContinue={() => setStep('form')}
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
              <CheckoutLocationSelector
                theme={theme}
                locations={locations}
                selectedLocation={selectedLocation}
                disabled={step === 'submitting' || checkingLocation}
                onSelectLocation={requestLocationChange}
              />

              <CheckoutCustomerForm theme={theme} formik={formik} hasFulfillmentChoice={hasFulfillmentChoice} />
            </div>

            <CheckoutActions
              theme={theme}
              currency={currency}
              totalPrice={totalPrice}
              isSubmitting={step === 'submitting'}
              hasSelectedLocation={Boolean(selectedLocation)}
              paymentChoice={paymentChoice}
              onSubmit={() => { void formik.submitForm(); }}
            />
          </>
        )}

        {/* ── STEP: redirecting to Wompi ── */}
        {step === 'redirecting_to_wompi' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-5 px-6 py-10 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
            <div>
              <p className="font-semibold text-gray-800">Abriendo pasarela de pago...</p>
              <p className="text-sm text-gray-500 mt-1">Serás redirigido a Wompi para completar tu pago.</p>
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
