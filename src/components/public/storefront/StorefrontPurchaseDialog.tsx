import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import type { StorefrontTheme } from './storefrontTheme';
import { StorefrontActionButton } from './StorefrontActionButton';
import { formatCurrency } from '@/utils/formatCurrency';

interface StorefrontPurchaseDialogProps {
  open: boolean;
  theme: StorefrontTheme;
  currency: string;
  title: string;
  totalPrice: number;
  instructionsLabel: string;
  instructionsPlaceholder: string;
  instructionsMaxLength: number;
  instructionsValue: string;
  onInstructionsChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function StorefrontPurchaseDialog({
  open,
  theme,
  currency,
  title,
  totalPrice,
  instructionsLabel,
  instructionsPlaceholder,
  instructionsMaxLength,
  instructionsValue,
  onInstructionsChange,
  onClose,
  onConfirm,
}: StorefrontPurchaseDialogProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-[28px] border px-5 pb-5 pt-4 shadow-2xl sm:rounded-[28px]"
        style={{ borderColor: theme.border, backgroundColor: theme.background, color: theme.text }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.primary }}>
              Confirmar pedido
            </p>
            <h3 className="mt-1 text-xl font-bold">{title}</h3>
            <p className="mt-2 text-sm" style={{ color: theme.mutedText }}>
              Total estimado: {formatCurrency(totalPrice, 'es-CO', currency)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
            style={{ borderColor: theme.border, backgroundColor: theme.surface }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: theme.border, backgroundColor: theme.surfaceAlt }}
        >
          <label className="mb-2 block text-sm font-semibold">
            {instructionsLabel}
          </label>
          <textarea
            value={instructionsValue}
            maxLength={instructionsMaxLength}
            onChange={(event) => onInstructionsChange(event.target.value)}
            placeholder={instructionsPlaceholder}
            className="min-h-[120px] w-full rounded-2xl border px-3 py-3 text-sm outline-none transition-colors"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.surface,
              color: theme.text,
            }}
          />
          <div className="mt-2 text-right text-xs" style={{ color: theme.mutedText }}>
            {instructionsValue.length}/{instructionsMaxLength}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <StorefrontActionButton
            as="button"
            type="button"
            variant="outline"
            theme={theme}
            fullWidth
            className="py-3"
            onClick={onClose}
          >
            Cancelar
          </StorefrontActionButton>
          <StorefrontActionButton
            as="button"
            type="button"
            variant="whatsapp"
            theme={theme}
            fullWidth
            className="gap-2 py-3"
            onClick={onConfirm}
          >
            <MessageCircle className="h-5 w-5" />
            Enviar pedido
          </StorefrontActionButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
