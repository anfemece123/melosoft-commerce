import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';

type AdminPanelLinkTab = {
  key: string;
  label: ReactNode;
  to: string;
  end?: boolean;
  badge?: ReactNode;
  onClick?: never;
  active?: never;
};

type AdminPanelButtonTab = {
  key: string;
  label: ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: ReactNode;
  to?: never;
  end?: never;
};

type AdminPanelTab = AdminPanelLinkTab | AdminPanelButtonTab;

interface AdminPanelTabsProps {
  items: AdminPanelTab[];
  className?: string;
}

const tabBaseClassName =
  'inline-flex items-center whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px';

function renderBadge(badge?: ReactNode) {
  if (!badge) return null;
  return <span className="ml-1.5">{badge}</span>;
}

export function AdminPanelTabs({ items, className }: AdminPanelTabsProps) {
  return (
    <div className={cn('mb-6 flex flex-wrap gap-1 border-b border-gray-200', className)}>
      {items.map((item) => {
        if (typeof item.to === 'string') {
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  tabBaseClassName,
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )
              }
            >
              {item.label}
              {renderBadge(item.badge)}
            </NavLink>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={cn(
              tabBaseClassName,
              item.active
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {item.label}
            {renderBadge(item.badge)}
          </button>
        );
      })}
    </div>
  );
}
