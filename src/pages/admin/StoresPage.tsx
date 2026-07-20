import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Store, ExternalLink, Settings, MapPin, Tag } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setStores, setStoresStatus, setStoresError } from '@/features/stores/storesSlice';
import { storesService } from '@/features/stores/storesService';
import { domainsService } from '@/features/domains/domainsService';
import type { StoreStatus, BadgeVariant } from '@/types/common.types';

const STATUS_MAP: Record<StoreStatus, { label: string; variant: BadgeVariant }> = {
  active:    { label: 'Activa',    variant: 'success'  },
  inactive:  { label: 'Inactiva',  variant: 'neutral'  },
  suspended: { label: 'Suspendida',variant: 'warning'  },
  archived:  { label: 'Archivada', variant: 'neutral'  },
};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  barberia:    'Barbería',
  restaurante: 'Restaurante',
  moda:        'Moda',
  tecnologia:  'Tecnología',
  mascotas:    'Mascotas',
  hogar:       'Hogar',
  belleza:     'Belleza',
  salud:       'Salud',
  otro:        'Otro',
};

export function StoresPage() {
  const dispatch = useAppDispatch();
  const stores = useAppSelector((state) => state.stores.items);
  const status = useAppSelector((state) => state.stores.status);

  useEffect(() => {
    async function load() {
      dispatch(setStoresStatus('loading'));
      try {
        const data = await storesService.getStores();
        dispatch(setStores(data));
      } catch (err) {
        dispatch(setStoresError(err instanceof Error ? err.message : 'Error cargando tiendas'));
      }
    }
    void load();
  }, [dispatch]);

  if (status === 'loading') return <LoadingScreen />;

  return (
    <div>
      <PageHeader
        title="Tiendas"
        description="Cada tienda genera un ecommerce público completo con sus propios productos, ofertas y pedidos."
        action={
          <Link to="/admin/stores/new">
            <Button leftIcon={<Plus className="w-4 h-4" />}>Nueva tienda</Button>
          </Link>
        }
      />

      {stores.length === 0 ? (
        <EmptyState
          icon={<Store className="w-10 h-10 text-gray-300" />}
          title="No hay tiendas todavía"
          description="Crea la primera tienda para generar un ecommerce público. Configura nombre, logo, colores, productos y más."
          action={
            <Link to="/admin/stores/new">
              <Button leftIcon={<Plus className="w-4 h-4" />}>Crear primera tienda</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => {
            const statusInfo = STATUS_MAP[store.status] ?? { label: store.status, variant: 'neutral' as BadgeVariant };
            const typeLabel = store.businessType ? BUSINESS_TYPE_LABELS[store.businessType] : null;
            const storefrontUrl = domainsService.getPlatformStoreUrl(store.slug);

            return (
              <Card key={store.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{store.name}</h3>
                      {store.slogan && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate italic">{store.slogan}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5 truncate font-mono">
                        {storefrontUrl.replace(/^https?:\/\//, '')}
                      </p>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2 mb-3">
                    {typeLabel && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Tag className="w-3 h-3" />
                        {typeLabel}
                      </span>
                    )}
                    {store.city && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />
                        {store.city}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link to={`/admin/stores/${store.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Settings className="w-4 h-4 mr-1.5" />
                        Gestionar
                      </Button>
                    </Link>
                    <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
