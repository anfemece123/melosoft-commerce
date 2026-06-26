import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppDispatch } from '@/app/hooks';
import { setUser, setProfile } from '@/features/auth/authSlice';
import { setMyMemberships } from '@/features/stores/storesSlice';
import { authService } from '@/features/auth/authService';
import { storesService } from '@/features/stores/storesService';
import { getPostLoginRedirect } from '@/utils/authRedirect';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const setPasswordSchema = Yup.object({
  password: Yup.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .required('La contraseña es obligatoria'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Las contraseñas no coinciden')
    .required('Confirma tu contraseña'),
});

interface SetPasswordFormValues {
  password: string;
  confirmPassword: string;
}

export function SetPasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const formik = useFormik<SetPasswordFormValues>({
    initialValues: { password: '', confirmPassword: '' },
    validationSchema: setPasswordSchema,
    onSubmit: async (values, { setStatus }) => {
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          password: values.password,
        });
        if (updateError) throw new Error(updateError.message);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No se encontró la sesión activa.');

        const [profile, memberships] = await Promise.all([
          authService.getCurrentProfile(user.id),
          storesService.getMyMemberships(),
        ]);

        dispatch(setUser({ id: user.id, email: user.email ?? '' }));
        dispatch(setProfile(profile));
        dispatch(setMyMemberships(memberships));

        navigate(getPostLoginRedirect(profile, memberships), { replace: true });
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Error al guardar la contraseña');
      }
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Crea tu contraseña</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Para acceder al panel de tu tienda necesitas establecer una contraseña.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={formik.handleSubmit} noValidate className="space-y-4">
            <Input
              id="password"
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              {...formik.getFieldProps('password')}
              error={formik.touched.password ? formik.errors.password : undefined}
            />

            <Input
              id="confirmPassword"
              label="Confirmar contraseña"
              type="password"
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              {...formik.getFieldProps('confirmPassword')}
              error={
                formik.touched.confirmPassword ? formik.errors.confirmPassword : undefined
              }
            />

            {typeof formik.status === 'string' && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formik.status}
              </p>
            )}

            <Button
              type="submit"
              isLoading={formik.isSubmitting}
              className="w-full mt-2"
            >
              Guardar contraseña y entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
