import * as Yup from 'yup';
import {
  RESERVED_STOREFRONT_SUBDOMAINS,
  STOREFRONT_SUBDOMAIN_PATTERN,
} from '@/lib/storefront/storefrontSubdomains';

export const storeSchema = Yup.object({
  name: Yup.string().trim().min(2, 'Mínimo 2 caracteres').max(100).required('El nombre es requerido'),
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
