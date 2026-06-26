import { toast, type ExternalToast } from 'sonner';
import { mapSupabaseError } from './errors/supabaseErrorMapper';

export const notify = {
  success(message: string, options?: ExternalToast) {
    toast.success(message, options);
  },

  cartSuccess(message: string, options?: ExternalToast) {
    toast.success(message, {
      position: 'bottom-center',
      duration: 2200,
      ...options,
    });
  },

  error(message: string, options?: ExternalToast) {
    toast.error(message, options);
  },

  info(message: string, options?: ExternalToast) {
    toast.info(message, options);
  },

  warning(message: string, options?: ExternalToast) {
    toast.warning(message, options);
  },

  fromError(err: unknown, fallback?: string) {
    const message = mapSupabaseError(err) || fallback || 'Ocurrió un error inesperado.';
    toast.error(message);
  },
};
