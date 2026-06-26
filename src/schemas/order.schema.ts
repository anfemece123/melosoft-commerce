import * as Yup from 'yup';

export const orderSchema = Yup.object({
  customerName: Yup.string().trim().min(2).max(200).required('El nombre es requerido'),
  customerEmail: Yup.string().trim().email('Email inválido').nullable(),
  customerPhone: Yup.string().trim().min(7).max(20).required('El teléfono es requerido'),
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
  customerPhone: Yup.string()
    .trim()
    .min(7, 'Mínimo 7 dígitos')
    .max(20, 'Máximo 20 caracteres')
    .required('El teléfono es requerido'),
  customerEmail: Yup.string().trim().email('Email inválido').optional(),
  fulfillmentMethod: Yup.string()
    .oneOf(['delivery', 'pickup'] as const)
    .required(),
  shippingAddress: Yup.string()
    .trim()
    .max(300)
    .when('fulfillmentMethod', {
      is: 'delivery',
      then: (s) => s.required('La dirección es requerida para domicilio'),
      otherwise: (s) => s.optional(),
    }),
  deliveryNeighborhood: Yup.string().trim().max(100).optional(),
  deliveryReference: Yup.string().trim().max(200).optional(),
  notes: Yup.string().trim().max(500).optional(),
});

export interface CheckoutFormValues {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfillmentMethod: 'delivery' | 'pickup';
  shippingAddress: string;
  deliveryNeighborhood: string;
  deliveryReference: string;
  notes: string;
}
