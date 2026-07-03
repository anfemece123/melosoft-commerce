import type { ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

interface CartDrawerHeaderProps {
  theme: StorefrontTheme;
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  /** false hides both the back and close buttons (used while submitting). */
  showActions?: boolean;
}

export function CartDrawerHeader({ theme, title, icon, onClose, onBack, showActions = true }: CartDrawerHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: theme.border }}>
      {onBack && showActions && (
        <button type="button" onClick={onBack} aria-label="Volver" className="rounded-lg p-1 hover:opacity-70">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      {icon ? (
        <div className="flex flex-1 min-w-0 items-center gap-2">
          {icon}
          <h2 className="font-semibold truncate">{title}</h2>
        </div>
      ) : (
        <h2 className="font-semibold flex-1">{title}</h2>
      )}
      {showActions && (
        <button type="button" onClick={onClose} aria-label="Cerrar carrito" className="rounded-lg p-1.5 hover:opacity-70">
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
