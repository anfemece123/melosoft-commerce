import { Link, useLocation } from 'react-router-dom';
import { Clock, Tag } from 'lucide-react';
import type { StoreCampaignOffer } from '@/types/common.types';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from './storefrontTheme';
import { StorefrontMediaFrame } from './StorefrontMediaFrame';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { formatCurrency } from '@/utils/formatCurrency';
import { calculateDiscountPercentage } from '@/lib/pricing/pricing.utils';
import { writePublicScrollPosition } from '@/lib/storefront/publicScrollRestoration';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface StorefrontCampaignOffersSectionProps {
  campaigns: StoreCampaignOffer[];
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
}

/** Campaign offers grid — not a Home Builder section type (it's automatic
 * storefront behavior tied to active campaign offers, not owner-curated
 * content), so it renders unconditionally after either the dynamic Home
 * Builder sections or the legacy default body, same as before this
 * feature existed. */
export function StorefrontCampaignOffersSection({
  campaigns,
  theme,
  storeSlug,
  currency,
}: StorefrontCampaignOffersSectionProps) {
  const location = useLocation();
  if (campaigns.length === 0) return null;

  function persistCurrentScrollPosition() {
    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    writePublicScrollPosition(routeKey, window.scrollY);
  }

  return (
    <section id="storefront-offers" className="py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: theme.background }}>
      <div className={`${STOREFRONT_CONTAINER_CLASS} mx-auto`}>
        <div className="flex items-center gap-2 mb-6">
          <Tag className="w-5 h-5" style={{ color: theme.primary }} />
          <h2 className="text-lg font-bold" style={{ color: theme.text }}>
            Ofertas especiales
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => {
            const hasDiscount = campaign.regularPrice > 0 && campaign.offerPrice < campaign.regularPrice;
            const displayImage = campaign.heroImageUrl ?? campaign.productMainImageUrl;
            return (
              <Link
                key={campaign.id}
                to={buildStorefrontPath(storeSlug, `/o/${campaign.offerSlug}`)}
                state={{ fromStorefront: true, fromPath: `${location.pathname}${location.search}${location.hash}` }}
                onClick={persistCurrentScrollPosition}
                className="flex gap-4 overflow-hidden rounded-xl transition-opacity hover:opacity-90"
                style={{ backgroundColor: theme.surfaceAlt }}
              >
                {displayImage && (
                  <StorefrontMediaFrame
                    src={displayImage}
                    alt={campaign.title}
                    aspectClassName="h-20 w-20 shrink-0"
                    roundedClassName="rounded-lg"
                    className="bg-transparent"
                    imageClassName="h-full w-full object-cover"
                    pngImageClassName="h-full w-full object-cover p-0 drop-shadow-[0_8px_14px_rgba(15,23,42,0.08)]"
                    fallback={<div className="h-full w-full bg-gray-100" />}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm line-clamp-1" style={{ color: theme.text }}>
                    {campaign.title}
                  </p>
                  {campaign.productName && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: theme.mutedText }}>
                      {campaign.productName}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: theme.primary }}>
                      {formatCurrency(campaign.offerPrice, 'es-CO', currency)}
                    </span>
                    {hasDiscount && (
                      <>
                        <span className="text-xs line-through" style={{ color: theme.mutedText }}>
                          {formatCurrency(campaign.regularPrice, 'es-CO', currency)}
                        </span>
                        <DiscountBadge percentage={calculateDiscountPercentage(campaign.regularPrice, campaign.offerPrice)} />
                      </>
                    )}
                  </div>
                  {campaign.showCountdown && campaign.endsAt && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: theme.mutedText }}>
                      <Clock className="w-3 h-3" />
                      Oferta por tiempo limitado
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
