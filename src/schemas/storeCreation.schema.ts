import * as Yup from 'yup';
import { THEME_PRESET_LIST } from '@/utils/themePresets';
import {
  RESERVED_STOREFRONT_SUBDOMAINS,
  STOREFRONT_SUBDOMAIN_MAX_LENGTH,
  STOREFRONT_SUBDOMAIN_MIN_LENGTH,
  STOREFRONT_SUBDOMAIN_PATTERN,
  isAllNumericStorefrontSubdomain,
} from '@/lib/storefront/storefrontSubdomains';
import { getOwnerPasswordValidationError } from '@/lib/auth/ownerPassword';
import { colombianMobilePhoneSchema } from './phone.schema';

const timeSchema = Yup.string()
  .matches(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa una hora válida')
  .nullable();

const businessHourSchema = Yup.object({
  dayOfWeek: Yup.number().min(0).max(6).required(),
  isOpen: Yup.boolean().required(),
  opensAt: timeSchema
    .when('isOpen', {
      is: true,
      then: (s) => s.required('Hora de apertura requerida si el día está abierto'),
      otherwise: (s) => s.nullable(),
    }),
  closesAt: timeSchema
    .when('isOpen', {
      is: true,
      then: (s) => s.required('Hora de cierre requerida si el día está abierto'),
      otherwise: (s) => s.nullable(),
    }),
  breakStartsAt: timeSchema,
  breakEndsAt: timeSchema,
}).test('valid-business-hours', function validateBusinessHours(value) {
  if (!value?.isOpen || !value.opensAt || !value.closesAt) return true;

  if (value.opensAt >= value.closesAt) {
    return this.createError({
      path: `${this.path}.closesAt`,
      message: 'La hora de cierre debe ser posterior a la apertura',
    });
  }

  const hasBreakStart = Boolean(value.breakStartsAt);
  const hasBreakEnd = Boolean(value.breakEndsAt);
  if (hasBreakStart !== hasBreakEnd) {
    return this.createError({
      path: `${this.path}.${hasBreakStart ? 'breakEndsAt' : 'breakStartsAt'}`,
      message: 'Completa las dos horas del cierre intermedio',
    });
  }

  if (value.breakStartsAt && value.breakEndsAt && !(
    value.opensAt < value.breakStartsAt
    && value.breakStartsAt < value.breakEndsAt
    && value.breakEndsAt < value.closesAt
  )) {
    return this.createError({
      path: `${this.path}.breakStartsAt`,
      message: 'El cierre intermedio debe quedar dentro del horario del día',
    });
  }

  return true;
});

export const storeCreationSchema = Yup.object({
  // Section 1 — Owner
  ownerFullName: Yup.string().trim().min(2, 'Mínimo 2 caracteres').max(120).required('Nombre del propietario requerido'),
  ownerEmail: Yup.string().trim().email('Email inválido').required('Email del propietario requerido'),
  ownerPhone: colombianMobilePhoneSchema.required('Celular del propietario requerido'),
  ownerDocumentType: Yup.string().trim().max(20).nullable(),
  ownerDocumentNumber: Yup.string().trim().max(30).nullable(),
  ownerAccessMode: Yup.string()
    .oneOf(['invitation', 'password'], 'Método de acceso inválido')
    .required('Selecciona cómo accederá el propietario'),
  ownerPassword: Yup.string()
    .default('')
    .when('ownerAccessMode', {
      is: 'password',
      then: (schema) => schema
        .required('Define una contraseña para el propietario')
        .test(
          'strong-owner-password',
          'La contraseña no cumple los requisitos',
          (value, context) => {
            if (!value) return true;
            const validationError = getOwnerPasswordValidationError(value);
            return validationError ? context.createError({ message: validationError }) : true;
          }
        ),
      otherwise: (schema) => schema,
    }),
  ownerPasswordConfirm: Yup.string()
    .default('')
    .when('ownerAccessMode', {
      is: 'password',
      then: (schema) => schema
        .required('Confirma la contraseña')
        .oneOf([Yup.ref('ownerPassword')], 'Las contraseñas no coinciden'),
      otherwise: (schema) => schema,
    }),

  // Section 2 — Company info
  name: Yup.string().trim().min(2, 'Mínimo 2 caracteres').max(100).required('Nombre de la empresa requerido'),
  slug: Yup.string()
    .trim()
    .lowercase()
    .matches(
      STOREFRONT_SUBDOMAIN_PATTERN,
      'Usa letras minúsculas, números o guiones; no empieces ni termines con guion',
    )
    .test(
      'not-reserved-subdomain',
      'Ese nombre está reservado por la plataforma',
      (value) => !value || !RESERVED_STOREFRONT_SUBDOMAINS.has(value),
    )
    .test(
      'not-all-numeric',
      'No puede ser solo números',
      (value) => !value || !isAllNumericStorefrontSubdomain(value),
    )
    .min(STOREFRONT_SUBDOMAIN_MIN_LENGTH, `Mínimo ${STOREFRONT_SUBDOMAIN_MIN_LENGTH} caracteres`)
    .max(STOREFRONT_SUBDOMAIN_MAX_LENGTH, `Máximo ${STOREFRONT_SUBDOMAIN_MAX_LENGTH} caracteres`)
    .required('URL de la tienda requerida'),
  slogan: Yup.string().trim().max(160).nullable(),
  businessVertical: Yup.string()
    .oneOf(
      ['food_restaurant', 'retail_products', 'catalog_quote', 'real_estate'],
      'Tipo de empresa inválido'
    )
    .required('Tipo de empresa requerido'),
  businessSubcategory: Yup.string().trim().max(60).required('Subcategoría requerida'),
  description: Yup.string().trim().min(10, 'Mínimo 10 caracteres').max(1000).required('Descripción requerida'),
  logoUrl: Yup.string().trim().url('Logo inválido').nullable(),
  supportEmail: Yup.string().trim().email('Email inválido').nullable(),
  whatsappNumber: colombianMobilePhoneSchema.required('Número de WhatsApp requerido'),
  country: Yup.string().oneOf(['CO'], 'Por ahora solo está disponible Colombia').required('País requerido'),
  currency: Yup.string().oneOf(['COP'], 'Por ahora solo está disponible COP').required('Moneda requerida'),

  // Section 3 — Design
  mode: Yup.string().oneOf(['light', 'dark'], 'Modo de tema inválido.').required('Modo de tema requerido'),
  themePreset: Yup.string()
    .oneOf(THEME_PRESET_LIST.map((p) => p.key), 'Selecciona un tema válido.')
    .required('Selecciona un tema de color.'),

  // Section 4 — Location (address optional, dept/city required)
  locationAddressLine: Yup.string().trim().max(200).nullable(),
  locationNeighborhood: Yup.string().trim().max(100).nullable(),
  locationDepartment: Yup.string().trim().min(1, 'Departamento requerido').max(100).required('Departamento requerido'),
  locationCity: Yup.string().trim().min(1, 'Ciudad requerida').max(100).required('Ciudad requerida'),
  locationPostalCode: Yup.string().trim().max(20).nullable(),
  locationIsPublic: Yup.boolean().required(),

  // Section 5 — Business hours (optional — can be configured later from store settings)
  businessHours: Yup.array().of(businessHourSchema).required(),

  // Section 6 — Policies
  shippingPolicy: Yup.string().trim().max(3000).nullable(),
  returnsPolicy: Yup.string().trim().max(3000).nullable(),
  warrantyPolicy: Yup.string().trim().max(3000).nullable(),
  privacyPolicy: Yup.string().trim().max(3000).nullable(),
  termsAndConditions: Yup.string().trim().max(3000).nullable(),
});

export type StoreCreationFormValues = Yup.InferType<typeof storeCreationSchema>;
