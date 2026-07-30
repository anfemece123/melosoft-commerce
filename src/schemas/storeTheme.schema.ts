import * as Yup from 'yup';

export const storeThemeSchema = Yup.object({
  mode: Yup.string().oneOf(['light', 'dark']).default('light'),
  primaryColor: Yup.string().trim().nullable(),
  secondaryColor: Yup.string().trim().nullable(),
  accentColor: Yup.string().trim().nullable(),
  backgroundColor: Yup.string().trim().nullable(),
  textColor: Yup.string().trim().nullable(),
  buttonRadius: Yup.string().trim().nullable(),
  templateKey: Yup.string().oneOf(['default']).default('default'),
  whatsappButtonEnabled: Yup.boolean().default(true),
  whatsappButtonColor: Yup.string().trim().nullable(),
  whatsappButtonLayout: Yup.string().oneOf(['floating', 'inline']).default('floating'),
});
