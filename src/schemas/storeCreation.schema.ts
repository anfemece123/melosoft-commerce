import * as Yup from 'yup';

const businessHourSchema = Yup.object({
  dayOfWeek: Yup.number().min(0).max(6).required(),
  isOpen: Yup.boolean().required(),
  opensAt: Yup.string()
    .nullable()
    .when('isOpen', {
      is: true,
      then: (s) => s.required('Hora de apertura requerida si el día está abierto'),
      otherwise: (s) => s.nullable(),
    }),
  closesAt: Yup.string()
    .nullable()
    .when('isOpen', {
      is: true,
      then: (s) => s.required('Hora de cierre requerida si el día está abierto'),
      otherwise: (s) => s.nullable(),
    }),
  breakStartsAt: Yup.string().nullable(),
  breakEndsAt: Yup.string().nullable(),
});

export const storeCreationSchema = Yup.object({
  // Section 1 — Owner
  ownerFullName: Yup.string().trim().min(2, 'Mínimo 2 caracteres').max(120).required('Nombre del propietario requerido'),
  ownerEmail: Yup.string().trim().email('Email inválido').required('Email del propietario requerido'),
  ownerPhone: Yup.string().trim().max(20).required('Teléfono del propietario requerido'),
  ownerDocumentType: Yup.string().trim().max(20).nullable(),
  ownerDocumentNumber: Yup.string().trim().max(30).nullable(),

  // Section 2 — Company info
  name: Yup.string().trim().min(2, 'Mínimo 2 caracteres').max(100).required('Nombre de la empresa requerido'),
  slug: Yup.string()
    .trim()
    .lowercase()
    .matches(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones')
    .min(2, 'Mínimo 2 caracteres')
    .max(60, 'Máximo 60 caracteres')
    .required('Slug requerido'),
  slogan: Yup.string().trim().max(160).nullable(),
  businessType: Yup.string()
    .oneOf(
      ['barberia', 'restaurante', 'moda', 'tecnologia', 'mascotas', 'hogar', 'belleza', 'salud', 'otro'],
      'Tipo de negocio inválido'
    )
    .required('Tipo de negocio requerido'),
  description: Yup.string().trim().min(10, 'Mínimo 10 caracteres').max(1000).required('Descripción requerida'),
  logoUrl: Yup.string().trim().url('Logo inválido').nullable(),
  supportEmail: Yup.string().trim().email('Email inválido').nullable(),
  whatsappNumber: Yup.string().trim().max(20).required('Número de WhatsApp requerido'),
  country: Yup.string().trim().length(2, 'Código de 2 letras').required('País requerido'),
  city: Yup.string().trim().max(100).required('Ciudad requerida'),
  currency: Yup.string().trim().length(3, 'Código de 3 letras').required('Moneda requerida'),

  // Section 3 — Design
  mode: Yup.string().oneOf(['light', 'dark']).required('Modo de tema requerido'),
  themePreset: Yup.string()
    .oneOf(['blue', 'violet', 'emerald', 'rose', 'amber', 'slate'])
    .required('Paleta de colores requerida'),

  // Section 4 — Location (address optional, dept/city required)
  locationAddressLine: Yup.string().trim().max(200).nullable(),
  locationNeighborhood: Yup.string().trim().max(100).nullable(),
  locationDepartment: Yup.string().trim().min(1, 'Departamento requerido').max(100).required('Departamento requerido'),
  locationCity: Yup.string().trim().min(1, 'Ciudad requerida').max(100).required('Ciudad requerida'),
  locationPostalCode: Yup.string().trim().max(20).nullable(),
  locationIsPublic: Yup.boolean().required(),

  // Section 5 — Business hours
  businessHours: Yup.array().of(businessHourSchema).min(7).max(7).required(),

  // Section 6 — Policies
  usePolicyDefaults: Yup.boolean().required(),
  shippingPolicy: Yup.string().trim().max(3000).nullable(),
  returnsPolicy: Yup.string().trim().max(3000).nullable(),
  warrantyPolicy: Yup.string().trim().max(3000).nullable(),
  privacyPolicy: Yup.string().trim().max(3000).nullable(),
  termsAndConditions: Yup.string().trim().max(3000).nullable(),
});

export type StoreCreationFormValues = Yup.InferType<typeof storeCreationSchema>;
