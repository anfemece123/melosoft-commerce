import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Plus, Package, UtensilsCrossed, Eye, EyeOff,
  Archive, Edit, CheckCircle, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { ProductCategoryManager } from '@/components/admin/ProductCategoryManager';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { useAppSelector } from '@/app/hooks';
import { productCategoriesService } from '@/features/products/productCategoriesService';
import { productsService } from '@/features/products/productsService';
import { notify } from '@/lib/notifications';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  hasActiveDiscount,
  calculateDiscountPercentage,
} from '@/lib/pricing/pricing.utils';
import type { Product } from '@/features/products/products.types';
import type { StoreProductCategory } from '@/features/products/productCategories.types';
import type { BadgeVariant } from '@/types/common.types';

type FilterTab = 'all' | 'active' | 'draft' | 'unavailable' | 'archived';

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  draft: 'Borrador',
  inactive: 'Inactivo',
  archived: 'Archivado',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: 'success',
  draft: 'warning',
  inactive: 'neutral',
  archived: 'neutral',
};

export function ProductsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const currentLimits = useAppSelector((s) => s.stores.currentLimits);
  const currentCommerceSettings = useAppSelector((s) => s.stores.currentCommerceSettings);
  const store = useAppSelector((s) => s.stores.current);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [confirmArchiveProduct, setConfirmArchiveProduct] = useState<Product | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isMenu = currentCommerceSettings?.catalogType === 'menu';
  const entityLabel = isMenu ? 'platos' : 'productos';
  const newLabel = isMenu ? 'Nuevo plato' : 'Nuevo producto';
  const sectionIcon = isMenu
    ? <UtensilsCrossed className="w-5 h-5" />
    : <Package className="w-5 h-5" />;

  const nonArchived = products.filter((p) => p.status !== 'archived');
  const atLimit = currentLimits
    ? nonArchived.length >= currentLimits.maxProducts
    : false;

  useEffect(() => {
    if (!storeId) return;
    async function load() {
      if (!storeId) return;
      try {
        const [productsData, categoriesData] = await Promise.all([
          productsService.getProductsByStore(storeId),
          productCategoriesService.getStoreCategories(storeId),
        ]);
        setProducts(productsData);
        setCategories(categoriesData);
      } catch (err) {
        notify.fromError(err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [storeId]);

  const filtered = products.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (tab === 'all') return true;
    if (tab === 'active') return p.status === 'active' && p.isAvailable;
    if (tab === 'draft') return p.status === 'draft';
    if (tab === 'unavailable') return p.status === 'active' && !p.isAvailable;
    if (tab === 'archived') return p.status === 'archived';
    return true;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: products.length },
    { key: 'active', label: 'Activos', count: products.filter((p) => p.status === 'active' && p.isAvailable).length },
    { key: 'draft', label: 'Borradores', count: products.filter((p) => p.status === 'draft').length },
    { key: 'unavailable', label: 'No disponibles', count: products.filter((p) => p.status === 'active' && !p.isAvailable).length },
    { key: 'archived', label: 'Archivados', count: products.filter((p) => p.status === 'archived').length },
  ];

  const usageCountByCategory = products.reduce<Record<string, number>>((acc, product) => {
    if (!product.category) return acc;
    acc[product.category] = (acc[product.category] ?? 0) + 1;
    return acc;
  }, {});

  async function handlePublish(product: Product) {
    setActionLoading(product.id);
    try {
      const updated = await productsService.publishProduct(product.id);
      setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      notify.success(`"${product.name}" publicado correctamente.`);
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleAvailability(product: Product) {
    setActionLoading(product.id);
    try {
      const updated = await productsService.toggleAvailability(product.id, !product.isAvailable);
      setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      notify.success(
        updated.isAvailable
          ? `"${product.name}" marcado como disponible.`
          : `"${product.name}" marcado como no disponible.`
      );
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleArchiveConfirmed(product: Product) {
    setActionLoading(product.id);
    setConfirmArchiveProduct(null);
    try {
      const updated = await productsService.archiveProduct(product.id);
      setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      notify.success(`"${product.name}" archivado.`);
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  const currency = store?.currency ?? 'COP';

  return (
    <div>
      <PageHeader
        title={isMenu ? 'Menú' : 'Productos'}
        description={`Catálogo de ${entityLabel} de esta tienda.`}
        action={
          <div className="flex items-center gap-2">
            {atLimit && currentLimits && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                Límite del plan ({currentLimits.maxProducts})
              </span>
            )}
            <Link to={`/admin/stores/${storeId}/products/new`}>
              <Button
                leftIcon={<Plus className="w-4 h-4" />}
                disabled={atLimit}
              >
                {newLabel}
              </Button>
            </Link>
          </div>
        }
      />

      {storeId ? (
        <div className="mb-6">
          <ProductCategoryManager
            storeId={storeId}
            categories={categories}
            selectedCategory={categoryFilter}
            usageCountByCategory={usageCountByCategory}
            onSelectCategory={setCategoryFilter}
            onCategoriesChange={setCategories}
            onCategoryRenamed={(previousName, nextName) => {
              setProducts((prev) => prev.map((product) => (
                product.category === previousName
                  ? { ...product, category: nextName }
                  : product
              )));
            }}
          />
        </div>
      ) : null}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px',
              tab === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {label}
            {count > 0 && (
              <span className={[
                'ml-1.5 text-xs rounded-full px-1.5 py-0.5',
                tab === key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500',
              ].join(' ')}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<>{sectionIcon}</>}
          title={`Sin ${entityLabel}`}
          description={tab === 'all'
            ? `Agrega el primer ${isMenu ? 'plato' : 'producto'} al catálogo.`
            : `No hay ${entityLabel} en esta categoría.`}
          action={tab === 'all' && !atLimit ? (
            <Link to={`/admin/stores/${storeId}/products/new`}>
              <Button leftIcon={<Plus className="w-4 h-4" />}>{newLabel}</Button>
            </Link>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <Card key={product.id}>
              <CardBody>
                <div className="flex items-start gap-4">
                  {/* Image */}
                  <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                    {product.mainImageUrl ? (
                      <img
                        src={product.mainImageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {isMenu
                          ? <UtensilsCrossed className="w-5 h-5 text-gray-300" />
                          : <Package className="w-5 h-5 text-gray-300" />}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 truncate">{product.name}</span>
                          <Badge variant={STATUS_VARIANT[product.status] ?? 'neutral'}>
                            {STATUS_LABEL[product.status] ?? product.status}
                          </Badge>
                          {product.status === 'active' && !product.isAvailable && (
                            <Badge variant="warning">No disponible</Badge>
                          )}
                          {product.isFeatured && (
                            <Badge variant="info">Destacado</Badge>
                          )}
                        </div>
                        {product.category && (
                          <span className="text-xs text-gray-400 mt-0.5 block">{product.category}</span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {hasActiveDiscount(product.regularPrice, product.salePrice) ? (
                          <>
                            <p className="font-bold text-gray-900">
                              {formatCurrency(product.salePrice!, 'es-CO', currency)}
                            </p>
                            <p className="text-xs text-gray-400 line-through">
                              {formatCurrency(product.regularPrice, 'es-CO', currency)}
                            </p>
                            <DiscountBadge
                              percentage={calculateDiscountPercentage(
                                product.regularPrice,
                                product.salePrice!
                              )}
                              className="mt-0.5"
                            />
                          </>
                        ) : (
                          <p className="font-bold text-gray-900">
                            {formatCurrency(product.regularPrice, 'es-CO', currency)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {product.sku && (
                        <span className="text-xs text-gray-400 font-mono">SKU: {product.sku}</span>
                      )}
                      {isMenu && product.preparationTimeMinutes && (
                        <span className="text-xs text-gray-400">
                          {product.preparationTimeMinutes} min prep
                        </span>
                      )}
                      {!isMenu && product.trackInventory && (
                        <span className={`text-xs ${product.stock <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          Stock: {product.stock}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {product.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={actionLoading === product.id}
                          onClick={() => void handlePublish(product)}
                          leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                        >
                          Publicar
                        </Button>
                      )}
                      {product.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={actionLoading === product.id}
                          onClick={() => void handleToggleAvailability(product)}
                          leftIcon={product.isAvailable
                            ? <EyeOff className="w-3.5 h-3.5" />
                            : <Eye className="w-3.5 h-3.5" />}
                        >
                          {product.isAvailable ? 'Marcar no disponible' : 'Marcar disponible'}
                        </Button>
                      )}
                      <Link to={`/admin/stores/${storeId}/products/${product.id}/edit`}>
                        <Button size="sm" variant="ghost" leftIcon={<Edit className="w-3.5 h-3.5" />}>
                          Editar
                        </Button>
                      </Link>
                      {product.status !== 'archived' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmArchiveProduct(product)}
                          leftIcon={<Archive className="w-3.5 h-3.5 text-gray-400" />}
                        >
                          <span className="text-gray-400">Archivar</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Plan limit info */}
      {currentLimits && !loading && (
        <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
          {nonArchived.length >= currentLimits.maxProducts
            ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            : <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
          {nonArchived.length} de {currentLimits.maxProducts} {entityLabel} usados en el plan {currentLimits.planKey.toUpperCase()}
        </div>
      )}

      <ConfirmDialog
        open={confirmArchiveProduct !== null}
        title="Archivar producto"
        message={`¿Archivar "${confirmArchiveProduct?.name}"? El producto dejará de ser visible. Puedes restaurarlo más adelante.`}
        confirmLabel="Archivar"
        variant="warning"
        onConfirm={() => {
          if (confirmArchiveProduct) void handleArchiveConfirmed(confirmArchiveProduct);
        }}
        onCancel={() => setConfirmArchiveProduct(null)}
      />
    </div>
  );
}
