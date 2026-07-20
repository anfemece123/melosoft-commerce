import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { loginSchema } from '@/schemas/login.schema';
import type { LoginFormValues } from '@/schemas/login.schema';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  setUser,
  setAuthError,
  setAuthStatus,
  setBootstrapping,
  setProfile,
} from '@/features/auth/authSlice';
import { setMyMemberships } from '@/features/stores/storesSlice';
import { authService } from '@/features/auth/authService';
import { storesService } from '@/features/stores/storesService';
import { getPostLoginRedirect } from '@/utils/authRedirect';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MelosoftBrand } from '@/components/ui/MelosoftBrand';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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
      dispatch(setBootstrapping(true));
      let sessionWasCreated = false;

      try {
        const user = await authService.login(values);
        sessionWasCreated = true;

        const [loadedProfile, memberships] = await Promise.all([
          authService.getCurrentProfile(user.id),
          storesService.getMyMemberships(),
        ]);

        dispatch(setProfile(loadedProfile));
        dispatch(setMyMemberships(memberships));
        // Mark the session as ready only after its authorization context is loaded.
        dispatch(setUser(user));
      } catch (err) {
        // A valid auth session without its authorization context must not remain active,
        // otherwise route guards could interpret a backend error as missing permissions.
        if (sessionWasCreated) {
          try { await authService.logout(); } catch { /* preserve the original error */ }
        }

        const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
        dispatch(setAuthError(message));
        setStatus(message);
      } finally {
        dispatch(setBootstrapping(false));
      }
    },
  });

  if (isBootstrapping) return <LoadingScreen />;

  // Already logged in — redirect to the appropriate panel
  if (isAuthenticated) {
    return <Navigate to={getPostLoginRedirect(profile, myMemberships)} replace />;
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-100">
      <div
        className="absolute inset-0 bg-[url('/branding/login-background.png')] bg-cover bg-center"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/5 to-blue-950/15"
        aria-hidden="true"
      />

      <div className="relative flex min-h-screen items-center px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] xl:gap-20">
          <section className="hidden max-w-xl lg:block" aria-labelledby="login-brand-title">
            <MelosoftBrand className="h-auto w-64 xl:w-72" />

            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-indigo-600 shadow-[0_0_0_4px_rgba(79,70,229,0.12)]" />
              Plataforma de comercio
            </div>

            <h1
              id="login-brand-title"
              className="mt-6 max-w-lg text-5xl font-bold leading-[1.08] tracking-[-0.035em] text-slate-950 xl:text-6xl"
            >
              Tu comercio,
              <span className="block text-indigo-700">listo para crecer.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 xl:text-lg">
              Administra tus tiendas, productos, pedidos y pagos desde un solo lugar,
              con una experiencia clara y segura.
            </p>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
                Gestión multiempresa
              </span>
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
                Control centralizado
              </span>
            </div>
          </section>

          <section
            className="w-full rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_28px_90px_-28px_rgba(15,23,42,0.38)] backdrop-blur-xl sm:p-9"
            aria-labelledby="login-title"
          >
            <div className="mb-8 border-b border-slate-200/80 pb-7">
              <div className="mb-7 lg:hidden">
                <MelosoftBrand className="h-auto w-48" />
                <p className="mt-3 text-sm font-medium text-indigo-700">
                  Tu comercio, listo para crecer.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Acceso administrativo seguro
              </div>
              <h2
                id="login-title"
                className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]"
              >
                Bienvenido de nuevo
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Ingresa tus datos para continuar al panel de administración.
              </p>
            </div>

            <form onSubmit={formik.handleSubmit} noValidate className="space-y-5">
              <Input
                id="email"
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                placeholder="admin@ejemplo.com"
                className="h-12 rounded-xl px-4 text-[15px] shadow-none"
                {...formik.getFieldProps('email')}
                error={formik.touched.email ? formik.errors.email : undefined}
              />

              <Input
                id="password"
                label="Contraseña"
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-12 rounded-xl pl-4 pr-12 text-[15px] shadow-none"
                {...formik.getFieldProps('password')}
                error={formik.touched.password ? formik.errors.password : undefined}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
                    aria-label={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={isPasswordVisible}
                    title={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                }
              />

              {typeof formik.status === 'string' && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                >
                  {formik.status}
                </p>
              )}

              <Button
                type="submit"
                isLoading={formik.isSubmitting}
                className="mt-1 h-12 w-full rounded-xl shadow-lg shadow-indigo-600/20"
              >
                Iniciar sesión
              </Button>
            </form>

            <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Acceso exclusivo para usuarios autorizados</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
