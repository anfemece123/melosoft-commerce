import * as Yup from 'yup';
import { colombianMobilePhoneSchema } from './phone.schema';

export const orderSchema = Yup.object({
  customerName: Yup.string().trim().min(2).max(200).required('El nombre es requerido'),
  customerEmail: Yup.string().trim().email('Email inválido').nullable(),
  customerPhone: colombianMobilePhoneSchema.required('El celular es requerido'),
  customerDocument: Yup.string().trim().max(30).nullable(),
  shippingAddress: Yup.string().trim().max(300).nullable(),
  city: Yup.string().trim().max(100).nullable(),
  department: Yup.string().trim().max(100).nullable(),
  notes: Yup.string().trim().max(1000).nullable(),
});

export const checkoutSchema = Yup.object({
  customerName: Yup.string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(200)
    .required('El nombre es requerido'),
  customerPhone: colombianMobilePhoneSchema.required('El celular es requerido'),
  customerEmail: Yup.string().trim().email('Email inválido').optional(),
  fulfillmentMethod: Yup.string()
    .oneOf(['pickup', 'local_delivery', 'national_shipping'] as const)
    .required(),
  shippingAddress: Yup.string()
    .trim()
    .max(300)
    .when('fulfillmentMethod', {
      is: (value: string) => value === 'local_delivery' || value === 'national_shipping',
      then: (s) => s.required('La dirección es requerida para este tipo de envío'),
      otherwise: (s) => s.optional(),
    }),
  shippingDepartmentId: Yup.string().when('fulfillmentMethod', {
    is: 'national_shipping',
    then: (s) => s.required('Selecciona un departamento'),
    otherwise: (s) => s.optional(),
  }),
  shippingDepartmentName: Yup.string().when('fulfillmentMethod', {
    is: 'national_shipping',
    then: (s) => s.required('Selecciona un departamento'),
    otherwise: (s) => s.optional(),
  }),
  shippingCityId: Yup.string().when('fulfillmentMethod', {
    is: 'national_shipping',
    then: (s) => s.required('Selecciona una ciudad'),
    otherwise: (s) => s.optional(),
  }),
  shippingCityName: Yup.string().when('fulfillmentMethod', {
    is: 'national_shipping',
    then: (s) => s.required('Selecciona una ciudad'),
    otherwise: (s) => s.optional(),
  }),
  localDeliveryCity: Yup.string().trim().max(120).optional(),
  deliveryNeighborhood: Yup.string().trim().max(100).optional(),
  deliveryReference: Yup.string().trim().max(200).optional(),
  notes: Yup.string().trim().max(500).optional(),
  whatsappConsent: Yup.boolean().optional(),
});

export const WHATSAPP_CONSENT_REQUIRED_MESSAGE =
  'Debes aceptar las actualizaciones del pedido por WhatsApp para confirmar la compra';

export function createCheckoutSchema(whatsappOrderUpdatesRequired: boolean) {
  if (!whatsappOrderUpdatesRequired) return checkoutSchema;

  return checkoutSchema.shape({
    whatsappConsent: Yup.boolean()
      .oneOf([true], WHATSAPP_CONSENT_REQUIRED_MESSAGE)
      .required(WHATSAPP_CONSENT_REQUIRED_MESSAGE),
  });
}

export interface CheckoutFormValues {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfillmentMethod: 'pickup' | 'local_delivery' | 'national_shipping';
  shippingAddress: string;
  shippingDepartmentId: string;
  shippingDepartmentName: string;
  shippingCityId: string;
  shippingCityName: string;
  localDeliveryCity: string;
  deliveryNeighborhood: string;
  deliveryReference: string;
  notes: string;
  whatsappConsent: boolean;
}
