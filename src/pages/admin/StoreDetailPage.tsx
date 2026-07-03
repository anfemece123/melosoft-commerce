import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Package, Tag, ShoppingCart, CreditCard, Settings,
  ArrowRight, Users, BarChart2, MapPin, Globe,
  Building2, Copy, Check, ExternalLink, ShoppingBag,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setCurrentMembers } from '@/features/stores/storesSlice';
import { selectCurrentStore, selectCurrentCommerceSettings, selectCurrentBusinessLimits, selectMyMemberships } from '@/features/stores/stores.selectors';
import { selectAuthProfile } from '@/features/auth/auth.selectors';
import { storesService } from '@/features/stores/storesService';
import { productsService } from '@/features/products/productsService';
import { isPlatformAdmin, canManageStore, canManageStoreMembers } from '@/utils/permissions';
import type { ProductCountStats } from '@/features/products/products.types';

const CATALOG_TYPE_LABELS: Record<string, string> = {
  menu: 'Menú / Restaurante',
  physical_products: 'Productos físicos',
  services: 'Servicios',
  mixed: 'Mixto',
};

const COMMERCE_MODE_LABELS: Record<string, string> = {
  catalog_only: 'Solo catálogo',
  local_orders: 'Pedidos locales',
  local_delivery_and_pickup: 'Entrega y recogida',
  national_shipping: 'Envío nacional',
  mixed: 'Mixto',
};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  barberia: 'Barbería', restaurante: 'Restaurante', moda: 'Moda',
  tecnologia: 'Tecnología', mascotas: 'Mascotas', hogar: 'Hogar',
  belleza: 'Belleza', salud: 'Salud', otro: 'Otro',
};

interface ActionSection {
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  requiresManage?: boolean;
}

