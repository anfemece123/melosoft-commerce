import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface OwnerCredentialsDialogProps {
  open: boolean;
  storeName: string;
  email: string;
  password: string;
  onContinue: () => void;
}

export function OwnerCredentialsDialog({
  open,
  storeName,
  email,
  password,
  onContinue,
}: OwnerCredentialsDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  if (!open) return null;

  async function handleCopy() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(`Email: ${email}\nContraseña: ${password}`);
      setCopied(true);
    } catch {
      setCopyError('No se pudo copiar automáticamente. Muestra la contraseña y cópiala manualmente.');
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-2xl border border-white/70 bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-950">
              Empresa y acceso creados
            </h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-500">
              {storeName} ya está lista. Entrega estas credenciales al propietario por un canal seguro.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Email</p>
            <p className="mt-1 break-all text-sm font-medium text-slate-800">{email}</p>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Contraseña inicial
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <code className="min-w-0 break-all text-sm font-semibold text-slate-900">
                {passwordVisible ? password : '••••••••••••••••'}
              </code>
              <button
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {passwordVisible
                  ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                  : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-xs leading-5 text-amber-800">
            Esta contraseña no se guarda en la información de la empresa y dejará de mostrarse al continuar.
          </p>
        </div>

        {copyError && (
          <p role="alert" className="mt-3 text-xs leading-5 text-red-600">{copyError}</p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            leftIcon={copied
              ? <Check className="h-4 w-4 text-emerald-600" />
              : <Copy className="h-4 w-4" />}
            onClick={() => void handleCopy()}
          >
            {copied ? 'Credenciales copiadas' : 'Copiar credenciales'}
          </Button>
          <Button type="button" onClick={onContinue}>
            Continuar al panel
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
