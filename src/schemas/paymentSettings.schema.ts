import * as Yup from 'yup';

export const paymentSettingsSchema = Yup.object({
  publicKey: Yup.string().trim().nullable(),
  privateKeyReference: Yup.string().trim().max(200).nullable(),
  integritySecretReference: Yup.string().trim().max(200).nullable(),
  environment: Yup.string().oneOf(['sandbox', 'production']).default('sandbox'),
  isActive: Yup.boolean().default(false),
});
