import { Link, Navigate } from 'react-router-dom';
import { Store, Package, Tag, ShoppingCart, CreditCard, ArrowRight, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { useAppSelector } from '@/app/hooks';
import { isPlatformAdmin } from '@/utils/permissions';
import { getPostLoginRedirect } from '@/utils/authRedirect';

interface QuickAccessItem {
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  cta: string;
  adminOnly?: boolean;
}

const quickAccess: QuickAccessItem[] = [
  {
    title: 'Tiendas',
    description: 'Crea y gestiona ecommerce para diferentes empresas desde un panel centralizado.',
    to: '/admin/stores',
    icon: <Store className="w-6 h-6 text-indigo-600" />,
    cta: 'Ver tiendas',
    adminOnly: true,
  },
  {
    title: 'Productos',
    description: 'Administra el catálogo de productos de cada tienda.',
    to: '/admin/stores',
    icon: <Package className="w-6 h-6 text-violet-600" />,
    cta: 'Ir a tiendas',
  },
  {
    title: 'Ofertas',
    description: 'Crea ofertas promocionales con contador regresivo por tienda.',
    to: '/admin/stores',
    icon: <Tag className="w-6 h-6 text-amber-600" />,
    cta: 'Ir a tiendas',
  },
  {
    title: 'Pedidos',
    description: 'Revisa y gestiona los pedidos recibidos en cada ecommerce.',
    to: '/admin/stores',
    icon: <ShoppingCart className="w-6 h-6 text-green-600" />,
    cta: 'Ir a tiendas',
  },
  {
    title: 'Pagos',
    description: 'Configura la pasarela de pagos Wompi por tienda.',
    to: '/admin/stores',
    icon: <CreditCard className="w-6 h-6 text-blue-600" />,
    cta: 'Ir a tiendas',
  },
];

export function DashboardPage() {
  const profile = useAppSelector((state) => state.auth.profile);
  const myMemberships = useAppSelector((state) => state.stores.myMemberships);
  const isAdmin = isPlatformAdmin(profile);

  // Non-platform_admin users don't have a global dashboard — redirect to their store
  if (!isAdmin) {
    return <Navigate to={getPostLoginRedirect(profile, myMemberships)} replace />;
  }

  const visibleItems = quickAccess.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Bienvenido a Melosoft Commerce — plataforma generadora de ecommerce multiempresa."
      />

      {isAdmin && (
        <div className="flex items-center gap-2 mb-6 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700 max-w-fit">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="font-medium">Platform Admin</span>
          <span className="text-indigo-400">— Acceso completo a la plataforma</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
        {visibleItems.map((item) => (
          <Card key={item.title}>
            <CardBody>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                  <Link
                    to={item.to}
                    className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    {item.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
