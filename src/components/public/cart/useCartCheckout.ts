import { useState } from 'react';
import { useFormik } from 'formik';
import { useScrollToFirstFormikError } from '@/hooks/useScrollToFirstFormikError';
import { useCart } from '@/lib/cart/cartContext';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { env } from '@/lib/env';
import { ordersService } from '@/features/orders/ordersService';
import { paymentsService } from '@/features/payments/paymentsService';
import { notify } from '@/lib/notifications';
import { checkoutSchema, type CheckoutFormValues } from '@/schemas/order.schema';
import type { WebOrderResult } from '@/features/orders/orders.types';
import type { PaymentChoice } from './CheckoutPaymentSelector';

export type DrawerStep = 'cart' | 'form' | 'submitting' | 'confirmed' | 'redirecting_to_wompi';

interface UseCartCheckoutParams {
  storeSlug: string;
  allowsPickup: boolean | null;
  allowsLocalDelivery: boolean | null;
  cashOnDeliveryEnabled?: boolean | null;
  onlineCheckoutEnabled?: boolean | null;
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

export function useCartCheckout({
  storeSlug,
  allowsPickup,
  allowsLocalDelivery,
  cashOnDeliveryEnabled,
  onlineCheckoutEnabled,
}: UseCartCheckoutParams) {
  const { items, totalItems, totalPrice, updateQuantity, removeItem, clearCart } = useCart();
  const { selectedLocation } = useSelectedLocation();

  const [step, setStep] = useState<DrawerStep>('cart');
  const [orderResult, setOrderResult] = useState<WebOrderResult | null>(null);

  // Payment method selection
  const showCod    = cashOnDeliveryEnabled !== false;
  const showOnline = onlineCheckoutEnabled === true;
  const showPaymentChoice = showCod && showOnline;
  const hasAnyPaymentMethod = showCod || showOnline;
  const defaultPayment: PaymentChoice = showOnline && !showCod ? 'online' : 'cash_on_delivery';
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>(defaultPayment);

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
        if (paymentChoice === 'online') {
          // For online payment: create a checkout session, NOT an order.
          // The order is created only after the Wompi webhook confirms APPROVED.

          // Wompi rejects HTTP and localhost — require a public HTTPS URL.
          const redirectBase =
            env.publicSiteUrl ??
            (window.location.origin.startsWith('https://') ? window.location.origin : null);

          if (!redirectBase) {
            setStep('form');
            notify.error(
              'Para pagar con Wompi necesitas una URL pública HTTPS. ' +
              'Configura VITE_PUBLIC_SITE_URL en tu .env.local con una URL ngrok (desarrollo) ' +
              'o el dominio de producción.',
            );
            return;
          }

          const redirectUrl = `${redirectBase}/s/${storeSlug}/payment-result`;

          const checkout = await paymentsService.initiateWompiCheckout(
            {
              storeSlug,
              customerName:         values.customerName.trim(),
              customerPhone:        values.customerPhone.trim(),
              customerEmail:        values.customerEmail.trim() || null,
              fulfillmentMethod:    values.fulfillmentMethod,
              shippingAddress:      values.fulfillmentMethod === 'delivery'
                ? (values.shippingAddress.trim() || null) : null,
              city:                 selectedLocation.city,
              department:           selectedLocation.department,
              deliveryNeighborhood: values.deliveryNeighborhood.trim() || null,
              deliveryReference:    values.deliveryReference.trim() || null,
              notes:                values.notes.trim() || null,
              storeLocationId:      selectedLocation.locationId,
              items: items.map(item => ({
                productId:          item.productId,
                quantity:           item.quantity,
                customizationNotes: item.customizationNotes,
              })),
            },
            redirectUrl,
          );

          // Do NOT clear the cart here — the order is only created once the
          // Wompi webhook confirms APPROVED. If the user abandons checkout,
          // closes the tab, or the payment fails, the cart must still be
          // there when they come back. It's cleared on PaymentResultPage
          // once the payment is actually confirmed as approved.
          setStep('redirecting_to_wompi');
          window.location.href = checkout.checkoutUrl;
        } else {
          // COD: create the order immediately (unchanged flow).
          const result = await ordersService.createWebOrder({
            storeSlug,
            customerName:         values.customerName.trim(),
            customerPhone:        values.customerPhone.trim(),
            customerEmail:        values.customerEmail.trim() || null,
            fulfillmentMethod:    values.fulfillmentMethod,
            shippingAddress:      values.fulfillmentMethod === 'delivery'
              ? (values.shippingAddress.trim() || null) : null,
            city:                 selectedLocation.city,
            department:           selectedLocation.department,
            deliveryNeighborhood: values.deliveryNeighborhood.trim() || null,
            deliveryReference:    values.deliveryReference.trim() || null,
            notes:                values.notes.trim() || null,
            storeLocationId:      selectedLocation.locationId,
            paymentMethod:        'cash_on_delivery',
            items: items.map(item => ({
              productId:          item.productId,
              quantity:           item.quantity,
              customizationNotes: item.customizationNotes,
            })),
          });
          setOrderResult(result);
          clearCart();
          setStep('confirmed');
        }
      } catch (err) {
        setStep('form');
        notify.fromError(err, 'No pudimos confirmar tu pedido. Intenta nuevamente.');
      }
    },
  });

  useScrollToFirstFormikError({
    errors: formik.errors,
    submitCount: formik.submitCount,
    isSubmitting: formik.isSubmitting,
  });

  return {
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
    showCod,
    showOnline,
    showPaymentChoice,
    hasAnyPaymentMethod,
    hasFulfillmentChoice,
    formik,
  };
}
