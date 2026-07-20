import { Outlet, useParams } from 'react-router-dom';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { AdminPanelTabs } from '@/components/admin/AdminPanelTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentCommerceSettings } from '@/features/stores/stores.selectors';

export function ProductsLayout() {
  const { storeId } = useParams<{ storeId: string }>();
  const currentCommerceSettings = useAppSelector(selectCurrentCommerceSettings);
  const isMenu = currentCommerceSettings?.catalogType === 'menu';

  if (!storeId) return null;

  const tabs = [
    { to: `/admin/stores/${storeId}/products`, label: 'Productos', end: true },
    { to: `/admin/stores/${storeId}/products/categories`, label: 'Categorías', end: false },
    { to: `/admin/stores/${storeId}/products/collections`, label: 'Colecciones', end: false },
    { to: `/admin/stores/${storeId}/products/filters`, label: 'Atributos del producto', end: false },
  ];

  return (
    <AdminPanelShell
      top={(
        <>
          <PageHeader
            title={isMenu ? 'Menú' : 'Productos'}
            description={
              isMenu
                ? 'Administra tu menú, categorías, colecciones y filtros del catálogo.'
                : 'Administra tus productos, categorías, colecciones y filtros del catálogo.'
            }
            sticky={false}
            className="mb-4"
          />

          <AdminPanelTabs items={tabs.map((tab) => ({ key: tab.to, ...tab }))} className="mb-0" />
        </>
      )}
    >
      <Outlet />
    </AdminPanelShell>
  );
}
