import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Archive, ArchiveRestore, CheckCircle, CheckCircle2, ChevronLeft, ChevronRight,
  Copy, Edit, ExternalLink, Eye, EyeOff, Layers, Package, Star, Trash2,
} from 'lucide-react';
import { SideSheet } from '@/components/ui/SideSheet';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { productsService } from '@/features/products/productsService';
import { productVariantsService } from '@/features/products/productVariantsService';
import { domainsService } from '@/features/domains/domainsService';
import {
  PRODUCT_ISSUE_LABELS,
  effectiveProductPrice,
  getProductIssues,
  hasProductDiscount,
} from '@/features/products/adminProductList';
import { extractFragranceNotes } from '@/lib/storefront/fragrancePyramid';
import { notify } from '@/lib/notifications';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Product, ProductImage } from '@/features/products/products.types';
import type { ProductVariant } from '@/features/products/productVariants.types';
import type { PublicStoreCategory } from '@/types/common.types';
import { STATUS_BADGE } from './productStatus';

export interface ProductDetailActions {
  onPublish: (product: Product) => void;
  onToggleAvailability: (product: Product) => void;
  onToggleFeatured: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
  onArchive: (product: Product) => void;
  onRestore: (product: Product) => void;
  onDelete: (product: Product) => void;
}

interface ProductDetailSheetProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  position: { index: number; total: number } | null;
  onPrevious?: () => void;
  onNext?: () => void;
  storeSlug: string | null;
  currency: string;
  isMenu: boolean;
  inquiryMode: boolean;
  fragranceStore: boolean;
  categories: PublicStoreCategory[];
  busy: boolean;
  actions: ProductDetailActions;
}

interface ProductExtras {
  images: ProductImage[];
  variants: ProductVariant[];
}

// Details already opened stay cached for the session: going back and forth
// between products (← →) is instant.
const extrasCache = new Map<string, ProductExtras>();

const dateFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-gray-100 px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-gray-900">{children}</dd>
    </div>
  );
}

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 420;
  return (
    <div>
      <p className={`whitespace-pre-line text-sm leading-relaxed text-gray-700 ${long && !expanded ? 'line-clamp-6' : ''}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          {expanded ? 'Ver menos' : 'Ver completo'}
        </button>
      )}
    </div>
  );
}

/** Quick view of a product from the list: everything the store has about
 * it, completeness warnings, and its common actions — without leaving
 * the list. ← → move between the products of the current list. */
export function ProductDetailSheet({
  product,
  open,
  onClose,
  position,
  onPrevious,
  onNext,
  storeSlug,
  currency,
  isMenu,
  inquiryMode,
  fragranceStore,
  categories,
  busy,
  actions,
}: ProductDetailSheetProps) {
  const productId = product?.id ?? null;
  const hasVariants = product?.hasVariants ?? false;
  const [loaded, setLoaded] = useState<{ id: string; extras: ProductExtras } | null>(null);
  const [activeImage, setActiveImage] = useState<{ productId: string; index: number } | null>(null);

  useEffect(() => {
    if (!productId || extrasCache.has(productId)) return;
    let cancelled = false;
    Promise.all([
      productsService.getProductImages(productId),
      hasVariants ? productVariantsService.getProductVariants(productId) : Promise.resolve([]),
    ])
      .then(([images, variants]) => {
        const extras = { images, variants };
        extrasCache.set(productId, extras);
        if (!cancelled) setLoaded({ id: productId, extras });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: productId, extras: { images: [], variants: [] } });
      });
    return () => {
      cancelled = true;
    };
  }, [productId, hasVariants]);

  if (!product) return null;

  const extras = extrasCache.get(product.id) ?? (loaded?.id === product.id ? loaded.extras : null);
  const images = extras?.images.length
    ? [...extras.images]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)
      .map((image) => ({ url: image.imageUrl, alt: image.altText ?? product.name }))
    : product.mainImageUrl ? [{ url: product.mainImageUrl, alt: product.name }] : [];
  const imageIndex = activeImage?.productId === product.id ? Math.min(activeImage.index, Math.max(images.length - 1, 0)) : 0;
  const mainImage = images[imageIndex] ?? null;

  const category = product.categoryId ? categories.find((item) => item.id === product.categoryId) : null;
  const parent = category?.parentId ? categories.find((item) => item.id === category.parentId) : null;
  const categoryLabel = category ? (parent ? `${parent.name} › ${category.name}` : category.name) : 'Sin categoría';
  const issues = getProductIssues(product, { requirePrice: !inquiryMode });
  const status = STATUS_BADGE[product.status] ?? { label: product.status, variant: 'neutral' as const };
  const discount = hasProductDiscount(product);
  const publicUrl = storeSlug ? `${domainsService.getStorePublicUrl(storeSlug)}/p/${product.slug}` : null;
  const fragrance = fragranceStore ? extractFragranceNotes(product.descriptionSections) : null;
  const otherSections = product.descriptionSections.filter(
    (section) => section.isVisible !== false && !(fragrance?.matchedIds.has(section.id)),
  );

  const facetGroups = new Map<string, string[]>();
  for (const value of product.facetValues) {
    facetGroups.set(value.facetName, [...(facetGroups.get(value.facetName) ?? []), value.value]);
  }

  const margin = product.costPrice !== null && product.costPrice > 0 && effectiveProductPrice(product) > 0
    ? Math.round(((effectiveProductPrice(product) - product.costPrice) / effectiveProductPrice(product)) * 100)
    : null;

  const stockLabel = product.hasVariants
    ? `${extras ? extras.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0) : '…'} en variantes`
    : product.trackInventory ? String(product.stock) : 'Sin control';

  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.key === 'ArrowLeft' && onPrevious) {
      event.preventDefault();
      onPrevious();
    } else if (event.key === 'ArrowRight' && onNext) {
      event.preventDefault();
      onNext();
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      notify.success('Enlace copiado.');
    } catch {
      notify.error('No se pudo copiar el enlace.');
    }
  }

  const navButtonClass = 'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      width="xl"
      title={product.name}
      ariaLabel={`Detalle de ${product.name}`}
      subtitle={position ? (
        <>
          Producto {position.index + 1} de {position.total}
          <span className="hidden sm:inline"> · usa ← → para navegar</span>
        </>
      ) : undefined}
      onKeyDown={handleKeyDown}
      headerActions={(
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onPrevious} disabled={!onPrevious} aria-label="Producto anterior" className={navButtonClass}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onNext} disabled={!onNext} aria-label="Producto siguiente" className={navButtonClass}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      footer={(
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/admin/stores/${product.storeId}/products/${product.id}/edit`} className="min-w-[10rem] flex-1">
            <Button className="w-full" leftIcon={<Edit className="h-4 w-4" />}>Editar producto</Button>
          </Link>
          {product.status === 'draft' && (
            <Button variant="outline" isLoading={busy} onClick={() => actions.onPublish(product)} leftIcon={<CheckCircle className="h-4 w-4" />}>
              Publicar
            </Button>
          )}
          {product.status === 'active' && (
            <Button
              variant="outline"
              isLoading={busy}
              onClick={() => actions.onToggleAvailability(product)}
              leftIcon={product.isAvailable ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            >
              {product.isAvailable ? (isMenu ? 'Marcar agotado' : 'No disponible') : 'Disponible'}
            </Button>
          )}
          {product.status === 'archived' ? (
            <Button variant="outline" isLoading={busy} onClick={() => actions.onRestore(product)} leftIcon={<ArchiveRestore className="h-4 w-4" />}>
              Restaurar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => actions.onArchive(product)} leftIcon={<Archive className="h-4 w-4" />}>
              Archivar
            </Button>
          )}
          <Button variant="ghost" onClick={() => actions.onDelete(product)} leftIcon={<Trash2 className="h-4 w-4 text-red-500" />} className="text-red-600 hover:bg-red-50">
            Eliminar
          </Button>
        </div>
      )}
    >
      {/* Summary */}
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[15rem] sm:max-w-none">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-white">
            {mainImage ? (
              <img src={mainImage.url} alt={mainImage.alt} className="h-full w-full object-contain" decoding="async" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-300">
                <Package className="h-10 w-10" />
                <span className="text-xs text-gray-400">Sin imagen</span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  type="button"
                  onClick={() => setActiveImage({ productId: product.id, index })}
                  aria-label={`Ver imagen ${index + 1}`}
                  className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-white ${index === imageIndex ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'}`}
                >
                  <img src={image.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={status.variant}>{status.label}</Badge>
            {product.status === 'active' && !product.isAvailable && (
              <Badge variant="warning">{isMenu ? 'Agotado por el momento' : 'No disponible'}</Badge>
            )}
            {product.isFeatured && <Badge variant="info">Destacado</Badge>}
            {product.hasVariants && <Badge variant="neutral">Con variantes</Badge>}
          </div>

          <p className="mt-2 text-sm text-gray-500">{categoryLabel}</p>

          <div className="mt-3">
            {inquiryMode ? (
              <p className="text-sm text-gray-600">
                Catálogo con consulta por WhatsApp: el precio no se muestra en la tienda.
                {product.regularPrice > 0 && (
                  <span className="block font-semibold text-gray-900">Referencia: {formatCurrency(product.regularPrice, 'es-CO', currency)}</span>
                )}
              </p>
            ) : discount ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(product.salePrice as number, 'es-CO', currency)}</span>
                <span className="text-sm text-gray-400 line-through">{formatCurrency(product.regularPrice, 'es-CO', currency)}</span>
                <Badge variant="success">
                  -{Math.round(((product.regularPrice - (product.salePrice as number)) / product.regularPrice) * 100)}%
                </Badge>
              </div>
            ) : (
              <span className="text-2xl font-bold text-gray-900">{formatCurrency(product.regularPrice, 'es-CO', currency)}</span>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2">
            <Fact label={isMenu ? 'Unidades' : 'Stock'}>
              <span className={!product.hasVariants && product.trackInventory && product.stock <= 0 ? 'text-red-600' : undefined}>{stockLabel}</span>
            </Fact>
            <Fact label="SKU"><span className="font-mono text-xs">{product.sku ?? '—'}</span></Fact>
            {product.costPrice !== null && product.costPrice > 0 && (
              <Fact label="Costo">{formatCurrency(product.costPrice, 'es-CO', currency)}</Fact>
            )}
            {margin !== null && <Fact label="Margen">{margin}%</Fact>}
            {isMenu && product.preparationTimeMinutes && <Fact label="Preparación">{product.preparationTimeMinutes} min</Fact>}
          </dl>

          {publicUrl && product.status === 'active' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <ExternalLink className="h-3.5 w-3.5" /> Ver en la tienda
              </a>
              <button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <Copy className="h-3.5 w-3.5" /> Copiar enlace
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions that don't need the full form */}
      {product.status !== 'archived' && (
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          <Button size="sm" variant="outline" isLoading={busy} onClick={() => actions.onToggleFeatured(product)} leftIcon={<Star className={`h-3.5 w-3.5 ${product.isFeatured ? 'fill-amber-400 text-amber-400' : ''}`} />}>
            {product.isFeatured ? 'Quitar de destacados' : 'Destacar'}
          </Button>
          {product.trackInventory && !product.hasVariants && (
            <Button size="sm" variant="outline" onClick={() => actions.onAdjustStock(product)} leftIcon={<Layers className="h-3.5 w-3.5" />}>
              {isMenu ? 'Ajustar unidades' : 'Ajustar stock'}
            </Button>
          )}
        </div>
      )}

      <Block title="Estado de la ficha">
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Ficha completa
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {issues.map((issue) => (
              <li key={issue} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3 w-3" /> {PRODUCT_ISSUE_LABELS[issue]}
              </li>
            ))}
          </ul>
        )}
      </Block>

      {facetGroups.size > 0 && (
        <Block title="Atributos">
          <dl className="space-y-2">
            {Array.from(facetGroups).map(([name, values]) => (
              <div key={name} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 text-sm">
                <dt className="text-gray-500">{name}</dt>
                <dd className="flex flex-wrap gap-1">
                  {values.map((value) => (
                    <span key={value} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{value}</span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Block>
      )}

      {product.collections.length > 0 && (
        <Block title="Colecciones">
          <div className="flex flex-wrap gap-1.5">
            {product.collections.map((collection) => (
              <span key={collection.id} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{collection.name}</span>
            ))}
          </div>
        </Block>
      )}

      {product.shortDescription?.trim() && (
        <Block title="Descripción corta">
          <p className="text-sm leading-relaxed text-gray-700">{product.shortDescription}</p>
        </Block>
      )}

      {product.description.trim() && (
        <Block title="Descripción">
          <ExpandableText text={product.description} />
        </Block>
      )}

      {fragrance && (
        <Block title="Pirámide olfativa">
          <dl className="space-y-2 text-sm">
            {([['Salida', fragrance.notes.top], ['Corazón', fragrance.notes.heart], ['Fondo', fragrance.notes.base]] as const).map(([label, notes]) => (
              <div key={label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-gray-800">{notes || '—'}</dd>
              </div>
            ))}
          </dl>
        </Block>
      )}

      {otherSections.length > 0 && (
        <Block title="Secciones de la descripción">
          <div className="space-y-3">
            {otherSections.map((section) => (
              <div key={section.id}>
                <p className="text-sm font-semibold text-gray-900">{section.title}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-gray-700">{section.content}</p>
              </div>
            ))}
          </div>
        </Block>
      )}

      {product.hasVariants && (
        <Block title="Variantes">
          {!extras ? (
            <p className="text-sm text-gray-400">Cargando variantes…</p>
          ) : extras.variants.length === 0 ? (
            <p className="text-sm text-gray-500">Sin variantes configuradas.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Variante</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    {!inquiryMode && <th className="px-3 py-2 text-right font-medium">Precio</th>}
                    <th className="px-3 py-2 text-right font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {extras.variants.map((variant) => (
                    <tr key={variant.id} className={variant.status === 'active' ? '' : 'text-gray-400'}>
                      <td className="px-3 py-2">
                        {variant.selectedValues.map((value) => value.value).filter(Boolean).join(' / ') || 'Variante'}
                        {variant.status !== 'active' && <span className="ml-1.5 text-xs">(inactiva)</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{variant.sku ?? '—'}</td>
                      {!inquiryMode && (
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(variant.price ?? effectiveProductPrice(product), 'es-CO', currency)}
                        </td>
                      )}
                      <td className={`px-3 py-2 text-right tabular-nums ${variant.stockQuantity <= 0 ? 'text-red-600' : ''}`}>{variant.stockQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Block>
      )}

      <Block title="Información">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3"><dt className="text-gray-500">Creado</dt><dd className="text-gray-800">{formatDate(product.createdAt)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-gray-500">Última edición</dt><dd className="text-gray-800">{formatDate(product.updatedAt)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-gray-500">URL</dt><dd className="truncate font-mono text-xs text-gray-800">/p/{product.slug}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-gray-500">Tienda online</dt><dd className="text-gray-800">{product.showInEcommerce ? 'Visible' : 'Oculto'}</dd></div>
          {isMenu && (
            <div className="flex justify-between gap-3"><dt className="text-gray-500">Carta digital</dt><dd className="text-gray-800">{product.showInCarta ? 'Visible' : 'Oculto'}</dd></div>
          )}
        </dl>
      </Block>
    </SideSheet>
  );
}
