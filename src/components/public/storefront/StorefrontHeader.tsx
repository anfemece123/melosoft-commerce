import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Search, ShoppingCart, X } from 'lucide-react';
import { PublicStoreLogo } from './PublicStoreLogo';
import type { StorefrontTheme } from './storefrontTheme';

function withOpacity(color: string, alpha: number) {
  if (!color.startsWith('#')) return color;
  const hex = color.slice(1);
  const normalized = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex.slice(0, 6);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface StorefrontHeaderProps {
  theme: StorefrontTheme;
  storeName: string;
  storeSlug: string;
  logoUrl: string | null;
  searchPlaceholder: string;
  catalogLabel: string;
  whatsappHref: string | null;
  hasHero?: boolean;
  showCart?: boolean;
  cartCount?: number;
  onCartOpen?: () => void;
}

export function StorefrontHeader({
  theme,
  storeName,
  storeSlug,
  logoUrl,
  searchPlaceholder,
  catalogLabel,
  hasHero = true,
  showCart = false,
  cartCount = 0,
  onCartOpen,
}: StorefrontHeaderProps) {
  const navItems = [
    { href: hasHero ? '#storefront-hero' : '#storefront-overview', label: 'Inicio' },
    { href: '#storefront-catalog', label: isMenuLabel(catalogLabel) ? 'Menu' : catalogLabel },
    { href: `/s/${storeSlug}/policies`, label: 'Rastrear Pedido', isRoute: true },
  ];
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerBackground = hasHero
    ? (isScrolled ? withOpacity(theme.background, theme.mode === 'dark' ? 0.92 : 0.9) : 'transparent')
    : theme.background;
  const controlBackground = theme.mode === 'dark'
    ? withOpacity(theme.background, 0.72)
    : withOpacity(theme.background, 0.92);
  const controlBorder = withOpacity(theme.text, theme.mode === 'dark' ? 0.12 : 0.08);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 12);
      if (window.scrollY > 12) {
        setMobileMenuOpen(false);
      }
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={[
        hasHero ? 'fixed inset-x-0 top-0 z-50 transition-colors duration-300' : 'sticky top-0 z-50 border-b transition-colors duration-300',
      ].join(' ')}
      style={{
        borderBottom: isScrolled || !hasHero ? `1px solid ${theme.border}` : '1px solid transparent',
        backdropFilter: hasHero && isScrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: hasHero && isScrolled ? 'blur(20px)' : 'none',
        backgroundColor: headerBackground,
        boxShadow: isScrolled || !hasHero ? `0 12px 30px ${theme.shadow}` : 'none',
      }}
    >
      <div>
        <div className="relative mx-auto max-w-7xl px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div className="min-w-0">
              <Link to={`/s/${storeSlug}`} className="flex shrink-0 items-center gap-3 md:gap-4">
                <PublicStoreLogo
                  logoUrl={logoUrl}
                  storeName={storeName}
                  sizeClassName="h-[52px] w-[52px] md:h-[64px] md:w-[64px]"
                  fallbackColor={theme.primary}
                  outerClassName="border shadow-sm"
                  outerStyle={{
                    borderColor: controlBorder,
                    backgroundColor: controlBackground,
                    boxShadow: `0 10px 24px ${theme.shadow}`,
                  }}
                />
                <span
                  className="truncate text-[22px] font-semibold leading-none tracking-[-0.03em] md:text-[26px]"
                  style={{ color: theme.mode === 'dark' ? theme.text : '#1f2937' }}
                >
                  {storeName}
                </span>
              </Link>
            </div>

            <nav className="hidden flex-wrap items-center justify-center gap-6 lg:flex">
              {navItems.map((item, index) =>
                item.isRoute ? (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="text-[12px] font-medium"
                    style={{ color: index === 0 ? theme.primary : theme.mode === 'dark' ? 'rgba(226,232,240,0.78)' : '#6b7280' }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    className="text-[12px] font-medium"
                    style={{ color: index === 0 ? theme.primary : theme.mode === 'dark' ? 'rgba(226,232,240,0.78)' : '#6b7280' }}
                  >
                    {item.label}
                  </a>
                )
              )}
            </nav>

            <div className="relative flex items-center justify-end gap-2 md:gap-3">
              <div className="relative hidden w-full min-w-[190px] max-w-[250px] lg:block">
                <input
                  readOnly
                  value={searchPlaceholder}
                  className="h-10 w-full rounded-md border pl-4 pr-10 text-[12px] outline-none"
                  style={{
                    borderColor: controlBorder,
                    backgroundColor: controlBackground,
                    color: theme.mutedText,
                  }}
                />
                <Search
                  className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: theme.mutedText }}
                />
              </div>

              {showCart && (
                <button
                  type="button"
                  aria-label="Carrito de compras"
                  onClick={onCartOpen}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full border shadow-sm md:h-12 md:w-12"
                  style={{
                    borderColor: controlBorder,
                    backgroundColor: controlBackground,
                    color: theme.text,
                  }}
                >
                  <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
                  {cartCount > 0 && (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: theme.primary }}
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
                onClick={() => setMobileMenuOpen((current) => !current)}
                className="flex h-11 w-11 items-center justify-center rounded-full border bg-white shadow-sm lg:hidden"
                style={{
                  borderColor: controlBorder,
                  backgroundColor: controlBackground,
                  color: theme.text,
                }}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              {mobileMenuOpen && (
                <div
                  className="absolute right-0 top-full z-20 mt-3 w-[240px] overflow-hidden rounded-2xl border shadow-2xl lg:hidden"
                  style={{
                    borderColor: controlBorder,
                    backgroundColor: withOpacity(theme.background, theme.mode === 'dark' ? 0.94 : 0.96),
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: `0 18px 40px ${theme.shadow}`,
                  }}
                >
                  <nav className="flex flex-col p-2">
                    {navItems.map((item, index) =>
                      item.isRoute ? (
                        <Link
                          key={item.label}
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="rounded-xl px-4 py-3 text-sm font-medium"
                          style={{ color: index === 0 ? theme.primary : theme.mode === 'dark' ? theme.text : '#374151' }}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <a
                          key={item.label}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="rounded-xl px-4 py-3 text-sm font-medium"
                          style={{ color: index === 0 ? theme.primary : theme.mode === 'dark' ? theme.text : '#374151' }}
                        >
                          {item.label}
                        </a>
                      )
                    )}
                  </nav>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 lg:hidden">
            <div className="relative w-full">
              <input
                readOnly
                value={searchPlaceholder}
                className="h-10 w-full rounded-md border pl-4 pr-10 text-[12px] outline-none"
                style={{
                  borderColor: controlBorder,
                  backgroundColor: controlBackground,
                  color: theme.mutedText,
                }}
              />
              <Search
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: theme.mutedText }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function isMenuLabel(label: string) {
  return label.toLowerCase().includes('men');
}
