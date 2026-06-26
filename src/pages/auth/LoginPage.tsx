import { Navigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { Tag } from 'lucide-react';
import { loginSchema } from '@/schemas/login.schema';
import type { LoginFormValues } from '@/schemas/login.schema';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setUser, setAuthError, setAuthStatus, setProfile } from '@/features/auth/authSlice';
import { setMyMemberships } from '@/features/stores/storesSlice';
import { authService } from '@/features/auth/authService';
import { storesService } from '@/features/stores/storesService';
import { getPostLoginRedirect } from '@/utils/authRedirect';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const isBootstrapping = useAppSelector((s) => s.auth.isBootstrapping);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const profile = useAppSelector((s) => s.auth.profile);
  const myMemberships = useAppSelector((s) => s.stores.myMemberships);

  // useFormik must be called before any early returns to satisfy hooks rules
  const formik = useFormik<LoginFormValues>({
    initialValues: { email: '', password: '' },
    validationSchema: loginSchema,
    onSubmit: async (values, { setStatus }) => {
      dispatch(setAuthStatus('loading'));
      try {
        const user = await authService.login(values);
        dispatch(setUser(user));
        const [loadedProfile, memberships] = await Promise.all([
          authService.getCurrentProfile(user.id),
          storesService.getMyMemberships(),
        ]);
        dispatch(setProfile(loadedProfile));
        dispatch(setMyMemberships(memberships));
        // isAuthenticated flips to true → the Navigate below takes over on re-render
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
        dispatch(setAuthError(message));
        setStatus(message);
      }
    },
  });

  if (isBootstrapping) return <LoadingScreen />;

  // Already logged in — redirect to the appropriate panel
  if (isAuthenticated) {
    return <Navigate to={getPostLoginRedirect(profile, myMemberships)} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <Tag className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Melosoft Commerce</h1>
          <p className="text-sm text-gray-500 mt-1">Panel administrativo</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Iniciar sesión</h2>

          <form onSubmit={formik.handleSubmit} noValidate className="space-y-4">
            <Input
              id="email"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              placeholder="admin@ejemplo.com"
              {...formik.getFieldProps('email')}
              error={formik.touched.email ? formik.errors.email : undefined}
            />

            <Input
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...formik.getFieldProps('password')}
              error={formik.touched.password ? formik.errors.password : undefined}
            />

            {typeof formik.status === 'string' && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formik.status}
              </p>
            )}

            <Button type="submit" isLoading={formik.isSubmitting} className="w-full mt-2">
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
