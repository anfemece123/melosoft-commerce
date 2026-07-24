import { useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={isLoading ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          aria-label="Cerrar"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-4">
          <div className={[
            'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            variant === 'danger' ? 'bg-red-100' : 'bg-amber-100',
          ].join(' ')}>
            <AlertTriangle className={[
              'w-5 h-5',
              variant === 'danger' ? 'text-red-600' : 'text-amber-600',
            ].join(' ')} />
          </div>
          <div>
            <h3 id={titleId} className="font-semibold text-gray-900 mb-1">{title}</h3>
            <p id={messageId} className="text-sm text-gray-500">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="outline" disabled={isLoading} onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
