import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-indigo-100 text-indigo-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

type OfferStatus = 'draft' | 'active' | 'paused' | 'expired' | 'sold_out' | 'archived';
type ProductStatus = 'active' | 'inactive' | 'archived';

const offerStatusMap: Record<OfferStatus, { variant: BadgeVariant; label: string }> = {
  draft: { variant: 'neutral', label: 'Borrador' },
  active: { variant: 'success', label: 'Activa' },
  paused: { variant: 'warning', label: 'Pausada' },
  expired: { variant: 'danger', label: 'Vencida' },
  sold_out: { variant: 'danger', label: 'Agotada' },
  archived: { variant: 'neutral', label: 'Archivada' },
};

const productStatusMap: Record<ProductStatus, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'success', label: 'Activo' },
  inactive: { variant: 'neutral', label: 'Inactivo' },
  archived: { variant: 'neutral', label: 'Archivado' },
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const { variant, label } = offerStatusMap[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { variant, label } = productStatusMap[status];
  return <Badge variant={variant}>{label}</Badge>;
}
