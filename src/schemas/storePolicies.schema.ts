import * as Yup from 'yup';

export const storePoliciesSchema = Yup.object({
  shippingPolicy: Yup.string().trim().nullable(),
  returnsPolicy: Yup.string().trim().nullable(),
  warrantyPolicy: Yup.string().trim().nullable(),
  privacyPolicy: Yup.string().trim().nullable(),
  termsAndConditions: Yup.string().trim().nullable(),
});
