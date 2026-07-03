import { NavLink, Outlet, useParams } from 'react-router-dom';
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
    { to: `/admin/stores/${storeId}/products/filters`, label: 'Filtros del catálogo', end: false },
  ];

  return (
    <div>
      <PageHeader
        title={isMenu ? 'Menú' : 'Productos'}
        description={
          isMenu
            ? 'Administra tu menú, categorías, colecciones y filtros del catálogo.'
            : 'Administra tus productos, categorías, colecciones y filtros del catálogo.'
        }
      />

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                'px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px',
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
