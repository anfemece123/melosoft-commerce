import * as Yup from 'yup';

export const storeSchema = Yup.object({
  name: Yup.string().trim().min(2, 'Mínimo 2 caracteres').max(100).required('El nombre es requerido'),
  slug: Yup.string()
    .trim()
    .lowercase()
    .matches(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones')
    .min(2)
    .max(60)
    .required('El slug es requerido'),
  description: Yup.string().trim().max(500).nullable(),
  whatsappNumber: Yup.string().trim().max(20).nullable(),
  supportEmail: Yup.string().trim().email('Email inválido').nullable(),
  instagramUrl: Yup.string().trim().url('URL inválida').nullable(),
  facebookUrl: Yup.string().trim().url('URL inválida').nullable(),
  tiktokUrl: Yup.string().trim().url('URL inválida').nullable(),
  country: Yup.string().trim().length(2).default('CO'),
  city: Yup.string().trim().max(100).nullable(),
  currency: Yup.string().trim().length(3).default('COP'),
  status: Yup.string().oneOf(['active', 'inactive', 'archived']).default('active'),
});
