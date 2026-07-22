import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  Home,
  Settings,
  LayoutTemplate,
  Package,
  Tag,
  ShoppingCart,
  CreditCard,
  MapPin,
  MessageCircle,
  Menu,
  X,
  LogOut,
  ChevronRight,
  UserCircle,
  ExternalLink,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { authService } from '@/features/auth/authService';
import { selectIsPlatformAdmin } from '@/features/auth/auth.selectors';
import { selectCurrentStore, selectMyMemberships } from '@/features/stores/stores.selectors';
import { PendingOrdersBadgeProvider } from '@/features/orders/PendingOrdersBadgeContext';
import { usePendingOrdersBadge } from '@/features/orders/usePendingOrdersBadge';
import { domainsService } from '@/features/domains/domainsService';
import { MelosoftBrand } from '@/components/ui/MelosoftBrand';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  end?: boolean;
  badge?: number;
  badgeUrgent?: boolean;
}

// Outer shell: derives storeId and wraps with PendingOrdersBadgeProvider so that
// both the sidebar (badge) and page content (OrdersPage.refresh) share the same context.
export function AdminLayout() {
  const isAdmin = useAppSelector(selectIsPlatformAdmin);
  const myMemberships = useAppSelector(selectMyMemberships);
  const { pathname } = useLocation();

  const storeIdFromUrl = pathname.match(/^\/admin\/stores\/([^/]+)/)?.[1];
  const storeId = storeIdFromUrl ?? myMemberships.find((m) => m.status === 'active')?.storeId ?? '';

  return (
    <PendingOrdersBadgeProvider storeId={!isAdmin && storeId ? storeId : undefined}>
      <AdminLayoutContent />
    </PendingOrdersBadgeProvider>
  );
}

function AdminLayoutContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const user = useAppSelector((s) => s.auth.user);
  const myMemberships = useAppSelector(selectMyMemberships);
  const currentStore = useAppSelector(selectCurrentStore);

  const isAdmin = useAppSelector(selectIsPlatformAdmin);

  const storeIdFromUrl = pathname.match(/^\/admin\/stores\/([^/]+)/)?.[1];
  const firstActiveMembership = myMemberships.find((m) => m.status === 'active');
  const storeId = storeIdFromUrl ?? firstActiveMembership?.storeId ?? '';

  const storeName = currentStore?.name ?? 'Mi Tienda';
  const storeSlug = currentStore?.slug;

  // Reads from PendingOrdersBadgeProvider — no storeId param needed here
  const { pendingCount, hasOverduePending } = usePendingOrdersBadge();

  async function handleLogout() {
    try { await authService.logout(); } catch { /* continue */ }
    dispatch(logout());
    void navigate('/login');
  }

  const platformAdminNav: NavItem[] = [
    { label: 'Dashboard', to: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, end: true },
    { label: 'Tiendas', to: '/admin/stores', icon: <Store className="w-5 h-5" /> },
    { label: 'Conexiones WhatsApp', to: '/admin/whatsapp-connections', icon: <MessageCircle className="w-5 h-5" /> },
  ];

  const ownerNav: NavItem[] = storeId ? [
    { label: 'Inicio', to: `/admin/stores/${storeId}`, icon: <Home className="w-5 h-5" />, end: true },
    { label: 'Configuración', to: `/admin/stores/${storeId}/settings`, icon: <Settings className="w-5 h-5" /> },
    { label: 'Diseño de inicio', to: `/admin/stores/${storeId}/home-builder`, icon: <LayoutTemplate className="w-5 h-5" /> },
    { label: 'Sucursales', to: `/admin/stores/${storeId}/locations`, icon: <MapPin className="w-5 h-5" /> },
    { label: 'Productos', to: `/admin/stores/${storeId}/products`, icon: <Package className="w-5 h-5" /> },
    { label: 'Ofertas', to: `/admin/stores/${storeId}/offers`, icon: <Tag className="w-5 h-5" /> },
    {
      label: 'Pedidos',
      to: `/admin/stores/${storeId}/orders`,
      icon: <ShoppingCart className="w-5 h-5" />,
      badge: pendingCount > 0 ? pendingCount : undefined,
      badgeUrgent: hasOverduePending,
    },
    { label: 'Pagos', to: `/admin/stores/${storeId}/payments`, icon: <CreditCard className="w-5 h-5" /> },
    { label: 'WhatsApp', to: `/admin/stores/${storeId}/whatsapp`, icon: <MessageCircle className="w-5 h-5" /> },
  ] : [];

  const navItems = isAdmin ? platformAdminNav : ownerNav;

  // Use the role from the store currently in the URL, not the first membership
  const ownerRole = myMemberships.find(
    (m) => m.storeId === storeId && m.status === 'active'
  )?.role;

  const activeStoreCount = myMemberships.filter((m) => m.status === 'active').length;

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <div className="flex h-dvh min-h-0 bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex min-h-0 w-64 flex-col border-r border-gray-200 bg-white',
          'transform transition-transform duration-200 ease-in-out',
          'lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo / Store identity */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-slate-700 shadow-sm ring-1 ring-black/5">
              <MelosoftBrand
                variant="mark"
                alt=""
                aria-hidden="true"
                className="h-full w-full scale-[1.55] object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              {isAdmin ? (
                <>
                  <span className="truncate text-base font-bold tracking-tight text-slate-900">
                    Melosoft Commerce
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-indigo-500">
                    Panel administrativo
                  </span>
                </>
              ) : (
                <>
                  <span className="truncate text-base font-bold tracking-tight text-gray-900">
                    {storeName}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-indigo-500">
                    Panel de empresa
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600 shrink-0 ml-2"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                  'transition-colors duration-150 group',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>

              {/* Pending orders badge */}
              {item.badge != null && item.badge > 0 && (
                <span
                  className={cn(
                    'mr-1 min-w-[20px] text-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    item.badgeUrgent
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-800'
                  )}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}

              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
            </NavLink>
          ))}

          {/* Public ecommerce link — owner only */}
          {!isAdmin && storeSlug && (
            <a
              href={domainsService.getPlatformStoreUrl(storeSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="flex-1">Ver ecommerce</span>
            </a>
          )}

          {/* Store switcher — only when user has 2+ active memberships */}
          {!isAdmin && activeStoreCount > 1 && (
            <NavLink
              to="/admin/my-stores"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                  'transition-colors duration-150',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <ArrowLeftRight className="w-5 h-5" />
              <span className="flex-1">Cambiar empresa</span>
            </NavLink>
          )}
        </nav>

        {/* User info + Logout */}
        <div className="p-3 border-t border-gray-200 shrink-0 space-y-1">
          {user && (
            <div className="px-3 py-2 text-xs text-gray-400 truncate" title={user.email}>
              {user.email}
            </div>
          )}
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-150"
          >
            <LogOut className="w-5 h-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {user && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserCircle className="w-5 h-5 text-gray-400" />
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="truncate max-w-48">{user.email}</span>
                {isAdmin && (
                  <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide">
                    Platform Admin
                  </span>
                )}
                {!isAdmin && ownerRole && (
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                    {ownerRole}
                  </span>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
