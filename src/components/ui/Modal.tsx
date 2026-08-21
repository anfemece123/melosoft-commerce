import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

type ModalMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  maxWidth?: ModalMaxWidth;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  dismissible?: boolean;
  className?: string;
}

const maxWidthClasses: Record<ModalMaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  maxWidth = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  dismissible = true,
  className,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeHandlerRef = useRef(onClose);

  useEffect(() => {
    closeHandlerRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const panel = panelRef.current;

    document.body.style.overflow = 'hidden';

    const focusPanel = window.requestAnimationFrame(() => panel?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      // A crop/editor dialog can be portaled outside this panel while it is
      // open. Let that higher-priority dialog own Escape and focus handling.
      if (event.target instanceof Element && event.target.closest('[data-dialog-layer="nested"]')) return;

      if (event.key === 'Escape' && closeOnEscape && dismissible) {
        event.preventDefault();
        closeHandlerRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panel) return;
      const focusableElements = getFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusPanel);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [closeOnEscape, dismissible, open]);

  if (!open) return null;

  function handleBackdropClick() {
    if (closeOnBackdrop && dismissible) closeHandlerRef.current();
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl',
          maxWidthClasses[maxWidth],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            {description && <p id={descriptionId} className="mt-1 text-sm leading-5 text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={() => closeHandlerRef.current()}
            disabled={!dismissible}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && <div className="border-t border-slate-100 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
