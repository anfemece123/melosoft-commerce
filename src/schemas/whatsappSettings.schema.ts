import * as Yup from 'yup';
import { colombianMobilePhoneSchema } from './phone.schema';

export const whatsappSettingsSchema = Yup.object({
  enabled: Yup.boolean().default(false),
  customerOrderConfirmationEnabled: Yup.boolean().default(true),
  fulfillmentUpdateEnabled: Yup.boolean().default(false),
  orderDeliveredEnabled: Yup.boolean().default(false),
  orderCancelledEnabled: Yup.boolean().default(false),
  finalMessage: Yup.string().trim().max(300, 'Máximo 300 caracteres').nullable().default(null),
});

export type WhatsappSettingsFormValues = Yup.InferType<typeof whatsappSettingsSchema>;

export const whatsappTestSendSchema = Yup.object({
  phone: colombianMobilePhoneSchema.required('El celular es requerido'),
});

export type WhatsappTestSendFormValues = Yup.InferType<typeof whatsappTestSendSchema>;