export function StoreDetailPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const dispatch = useAppDispatch();
  const [copied, setCopied] = useState(false);
  const [productStats, setProductStats] = useState<ProductCountStats | null>(null);

  const profile = useAppSelector(selectAuthProfile);
  const myMemberships = useAppSelector(selectMyMemberships);
  const store = useAppSelector(selectCurrentStore);
  const currentLimits = useAppSelector(selectCurrentBusinessLimits);
  const currentCommerceSettings = useAppSelector(selectCurrentCommerceSettings);

  const isAdmin = isPlatformAdmin(profile);
  const canManage = storeId ? canManageStore(profile, myMemberships, storeId) : false;
  const canSeeMembers = storeId ? canManageStoreMembers(profile, myMemberships, storeId) : false;

  const isMenu = currentCommerceSettings?.catalogType === 'menu';

  // Store/limits/commerce settings are hydrated by StoreAccessRoute
  // (useEnsureCurrentStore) before this page renders — only page-specific
  // data (members, product stats) is loaded here.
  useEffect(() => {
    if (!storeId) return;
    async function load() {
      if (!storeId) return;
      const [membersData, stats] = await Promise.all([
        storesService.getStoreMembers(storeId),
        productsService.countProductsByStore(storeId),
      ]);
      dispatch(setCurrentMembers(membersData));
      setProductStats(stats);
    }
    void load();
  }, [storeId, dispatch]);

  if (!store) return <LoadingScreen />;

  const publicUrl = `${window.location.origin}/s/${store.slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  const sections: ActionSection[] = [
    {
      title: 'Configuración',
      description: 'Logo, colores, tema, redes, políticas.',
      to: `/admin/stores/${storeId}/settings`,
      icon: <Settings className="w-5 h-5 text-indigo-600" />,
      requiresManage: true,
    },
    {
      title: 'Productos',
      description: 'Catálogo de productos y precios.',
      to: `/admin/stores/${storeId}/products`,
      icon: <Package className="w-5 h-5 text-violet-600" />,
    },
    {
      title: 'Ofertas',
      description: 'Promociones con contador regresivo.',
      to: `/admin/stores/${storeId}/offers`,
      icon: <Tag className="w-5 h-5 text-amber-600" />,
    },
    {
      title: 'Pedidos',
      description: 'Pedidos recibidos de clientes.',
      to: `/admin/stores/${storeId}/orders`,
      icon: <ShoppingCart className="w-5 h-5 text-green-600" />,
    },
    {
      title: 'Pagos',
      description: 'Configuración de Wompi.',
      to: `/admin/stores/${storeId}/payments`,
      icon: <CreditCard className="w-5 h-5 text-blue-600" />,
      requiresManage: true,
    },
  ];

  const visibleSections = sections.filter((s) => !s.requiresManage || canManage);

  const statusLabel: Record<string, string> = {
    active: 'Activa',
    inactive: 'Inactiva',
    suspended: 'Suspendida',
    archived: 'Archivada',
  };

  const statusVariant: Record<string, 'success' | 'warning' | 'neutral'> = {
    active: 'success',
    suspended: 'warning',
    inactive: 'neutral',
    archived: 'neutral',
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={store.name}
        description={store.slogan ?? 'Panel de gestión de tu empresa.'}
      />

      {/* Identity row */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <Badge variant={statusVariant[store.status] ?? 'neutral'}>
          {statusLabel[store.status] ?? store.status}
        </Badge>
        {store.businessType && (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
            <Building2 className="w-3 h-3" />
            {BUSINESS_TYPE_LABELS[store.businessType] ?? store.businessType}
          </span>
        )}
        {store.city && (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
            <MapPin className="w-3 h-3" />
            {store.city}
          </span>
        )}
        <span className="text-xs text-gray-400 font-mono">/s/{store.slug}</span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: isMenu ? 'Platos' : 'Productos',
            icon: <Package className="w-4 h-4 text-violet-500" />,
            value: productStats ? String(productStats.total) : '—',
          },
          { label: 'Ofertas activas', icon: <Tag className="w-4 h-4 text-amber-500" />, value: '—' },
          { label: 'Pedidos', icon: <ShoppingCart className="w-4 h-4 text-green-500" />, value: '—' },
          {
            label: 'Plan',
            icon: <BarChart2 className="w-4 h-4 text-indigo-500" />,
            value: currentLimits ? currentLimits.planKey.toUpperCase() : '—',
          },
        ].map(({ label, icon, value }) => (
          <Card key={label}>
            <CardBody>
              <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-xs text-gray-500 font-medium">{label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Tu ecommerce público */}
      {store.status === 'active' && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-gray-400" />
            Tu ecommerce público
          </h2>
          <Card>
            <CardBody>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">URL pública</p>
                  <p className="text-sm font-mono text-gray-700 truncate">{publicUrl}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Ver ecommerce
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopy()}
                  >
                    {copied ? (
                      <><Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />Copiado</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5 mr-1.5" />Copiar link</>
                    )}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Action sections */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Acciones principales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleSections.map((section) => (
            <Link key={section.to} to={section.to} className="group">
              <Card>
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-indigo-50 transition-colors">
                      {section.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{section.title}</h3>
                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Modelo de venta */}
      {currentCommerceSettings && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <ShoppingBag className="w-4 h-4 text-gray-400" />
            Modelo de venta
          </h2>
          <Card>
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Catálogo</p>
                  <p className="font-semibold text-gray-800">
                    {CATALOG_TYPE_LABELS[currentCommerceSettings.catalogType] ?? currentCommerceSettings.catalogType}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Modo de venta</p>
                  <p className="font-semibold text-gray-800">
                    {COMMERCE_MODE_LABELS[currentCommerceSettings.commerceMode] ?? currentCommerceSettings.commerceMode}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Entregas</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {currentCommerceSettings.allowsPickup && <Badge variant="neutral">Recogida</Badge>}
                    {currentCommerceSettings.allowsLocalDelivery && <Badge variant="neutral">Domicilio</Badge>}
                    {currentCommerceSettings.allowsNationalShipping && <Badge variant="neutral">Envío nac.</Badge>}
                    {!currentCommerceSettings.allowsPickup &&
                      !currentCommerceSettings.allowsLocalDelivery &&
                      !currentCommerceSettings.allowsNationalShipping && (
                        <span className="text-gray-400 text-xs">Sin entregas</span>
                      )}
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Pedido por</p>
                  <p className="font-semibold text-gray-800">
                    {currentCommerceSettings.defaultOrderMethod === 'whatsapp' ? 'WhatsApp' : 'Checkout'}
                  </p>
                </div>
              </div>
              {canManage && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <Link
                    to={`/admin/stores/${storeId}/settings`}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
                  >
                    Editar configuración comercial
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Members section */}
      {canSeeMembers && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-400" />
            Miembros del equipo
          </h2>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">
                La gestión completa de miembros estará disponible próximamente.
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Plan limits — shown to all (platform_admin gets extra context) */}
      {currentLimits && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            Límites del plan
          </h2>
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <Badge variant="info">{currentLimits.planKey.toUpperCase()}</Badge>
                {isAdmin && (
                  <span className="text-xs text-gray-400">Visible solo en modo admin</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {[
                  { label: 'Productos', value: currentLimits.maxProducts },
                  { label: 'Staff', value: currentLimits.maxStaff },
                  { label: 'Ofertas activas', value: currentLimits.maxActiveOffers },
                  { label: 'Pagos Wompi', value: currentLimits.canUsePayments ? 'Habilitado' : 'No' },
                  { label: 'Dominio propio', value: currentLimits.canUseCustomDomain ? 'Sí' : 'No' },
                  { label: 'Tema avanzado', value: currentLimits.canUseAdvancedTheme ? 'Sí' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
                    <p className="font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
