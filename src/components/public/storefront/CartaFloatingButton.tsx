import { Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import type { StorefrontTheme } from './storefrontTheme';

interface CartaFloatingButtonProps {
  href: string;
  theme: StorefrontTheme;
}

/** Site-wide entry point to the "Carta digital" visual menu, shown only
 * when the store owner opts in (store_carta_settings.listed_in_storefront).
 * Mirrors WhatsappFloatingButton's floating placement/behavior. */
export function CartaFloatingButton({ href, theme }: CartaFloatingButtonProps) {
  return (
    <Link
      to={href}
      aria-label="Ver la carta digital"
      className="fixed bottom-5 left-5 z-30 inline-flex h-14 w-14 items-center justify-center gap-2 rounded-full px-0 text-sm font-semibold shadow-xl transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:bottom-6 sm:left-6 sm:w-auto sm:px-4"
      style={{ backgroundColor: theme.primary, color: '#fff', boxShadow: `0 12px 30px -8px ${theme.primary}aa` }}
    >
      <UtensilsCrossed className="h-6 w-6 shrink-0" />
      <span className="hidden pr-1 sm:inline">Ver la carta</span>
    </Link>
  );
}
