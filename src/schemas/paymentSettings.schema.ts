import * as Yup from 'yup';

export const wompiSettingsSchema = Yup.object({
  environment: Yup.string().oneOf(['sandbox', 'production']).required().default('sandbox'),
  publicKey: Yup.string().trim().nullable().default(null),
  privateKey: Yup.string().trim().nullable().default(null),
  integritySecret: Yup.string().trim().nullable().default(null),
  eventsSecret: Yup.string().trim().nullable().default(null),
  isActive: Yup.boolean().default(false),
});

export type WompiSettingsFormValues = Yup.InferType<typeof wompiSettingsSchema>;
