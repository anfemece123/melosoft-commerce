import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type MelosoftBrandVariant = 'logo' | 'mark';

interface MelosoftBrandProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  variant?: MelosoftBrandVariant;
}

const BRAND_ASSETS: Record<MelosoftBrandVariant, string> = {
  logo: '/branding/melosoft-logo.png',
  mark: '/branding/melosoft-mark.png',
};

export function MelosoftBrand({
  variant = 'logo',
  alt,
  className,
  ...props
}: MelosoftBrandProps) {
  return (
    <img
      src={BRAND_ASSETS[variant]}
      alt={alt ?? (variant === 'logo' ? 'Melosoft Commerce' : 'Melosoft')}
      className={cn('block select-none', className)}
      draggable={false}
      {...props}
    />
  );
}
