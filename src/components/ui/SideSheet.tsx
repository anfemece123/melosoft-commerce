import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { cn } from '@/utils/cn';

type SideSheetWidth = 'md' | 'lg' | 'xl';

const widthClasses: Record<SideSheetWidth, string> = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
};

interface SideSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Plain-text title for screen readers when `title` is not a string. */
  ariaLabel?: string;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
  width?: SideSheetWidth;
  children: ReactNode;
  /** Extra key handling while open (e.g. ← → between records). */
  onKeyDown?: (event: KeyboardEvent) => void;
}

/** Right-side panel for details and filters in the admin. Portal-rendered,
 * page scroll frozen behind it, Esc / scrim to close, focus moved in and
 * returned to the trigger, enter/exit animation (GPU transform only). */
export function SideSheet({
  open,
  onClose,
  title,
  ariaLabel,
  subtitle,
  headerActions,
  footer,
  width = 'lg',
  children,
  onKeyDown,
}: SideSheetProps) {
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const requestClose = useEffectEvent(() => onClose());
  const forwardKey = useEffectEvent((event: KeyboardEvent) => onKeyDown?.(event));

  useBodyScrollLock(rendered);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      forwardKey(event);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!rendered) return null;
  const state = open ? 'open' : 'closed';

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="ui-scrim absolute inset-0 bg-gray-900/40" data-state={state} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-label={ariaLabel}
        data-state={state}
        onAnimationEnd={() => {
          if (!open) setRendered(false);
        }}
        className={cn(
          'ui-sheet absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl outline-none will-change-transform',
          widthClasses[width],
        )}
      >
        <div
          className="flex shrink-0 items-start gap-3 border-b border-gray-200 px-5 pb-3"
          style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}
        >
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>}
          </div>
          {headerActions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && (
          <div
            className="shrink-0 border-t border-gray-200 bg-white px-5 pt-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
