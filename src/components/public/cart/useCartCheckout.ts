import { useEffect, useMemo, useState } from 'react';
import { useFormik } from 'formik';
import { scrollToFirstError, useScrollToFirstFormikError } from '@/hooks/useScrollToFirstFormikError';
import { useCart } from '@/lib/cart/cartContext';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { env } from '@/lib/env';
import { buildStorefrontPath, isUsingStorefrontHostname } from '@/lib/storefront/storefrontPaths';
import { ordersService } from '@/features/orders/ordersService';
import { paymentsService } from '@/features/payments/paymentsService';
import { notify } from '@/lib/notifications';
import { createCheckoutSchema, type CheckoutFormValues } from '@/schemas/order.schema';
import {
  getAvailableFulfillmentMethods,
  getLocalDeliveryLocations,
  getUniqueLocationCities,
  normalizeFulfillmentMethod,
  resolveOperationalLocation,
} from '@/lib/orders/fulfillment';
import { calculateShippingAmount } from '@/lib/commerce/shippingRules';
import type { WebOrderResult } from '@/features/orders/orders.types';
import type { PaymentChoice } from './CheckoutPaymentSelector';
import { locationsService } from '@/features/locations/locationsService';
import { COLOMBIAN_MOBILE_MESSAGE, normalizeColombianMobile } from '@/lib/phone/phoneValidation';
import { partnersService } from '@/features/partners/partnersService';
import type { PartnerCodeQuote } from '@/features/partners/partners.types';

export type DrawerStep = 'cart' | 'form' | 'submitting' | 'confirmed' | 'redirecting_to_wompi';

interface UseCartCheckoutParams {
  initialStep?: DrawerStep;
  storeSlug: string;
  allowsPickup: boolean | null;
  allowsLocalDelivery: boolean | null;
  allowsNationalShipping: boolean | null;
  localDeliveryBaseFee?: number | null;
  localDeliveryFreeFrom?: number | null;
  nationalShippingBaseFee?: number | null;
  nationalShippingFreeFrom?: number | null;
  cashOnDeliveryEnabled?: boolean | null;
  onlineCheckoutEnabled?: boolean | null;
  partnerCodesEnabled?: boolean;
  whatsappOrderUpdatesRequired?: boolean;
}

