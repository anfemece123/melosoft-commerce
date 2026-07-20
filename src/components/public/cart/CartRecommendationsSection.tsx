import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { StorefrontProductCard } from '@/components/public/storefront/StorefrontProductCard';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { productsService } from '@/features/products/productsService';
import type { PublicProductPage } from '@/types/common.types';
import { buildCatalogItems } from '@/lib/storefront/catalogItems';

interface CartRecommendationsSectionProps {
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  excludedProductIds: string[];
  unavailableProductIds: Set<string>;
  showCartButton: boolean;
  onAddToCart?: (event: MouseEvent<HTMLElement>, product: PublicProductPage) => void;
}

export function CartRecommendationsSection({
  theme,
  storeSlug,
  currency,
  isMenu,
  excludedProductIds,
  unavailableProductIds,
  showCartButton,
  onAddToCart,
}: CartRecommendationsSectionProps) {
  const [products, setProducts] = useState<PublicProductPage[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      try {
        const featuredResult = await productsService.searchPublicCatalogPage({
          storeSlug,
          onlyFeatured: true,
          sortKey: 'featured',
          offset: 0,
          limit: 12,
        });

        if (cancelled) return;

        if (featuredResult.products.length >= 4) {
          setProducts(featuredResult.products);
          return;
        }

        const fallbackResult = await productsService.searchPublicCatalogPage({
          storeSlug,
          sortKey: 'newest',
          offset: 0,
          limit: 12,
        });

        if (cancelled) return;

        const merged = [...featuredResult.products];
        for (const product of fallbackResult.products) {
          if (!merged.some((item) => item.productId === product.productId)) {
            merged.push(product);
          }
        }
        setProducts(merged);
      } catch {
        if (!cancelled) setProducts([]);
      }
    }

    void loadRecommendations();

    return () => { cancelled = true; };
  }, [storeSlug]);

  const excludedIdsSet = useMemo(() => new Set(excludedProductIds), [excludedProductIds]);
  const items = useMemo(
    () => buildCatalogItems(products.filter((product) => !excludedIdsSet.has(product.productId))).slice(0, 4),
    [products, excludedIdsSet]
  );

  if (items.length === 0) return null;

  return (
    <section className="mt-16 border-t pt-10" style={{ borderColor: theme.border }}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ color: theme.mutedText }}
          >
            Recomendado para ti
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((item) => {
          const product = item.product;
          const isUnavailable = unavailableProductIds.has(product.productId) || item.isOutOfStock;
          return (
            <div key={item.id} className="min-w-0">
              <StorefrontProductCard
                item={item}
                theme={theme}
                storeSlug={storeSlug}
                currency={currency}
                isMenu={isMenu}
                isUnavailable={isUnavailable}
                showCartButton={showCartButton}
                productCardCtaLabel={showCartButton ? 'Agregar' : 'Ver producto'}
                categoryLabel={product.categoryName}
                onAddToCart={onAddToCart}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
