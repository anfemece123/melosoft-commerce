import * as Yup from 'yup';

export const loginSchema = Yup.object({
  email: Yup.string()
    .email('Correo electrónico inválido')
    .required('El correo es requerido'),
  password: Yup.string()
    .min(6, 'Mínimo 6 caracteres')
    .required('La contraseña es requerida'),
});

export type LoginFormValues = Yup.InferType<typeof loginSchema>;
