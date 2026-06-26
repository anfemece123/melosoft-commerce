import type { ButtonHTMLAttributes, CSSProperties, MouseEventHandler, ReactNode } from 'react';
import type { StorefrontTheme } from './storefrontTheme';

type StorefrontActionButtonVariant = 'primary' | 'outline' | 'whatsapp';
type StorefrontActionButtonElement = 'a' | 'button' | 'div';

interface StorefrontActionButtonProps {
  theme: StorefrontTheme;
  children: ReactNode;
  variant?: StorefrontActionButtonVariant;
  as?: StorefrontActionButtonElement;
  href?: string;
  target?: string;
  rel?: string;
  className?: string;
  fullWidth?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement | HTMLDivElement>;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
}

export function StorefrontActionButton({
  theme,
  children,
  variant = 'primary',
  as = 'button',
  href,
  target,
  rel,
  className = '',
  fullWidth = false,
  onClick,
  type = 'button',
}: StorefrontActionButtonProps) {
  const Component = as;
  const isPrimary = variant === 'primary';
  const isWhatsapp = variant === 'whatsapp';

  const baseClassName = [
    'inline-flex items-center justify-center rounded-full border font-medium transition-colors duration-200',
    'border-[var(--storefront-border-color)] bg-[var(--storefront-bg-color)] text-[var(--storefront-text-color)]',
    'hover:border-[var(--storefront-hover-color)] hover:bg-[var(--storefront-hover-color)] hover:text-white',
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ').trim();

  const style = {
    ['--storefront-hover-color' as string]: isWhatsapp ? '#22c55e' : theme.primary,
    ['--storefront-border-color' as string]: isPrimary || isWhatsapp
      ? (isWhatsapp ? '#22c55e' : theme.primary)
      : (theme.mode === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(17,24,39,0.18)'),
    ['--storefront-bg-color' as string]: isPrimary ? theme.primary : isWhatsapp ? '#22c55e' : 'transparent',
    ['--storefront-text-color' as string]: isPrimary || isWhatsapp ? '#ffffff' : theme.mode === 'dark' ? '#ffffff' : theme.text,
  } as CSSProperties;

  if (Component === 'a') {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        onClick={onClick as MouseEventHandler<HTMLAnchorElement> | undefined}
        className={baseClassName}
        style={style}
      >
        {children}
      </a>
    );
  }

  if (Component === 'button') {
    return (
      <button
        type={type}
        onClick={onClick as MouseEventHandler<HTMLButtonElement> | undefined}
        className={baseClassName}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      onClick={onClick as MouseEventHandler<HTMLDivElement> | undefined}
      className={baseClassName}
      style={style}
    >
      {children}
    </div>
  );
}
