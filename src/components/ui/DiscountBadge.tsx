import { cn } from '@/utils/cn';

interface DiscountBadgeProps {
  percentage: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function DiscountBadge({ percentage, size = 'sm', className }: DiscountBadgeProps) {
  if (percentage <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full bg-red-500 text-white',
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2.5 py-1',
        className
      )}
    >
      -{percentage}%
    </span>
  );
}
