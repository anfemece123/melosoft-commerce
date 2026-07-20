import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface AdminPanelShellProps {
  top: ReactNode;
  children: ReactNode;
  className?: string;
  topClassName?: string;
  contentClassName?: string;
}

export function AdminPanelShell({
  top,
  children,
  className,
  topClassName,
  contentClassName,
}: AdminPanelShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col overflow-hidden', className)}>
      <div
        className={cn(
          'shrink-0 bg-gray-50/95 pb-3 backdrop-blur supports-[backdrop-filter]:bg-gray-50/85',
          topClassName
        )}
      >
        {top}
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
