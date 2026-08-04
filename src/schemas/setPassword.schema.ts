import * as Yup from 'yup';
import { getOwnerPasswordValidationError } from '@/lib/auth/ownerPassword';

export const setPasswordSchema = Yup.object({
  password: Yup.string()
    .required('La contraseña es obligatoria')
    .test(
      'strong-owner-password',
      'La contraseña no cumple los requisitos',
      (value, context) => {
        if (!value) return true;
        const validationError = getOwnerPasswordValidationError(value);
        return validationError ? context.createError({ message: validationError }) : true;
      },
    ),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Las contraseñas no coinciden')
    .required('Confirma tu contraseña'),
});

export type SetPasswordFormValues = Yup.InferType<typeof setPasswordSchema>;
