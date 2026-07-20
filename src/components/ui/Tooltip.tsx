import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

type TooltipSide = 'top' | 'bottom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: TooltipProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setPosition({
        left: rect.left + rect.width / 2,
        top: side === 'top' ? rect.top - 10 : rect.bottom + 10,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, side]);

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              className={cn(
                'pointer-events-none fixed z-[100] max-w-64 -translate-x-1/2 rounded-xl border border-gray-200 bg-gray-950 px-3 py-2 text-xs leading-5 text-white shadow-2xl',
                side === 'top' ? '-translate-y-full' : 'translate-y-0',
                className,
              )}
              style={{ left: position.left, top: position.top }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
