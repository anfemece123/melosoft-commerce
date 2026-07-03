import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { StorefrontTheme } from './storefrontTheme';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface StorefrontBreadcrumbsProps {
  items: BreadcrumbItem[];
  theme: StorefrontTheme;
  className?: string;
}

export function StorefrontBreadcrumbs({ items, theme, className = '' }: StorefrontBreadcrumbsProps) {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-1 text-[12px] font-medium ${className}`}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0" style={{ color: theme.mutedText }} />
            )}
            {!isLast && item.href ? (
              <Link
                to={item.href}
                className="transition-opacity hover:opacity-80 truncate max-w-[160px]"
                style={{ color: theme.mutedText }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className="truncate max-w-[200px]"
                style={{ color: isLast ? theme.text : theme.mutedText }}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
