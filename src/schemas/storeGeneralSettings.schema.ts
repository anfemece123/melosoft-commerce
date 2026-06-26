import * as Yup from 'yup';

export const storeGeneralSettingsSchema = Yup.object({
  name: Yup.string().trim().min(2, 'Mínimo 2 caracteres').max(100).required('Nombre requerido'),
  slogan: Yup.string().trim().max(160).nullable(),
  description: Yup.string().trim().min(10, 'Mínimo 10 caracteres').max(1000).required('Descripción requerida'),
  whatsappNumber: Yup.string().trim().max(20).required('WhatsApp requerido'),
  supportEmail: Yup.string().trim().email('Email inválido').nullable(),
  city: Yup.string().trim().max(100).nullable(),
  heroTitle: Yup.string().trim().max(120).nullable(),
  heroSubtitle: Yup.string().trim().max(260).nullable(),
  heroCtaLabel: Yup.string().trim().max(40).nullable(),
  heroImageUrl: Yup.string().trim().url('Imagen principal inválida').nullable(),
  heroBackgroundImageUrl: Yup.string().trim().url('Imagen de fondo inválida').nullable(),
});

export type StoreGeneralSettingsFormValues = Yup.InferType<typeof storeGeneralSettingsSchema>;
