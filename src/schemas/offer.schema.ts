import * as Yup from 'yup';
import type { CountdownMode } from '@/types/common.types';

export interface OfferFormValues {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  productId: string;
  regularPrice: number | '';
  offerPrice: number | '';
  countdownMode: CountdownMode;
  startsAt: string;
  endsAt: string;
  durationMinutes: number | '';
  showCountdown: boolean;
  isVisibleInStore: boolean;
  sortOrder: number | '';
  status: 'draft' | 'active';
  ctaLabel: string;
  whatsappNumber: string;
  whatsappMessage: string;
  termsAndConditions: string;
}

export const offerSchema = Yup.object({
  title: Yup.string().required('El título es requerido'),
  slug: Yup.string()
    .matches(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones')
    .required('El slug es requerido'),
  subtitle: Yup.string(),
  description: Yup.string().required('La descripción es requerida'),
  productId: Yup.string(),
  regularPrice: Yup.number().min(0, 'Debe ser mayor o igual a 0').nullable().optional(),
  offerPrice: Yup.number()
    .min(1, 'El precio de campaña debe ser mayor a 0')
    .required('El precio de campaña es requerido')
    .test(
      'offer-less-than-regular',
      'El precio de campaña debe ser menor al precio normal',
      function (value) {
        const rp = Number(this.parent.regularPrice);
        if (!value || !rp) return true;
        return value < rp;
      }
    ),
  countdownMode: Yup.string()
    .oneOf(['fixed_window', 'per_visitor'] as const)
    .required('Selecciona el tipo de contador'),
  startsAt: Yup.string(),
  endsAt: Yup.string().test(
    'ends-required-for-fixed',
    'La fecha de fin es requerida para ventana fija',
    function (value) {
      const { countdownMode, startsAt } = this.parent as OfferFormValues;
      if (countdownMode !== 'fixed_window') return true;
      if (!value) return this.createError({ message: 'La fecha de fin es requerida' });
      if (startsAt && value <= startsAt) {
        return this.createError({ message: 'La fecha de fin debe ser posterior a la de inicio' });
      }
      return true;
    }
  ),
  durationMinutes: Yup.number()
    .nullable()
    .optional()
    .test('duration-required', 'La duración es requerida para "por visitante"', function (value) {
      const { countdownMode } = this.parent as OfferFormValues;
      if (countdownMode !== 'per_visitor') return true;
      if (!value || value <= 0) {
        return this.createError({ message: 'La duración debe ser mayor a 0' });
      }
      return true;
    }),
  showCountdown: Yup.boolean().required(),
  isVisibleInStore: Yup.boolean().required(),
  sortOrder: Yup.number()
    .integer('Debe ser un número entero')
    .min(0, 'Debe ser mayor o igual a 0')
    .required('El orden de visualización es requerido'),
  status: Yup.string().oneOf(['draft', 'active'] as const).required(),
  ctaLabel: Yup.string().required('El texto del botón es requerido'),
  whatsappNumber: Yup.string(),
  whatsappMessage: Yup.string(),
  termsAndConditions: Yup.string(),
});
