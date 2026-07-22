import * as Yup from 'yup';

export const whatsappSettingsSchema = Yup.object({
  enabled: Yup.boolean().default(false),
  customerOrderConfirmationEnabled: Yup.boolean().default(true),
  finalMessage: Yup.string().trim().max(300, 'Máximo 300 caracteres').nullable().default(null),
});

export type WhatsappSettingsFormValues = Yup.InferType<typeof whatsappSettingsSchema>;

export const whatsappTestSendSchema = Yup.object({
  phone: Yup.string().trim().min(7, 'Mínimo 7 dígitos').max(20).required('El teléfono es requerido'),
});

export type WhatsappTestSendFormValues = Yup.InferType<typeof whatsappTestSendSchema>;
