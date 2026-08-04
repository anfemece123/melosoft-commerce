import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productsService } from '@/features/products/productsService';
import { getActivePrice } from '@/lib/pricing/pricing.utils';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import type { PublicProductPage } from '@/types/common.types';
import { formatCurrency } from '@/utils/formatCurrency';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

interface CartUpsellSectionProps {
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  productIds: string[];
  unavailableProductIds: ReadonlySet<string>;
  onAdd: (product: PublicProductPage) => void;
}

export function CartUpsellSection({
  theme,
  storeSlug,
  currency,
  productIds,
  unavailableProductIds,
  onAdd,
}: CartUpsellSectionProps) {
  const productKey = useMemo(() => Array.from(new Set(productIds)).sort().join(','), [productIds]);
  const requestKey = `${storeSlug}:${productKey}`;
  const [result, setResult] = useState<{
    requestKey: string;
    groups: Array<{ title: string; products: PublicProductPage[] }>;
  } | null>(null);

  useEffect(() => {
    if (!productKey) {
      return;
    }
    let cancelled = false;
    void productsService.getPublicCartUpsells(storeSlug, productKey.split(','), 3)
      .then((result) => {
        if (cancelled) return;
        setResult({ requestKey, groups: result });
      })
      .catch(() => {
        if (!cancelled) setResult({ requestKey, groups: [] });
      });
    return () => { cancelled = true; };
  }, [productKey, requestKey, storeSlug]);

  const groups = result?.requestKey === requestKey ? result.groups : [];

  if (groups.length === 0) return null;

  return (
    <div className="border-t pt-4" style={{ borderColor: theme.border }}>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="text-sm font-semibold" style={{ color: theme.text }}>{group.title}</p>
            <p className="mt-0.5 text-xs" style={{ color: theme.mutedText }}>Agrégalo sin salir de tu pedido.</p>
            <div className="mt-3 space-y-2">
              {group.products.map((product) => {
                const unavailable = unavailableProductIds.has(product.productId) || !product.isAvailable;
                const needsConfiguration = product.hasVariants || product.hasOptions;
                const price = getActivePrice(product.regularPrice, product.salePrice);
                return (
                  <div key={product.productId} className="flex items-center gap-3 rounded-xl border p-2" style={{ borderColor: theme.border }}>
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: theme.surfaceAlt }}>
                      {product.mainImageUrl ? (
                        <img src={product.mainImageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><ShoppingBag className="h-4 w-4 opacity-30" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: theme.text }}>{product.productName}</p>
                      <p className="text-xs font-semibold" style={{ color: theme.primary }}>{formatCurrency(price, 'es-CO', currency)}</p>
                    </div>
                    {unavailable ? (
                      <span className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ color: theme.mutedText, backgroundColor: theme.surfaceAlt }}>
                        No disponible
                      </span>
                    ) : needsConfiguration ? (
                      <Link
                        to={buildStorefrontPath(storeSlug, `/p/${product.productSlug}`)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold"
                        style={{ color: theme.primary, backgroundColor: theme.softPrimary }}
                      >
                        Elegir <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={unavailable}
                        onClick={() => onAdd(product)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ backgroundColor: theme.primary }}
                        aria-label={`Agregar ${product.productName}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
