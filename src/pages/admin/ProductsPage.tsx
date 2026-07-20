import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Plus, Package, UtensilsCrossed, Eye, EyeOff,
  Archive, Edit, CheckCircle, AlertCircle, Layers, Trash2,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StockAdjustmentModal } from '@/components/admin/StockAdjustmentModal';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { AdminPanelTabs } from '@/components/admin/AdminPanelTabs';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentStore, selectCurrentCommerceSettings, selectCurrentBusinessLimits } from '@/features/stores/stores.selectors';
import { categoriesService } from '@/features/categories/categoriesService';
import { productsService } from '@/features/products/productsService';
import { notify } from '@/lib/notifications';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  hasActiveDiscount,
  calculateDiscountPercentage,
} from '@/lib/pricing/pricing.utils';
import type { Product } from '@/features/products/products.types';
import type { PublicStoreCategory } from '@/types/common.types';
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
  const currentLimits = useAppSelector(selectCurrentBusinessLimits);
  const currentCommerceSettings = useAppSelector(selectCurrentCommerceSettings);
  const store = useAppSelector(selectCurrentStore);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [confirmArchiveProduct, setConfirmArchiveProduct] = useState<Product | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<Product | null>(null);

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
          categoriesService.getStoreCategories(storeId),
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
    if (categoryFilter && p.categoryId !== categoryFilter) return false;
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
          : isMenu
            ? `"${product.name}" marcado como agotado por el momento.`
            : `"${product.name}" marcado como no disponible.`
      );
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  function handleStockUpdated(productId: string, newStock: number) {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
    );
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

  async function handleDeleteConfirmed(product: Product) {
    setActionLoading(product.id);
    setConfirmDeleteProduct(null);
    try {
      await productsService.deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      if (adjustingStockProduct?.id === product.id) {
        setAdjustingStockProduct(null);
      }
      notify.success(`"${product.name}" eliminado permanentemente.`);
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  const currency = store?.currency ?? 'COP';

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
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

      {categories.length > 0 ? (
        <div className="mb-6 overflow-x-auto">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('')}
              className={[
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                categoryFilter
                  ? 'border-gray-200 text-gray-600 hover:border-gray-300'
                  : 'border-indigo-600 bg-indigo-50 text-indigo-700',
              ].join(' ')}
            >
              Todas
            </button>
            {categories.map((category) => {
              const selected = categoryFilter === category.id;
              const usage = products.filter((product) => product.categoryId === category.id).length;
              const label = category.parentId
                ? `${categories.find((item) => item.id === category.parentId)?.name ?? 'Categoría'} > ${category.name}`
                : category.name;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryFilter(selected ? '' : category.id)}
                  className={[
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    selected
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {label}
                  <span className="ml-1 text-xs text-gray-400">{usage}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Filter tabs */}
      <AdminPanelTabs
        items={tabs.map(({ key, label, count }) => ({
          key,
          label,
          active: tab === key,
          onClick: () => setTab(key),
          badge: count > 0 ? (
            <span
              className={[
                'rounded-full px-1.5 py-0.5 text-xs',
                tab === key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500',
              ].join(' ')}
            >
              {count}
            </span>
          ) : undefined,
        }))}
      />

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
                            <Badge variant="warning">{isMenu ? 'Agotado por el momento' : 'No disponible'}</Badge>
                          )}
                          {product.isFeatured && (
                            <Badge variant="info">Destacado</Badge>
                          )}
                        </div>
                        {(() => {
                          const category = categories.find((item) => item.id === product.categoryId);
                          if (!category) return null;
                          return (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                                {category.parentId
                                  ? `${categories.find((item) => item.id === category.parentId)?.name ?? 'Categoría'} > ${category.name}`
                                  : category.name}
                              </span>
                            </div>
                          );
                        })()}
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
                      {product.trackInventory && !product.hasVariants && (
                        <span className={`text-xs ${product.stock <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {isMenu ? 'Unidades disponibles' : 'Stock'}: {product.stock}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {product.trackInventory && !product.hasVariants && product.status !== 'archived' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjustingStockProduct(product)}
                          leftIcon={<Layers className="w-3.5 h-3.5" />}
                        >
                          {isMenu ? 'Ajustar unidades' : 'Ajustar stock'}
                        </Button>
                      )}
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
                          {product.isAvailable
                            ? (isMenu ? 'Marcar agotado' : 'Marcar no disponible')
                            : 'Marcar disponible'}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={actionLoading === product.id}
                        onClick={() => setConfirmDeleteProduct(product)}
                        leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </Button>
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

      <ConfirmDialog
        open={confirmDeleteProduct !== null}
        title="Eliminar producto"
        message={`¿Eliminar "${confirmDeleteProduct?.name}" por completo? Esta acción borra el producto, sus imágenes, ofertas asociadas y checkouts pendientes sin pedido. No se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteProduct) void handleDeleteConfirmed(confirmDeleteProduct);
        }}
        onCancel={() => setConfirmDeleteProduct(null)}
      />

      {adjustingStockProduct && storeId && (
        <StockAdjustmentModal
          open={adjustingStockProduct !== null}
          storeId={storeId}
          productId={adjustingStockProduct.id}
          productName={adjustingStockProduct.name}
          currentStock={adjustingStockProduct.stock}
          onClose={() => setAdjustingStockProduct(null)}
          onStockUpdated={handleStockUpdated}
          restaurantMode={isMenu}
        />
      )}
    </div>
  );
}
