import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  actions,
  sticky = true,
  className,
}: PageHeaderProps) {
  const actionContent = action ?? actions;
  return (
    <div
      className={cn(
        'mb-6 flex items-start justify-between gap-4',
        sticky && 'sticky top-0 z-10 bg-gray-50/95 py-1 backdrop-blur supports-[backdrop-filter]:bg-gray-50/85',
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {actionContent && <div className="flex items-center gap-2 shrink-0">{actionContent}</div>}
    </div>
  );
}
