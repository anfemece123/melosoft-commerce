import type { PublicHomeSection, PublicProductPage, PublicStoreCategory } from '@/types/common.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { HomeSectionRenderer } from '@/components/public/storefront/homeSections/HomeSectionRenderer';
import { StorefrontViewportScaler } from './StorefrontViewportScaler';
import { StorefrontMobileFrame, type MobileClipMode } from './StorefrontMobileFrame';

const EMPTY_UNAVAILABLE_IDS = new Set<string>();

export type PreviewDevice = 'desktop' | 'mobile';

interface StorefrontSectionPreviewFrameProps {
  section: PublicHomeSection;
  hasContent: boolean;
  device: PreviewDevice;
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  showCartButton: boolean;
  productCardCtaLabel: string;
  publicProducts: PublicProductPage[];
  categories: PublicStoreCategory[];
  emptyStateMessage?: string;
  /** Visual shrink for the mobile mockup — the canvas wants it compact
   * (several cards visible at once), the wizard can afford it a bit
   * bigger since it's the sole focus there. Purely cosmetic, see
   * StorefrontMobileFrame's `scale` prop. */
  mobilePreviewScale?: number;
  /** Caps the mobile mockup's on-screen height. */
  mobileMaxHeight?: number;
  /** 'fade' (canvas default): hard-clip past mobileMaxHeight with a
   * bottom gradient, never scrollable — the canvas is for organizing
   * sections, not reading every product in one. 'scroll' (wizard): lets
   * the owner scroll past the cap to review the whole section, native
   * scrollbar hidden via CSS. */
  mobileClipMode?: MobileClipMode;
}

/** The one place that actually renders a section through the *real* public
 * `HomeSectionRenderer` for admin preview purposes — used by both the
 * wizard's live preview and the canvas's per-section cards, so "what the
 * owner sees while editing," "what the owner sees on the section list,"
 * and "what's actually live" can never visually diverge into three
 * different implementations.
 *
 * Interactions are neutralized two different ways depending on `device`:
 * - desktop (StorefrontViewportScaler renders in the *same* document) —
 *   the click/submit capture-phase wrapper below is enough, since it sits
 *   in the same React tree and DOM document as the rendered links/buttons.
 * - mobile (StorefrontMobileFrame renders inside an iframe, a genuinely
 *   different document) — that capture-phase wrapper physically cannot
 *   see native events happening inside the iframe, so StorefrontMobileFrame
 *   itself registers a native listener directly on the iframe's document.
 *   See that file for why. The wrapper here is kept regardless, as a
 *   harmless extra guard on the iframe element itself. */
export function StorefrontSectionPreviewFrame({
  section,
  hasContent,
  device,
  theme,
  storeSlug,
  currency,
  isMenu,
  showCartButton,
  productCardCtaLabel,
  publicProducts,
  categories,
  emptyStateMessage,
  mobilePreviewScale = 0.8,
  mobileMaxHeight,
  mobileClipMode = 'fade',
}: StorefrontSectionPreviewFrameProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      {/* Faint "rest of the page" context above/below so the section
          doesn't feel like it's floating in a void. */}
      <div className="h-3" style={{ backgroundColor: theme.secondary }} />

      {!hasContent ? (
        <div className="flex min-h-[160px] items-center justify-center bg-white px-6 py-10 text-center">
          <p className="text-sm text-gray-400">
            {emptyStateMessage ?? 'Todavía no hay contenido para mostrar.'}
          </p>
        </div>
      ) : (
        <div
          onClickCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onSubmitCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="bg-white"
        >
          {device === 'mobile' ? (
            <div className="flex justify-center py-2.5" style={{ backgroundColor: theme.secondary }}>
              <StorefrontMobileFrame
                backgroundColor={theme.background}
                scale={mobilePreviewScale}
                maxHeight={mobileMaxHeight}
                clipMode={mobileClipMode}
              >
                <HomeSectionRenderer
                  section={section}
                  theme={theme}
                  storeSlug={storeSlug}
                  currency={currency}
                  isMenu={isMenu}
                  showCartButton={showCartButton}
                  productCardCtaLabel={productCardCtaLabel}
                  products={publicProducts}
                  categories={categories}
                  unavailableProductIds={EMPTY_UNAVAILABLE_IDS}
                />
              </StorefrontMobileFrame>
            </div>
          ) : (
            <StorefrontViewportScaler backgroundColor={theme.background}>
              <HomeSectionRenderer
                section={section}
                theme={theme}
                storeSlug={storeSlug}
                currency={currency}
                isMenu={isMenu}
                showCartButton={showCartButton}
                productCardCtaLabel={productCardCtaLabel}
                products={publicProducts}
                categories={categories}
                unavailableProductIds={EMPTY_UNAVAILABLE_IDS}
              />
            </StorefrontViewportScaler>
          )}
        </div>
      )}

      <div className="h-3" style={{ backgroundColor: theme.secondary }} />
    </div>
  );
}