export function useCartCheckout({
  initialStep = 'cart',
  storeSlug,
  allowsPickup,
  allowsLocalDelivery,
  allowsNationalShipping,
  localDeliveryBaseFee,
  localDeliveryFreeFrom,
  nationalShippingBaseFee,
  nationalShippingFreeFrom,
  cashOnDeliveryEnabled,
  onlineCheckoutEnabled,
  partnerCodesEnabled = false,
  whatsappOrderUpdatesRequired = false,
}: UseCartCheckoutParams) {
  const { items, totalItems, totalPrice, updateQuantity, removeItem, clearCart } = useCart();
  const { locations, selectedLocation, setSelectedLocation } = useSelectedLocation();

  const [step, setStep] = useState<DrawerStep>(initialStep);
  const [orderResult, setOrderResult] = useState<WebOrderResult | null>(null);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [partnerCodeQuote, setPartnerCodeQuote] = useState<PartnerCodeQuote | null>(null);
  const [partnerCodeSubtotal, setPartnerCodeSubtotal] = useState<number | null>(null);
  const [partnerCodeError, setPartnerCodeError] = useState<string | null>(null);
  const [isApplyingPartnerCode, setIsApplyingPartnerCode] = useState(false);
  const appliedPartnerCode = partnerCodesEnabled && partnerCodeQuote && partnerCodeSubtotal === totalPrice
    ? partnerCodeQuote
    : null;

  // Payment method selection
  const showCod    = cashOnDeliveryEnabled !== false;
  const showOnline = onlineCheckoutEnabled === true;
  const showPaymentChoice = showCod && showOnline;
  const hasAnyPaymentMethod = showCod || showOnline;
  const defaultPayment: PaymentChoice = showOnline && !showCod ? 'online' : 'cash_on_delivery';
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>(defaultPayment);

  const availableFulfillmentMethods = getAvailableFulfillmentMethods({
    allowsPickup,
    allowsLocalDelivery,
    allowsNationalShipping,
  });
  const defaultFulfillment = availableFulfillmentMethods[0] ?? 'pickup';
  const hasFulfillmentChoice = availableFulfillmentMethods.length > 1;
  const validationSchema = useMemo(
    () => createCheckoutSchema(whatsappOrderUpdatesRequired),
    [whatsappOrderUpdatesRequired],
  );

  const formik = useFormik<CheckoutFormValues>({
    initialValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      fulfillmentMethod: defaultFulfillment,
      shippingAddress: '',
      shippingDepartmentId: '',
      shippingDepartmentName: '',
      shippingCityId: '',
      shippingCityName: '',
      localDeliveryCity: '',
      deliveryNeighborhood: '',
      deliveryReference: '',
      notes: '',
      whatsappConsent: false,
    },
    validationSchema,
    enableReinitialize: false,
    onSubmit: async (values, helpers) => {
      try {
        const customerPhone = normalizeColombianMobile(values.customerPhone);
        if (!customerPhone) {
          helpers.setFieldTouched('customerPhone', true, false);
          helpers.setFieldError('customerPhone', COLOMBIAN_MOBILE_MESSAGE);
          return;
        }
        const fulfillmentMethod = normalizeFulfillmentMethod(values.fulfillmentMethod);
        const operationalLocation = resolveOperationalLocation({
          fulfillmentMethod,
          locations,
          selectedLocation,
          localDeliveryCity: values.localDeliveryCity,
        });

        if (!operationalLocation) {
          notify.error(
            fulfillmentMethod === 'pickup'
              ? 'No hay un punto de retiro disponible para este pedido.'
              : 'No encontramos una sede operativa para procesar este pedido.',
          );
          scrollToFirstError({ fieldName: 'storeLocation' });
          return;
        }

        setStep('submitting');
        const orderingStatus = await locationsService.getLocationOrderStatus(operationalLocation.locationId);
        if (!orderingStatus.isAcceptingOrders) {
          setStep('form');
          notify.warning(
            orderingStatus.statusCode === 'paused'
              ? 'Los pedidos están pausados temporalmente. Tu carrito seguirá guardado.'
              : 'La tienda no está recibiendo pedidos en este momento. Tu carrito seguirá guardado.',
          );
          return;
        }
        const shippingAddress = fulfillmentMethod === 'pickup'
          ? null
          : (values.shippingAddress.trim() || null);
        const city = fulfillmentMethod === 'national_shipping'
          ? (values.shippingCityName.trim() || null)
          : operationalLocation.city;
        const department = fulfillmentMethod === 'national_shipping'
          ? (values.shippingDepartmentName.trim() || null)
          : operationalLocation.department;
        const deliveryNeighborhood = fulfillmentMethod === 'pickup'
          ? null
          : (values.deliveryNeighborhood.trim() || null);
        const deliveryReference = fulfillmentMethod === 'pickup'
          ? null
          : (values.deliveryReference.trim() || null);

        if (paymentChoice === 'online') {
          // For online payment: create a checkout session, NOT an order.
          // The order is created only after the Wompi webhook confirms APPROVED.

          // Wompi rejects HTTP and localhost — require a public HTTPS URL.
          const redirectBase = isUsingStorefrontHostname(storeSlug)
            ? window.location.origin
            : env.publicSiteUrl ??
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

          const redirectUrl = new URL(
            buildStorefrontPath(storeSlug, '/payment-result'),
            redirectBase,
          ).toString();

          const checkout = await paymentsService.initiateWompiCheckout(
            {
              storeSlug,
              customerName:         values.customerName.trim(),
              customerPhone,
              customerEmail:        values.customerEmail.trim() || null,
              fulfillmentMethod,
              shippingAddress,
              city,
              department,
              deliveryNeighborhood,
              deliveryReference,
              notes:                values.notes.trim() || null,
              storeLocationId:      operationalLocation.locationId,
              whatsappConsent:      values.whatsappConsent,
              partnerCode:          appliedPartnerCode?.code ?? null,
              items: items.map(item => ({
                productId:          item.productId,
                variantId:          item.variantId ?? null,
                quantity:           item.quantity,
                customizationNotes: item.customizationNotes,
                customizations:     item.customizations.map(c => ({
                  optionGroupId: c.optionGroupId,
                  optionItemId:  c.optionItemId,
                })),
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
            customerPhone,
            customerEmail:        values.customerEmail.trim() || null,
            fulfillmentMethod,
            shippingAddress,
            city,
            department,
            deliveryNeighborhood,
            deliveryReference,
            notes:                values.notes.trim() || null,
            storeLocationId:      operationalLocation.locationId,
            paymentMethod:        'cash_on_delivery',
            whatsappConsent:      values.whatsappConsent,
            partnerCode:          appliedPartnerCode?.code ?? null,
            items: items.map(item => ({
              productId:          item.productId,
              variantId:          item.variantId ?? null,
              quantity:           item.quantity,
              customizationNotes: item.customizationNotes,
              customizations:     item.customizations.map(c => ({
                optionGroupId: c.optionGroupId,
                optionItemId:  c.optionItemId,
              })),
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

  useEffect(() => {
    if (availableFulfillmentMethods.length === 0) return;
    const normalizedCurrent = normalizeFulfillmentMethod(formik.values.fulfillmentMethod);
    if (!availableFulfillmentMethods.includes(normalizedCurrent)) {
      void formik.setFieldValue('fulfillmentMethod', defaultFulfillment);
    }
  }, [availableFulfillmentMethods, defaultFulfillment, formik, formik.values.fulfillmentMethod]);

  async function applyPartnerCode() {
    const code = partnerCodeInput.trim();
    if (!code) {
      setPartnerCodeError('Escribe un código para aplicarlo.');
      return;
    }
    setIsApplyingPartnerCode(true);
    setPartnerCodeError(null);
    try {
      const quote = await partnersService.previewCode(storeSlug, code, totalPrice);
      setPartnerCodeQuote(quote);
      setPartnerCodeSubtotal(totalPrice);
    } catch (err) {
      setPartnerCodeQuote(null);
      setPartnerCodeSubtotal(null);
      setPartnerCodeError(err instanceof Error ? err.message : 'No pudimos validar el código.');
    } finally {
      setIsApplyingPartnerCode(false);
    }
  }

  function removePartnerCode() {
    setPartnerCodeQuote(null);
    setPartnerCodeSubtotal(null);
    setPartnerCodeError(null);
  }

  const localDeliveryLocations = useMemo(
    () => getLocalDeliveryLocations(locations),
    [locations],
  );

  const localDeliveryCities = useMemo(
    () => getUniqueLocationCities(localDeliveryLocations),
    [localDeliveryLocations],
  );

  useEffect(() => {
    if (formik.values.fulfillmentMethod !== 'local_delivery') return;
    if (localDeliveryCities.length !== 1) return;
    const onlyCity = localDeliveryCities[0]?.city ?? '';
    if (onlyCity && formik.values.localDeliveryCity !== onlyCity) {
      void formik.setFieldValue('localDeliveryCity', onlyCity);
    }
  }, [formik, formik.values.fulfillmentMethod, formik.values.localDeliveryCity, localDeliveryCities]);

  useEffect(() => {
    const method = normalizeFulfillmentMethod(formik.values.fulfillmentMethod);
    if (method !== 'local_delivery') return;
    const operationalLocation = resolveOperationalLocation({
      fulfillmentMethod: method,
      locations,
      selectedLocation,
      localDeliveryCity: formik.values.localDeliveryCity,
    });
    if (
      operationalLocation &&
      selectedLocation?.locationId !== operationalLocation.locationId
    ) {
      setSelectedLocation(operationalLocation);
    }
  }, [formik.values.fulfillmentMethod, formik.values.localDeliveryCity, locations, selectedLocation, setSelectedLocation]);

  const operationalLocation = useMemo(
    () =>
      resolveOperationalLocation({
        fulfillmentMethod: formik.values.fulfillmentMethod,
        locations,
        selectedLocation,
        localDeliveryCity: formik.values.localDeliveryCity,
      }),
    [formik.values.fulfillmentMethod, formik.values.localDeliveryCity, locations, selectedLocation],
  );

  const shipping = useMemo(
    () =>
      calculateShippingAmount(totalPrice, formik.values.fulfillmentMethod, {
        localDeliveryBaseFee,
        localDeliveryFreeFrom,
        nationalShippingBaseFee,
        nationalShippingFreeFrom,
      }),
    [
      totalPrice,
      formik.values.fulfillmentMethod,
      localDeliveryBaseFee,
      localDeliveryFreeFrom,
      nationalShippingBaseFee,
      nationalShippingFreeFrom,
    ],
  );
  const discountAmount = appliedPartnerCode?.discountAmount ?? 0;
  const grandTotal = Math.max(totalPrice + shipping.fee - discountAmount, 0);

  return {
    items,
    totalItems,
    totalPrice,
    subtotalPrice: totalPrice,
    discountAmount,
    shippingAmount: shipping.fee,
    shippingThreshold: shipping.threshold,
    shippingIsFree: shipping.isFree,
    grandTotal,
    updateQuantity,
    removeItem,
    selectedLocation,
    operationalLocation,
    localDeliveryCities,
    step,
    setStep,
    orderResult,
    paymentChoice,
    setPaymentChoice,
    showCod,
    showOnline,
    showPaymentChoice,
    hasAnyPaymentMethod,
    availableFulfillmentMethods,
    hasFulfillmentChoice,
    formik,
    partnerCodeInput,
    setPartnerCodeInput,
    partnerCodeQuote: appliedPartnerCode,
    partnerCodeError: partnerCodeError ?? (
      partnerCodeQuote && !appliedPartnerCode
        ? 'El carrito cambió. Vuelve a aplicar el código para recalcular el descuento.'
        : null
    ),
    isApplyingPartnerCode,
    applyPartnerCode,
    removePartnerCode,
  };
}
