import { useMemo, useState } from 'react';
import { EyeOff, Monitor, Smartphone } from 'lucide-react';
import type { PublicProductPage, PublicStoreCategory } from '@/types/common.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import {
  StorefrontSectionPreviewFrame,
  type PreviewDevice,
} from '@/components/admin/homeBuilder/previewFrame/StorefrontSectionPreviewFrame';
import { draftToPublicPreviewSection, draftHasRenderableContent, type HomeSectionDraft } from './homeSectionDraft';

interface WizardLivePreviewProps {
  draft: HomeSectionDraft;
  storeId: string;
  storeSlug: string;
  theme: StorefrontTheme;
  currency: string;
  isMenu: boolean;
  showCartButton: boolean;
  productCardCtaLabel: string;
  publicProducts: PublicProductPage[];
  categories: PublicStoreCategory[];
  /** Starts the wizard's own device toggle in sync with whatever the
   * canvas is currently showing — the toggle is still local from here on,
   * so switching it inside the wizard never affects the canvas. */
  initialDevice: PreviewDevice;
}

/** Renders the wizard's draft through the *real* public section renderer
 * (`HomeSectionRenderer` — the exact component the storefront home uses),
 * via the shared `StorefrontSectionPreviewFrame` — the same frame the
 * canvas's section cards use, so wizard/canvas/public never diverge into
 * three different-looking implementations. */
export function WizardLivePreview({
  draft,
  storeId,
  storeSlug,
  theme,
  currency,
  isMenu,
  showCartButton,
  productCardCtaLabel,
  publicProducts,
  categories,
  initialDevice,
}: WizardLivePreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>(initialDevice);
  const rootCategoriesCount = useMemo(() => categories.filter((category) => !category.parentId).length, [categories]);
  const hasContent = draftHasRenderableContent(draft, publicProducts.length, rootCategoriesCount);
  // Rebuilding this fresh every render is harmless on its own (the scaler/
  // mobile frame don't key off object identity), but memoizing keeps the
  // section reference stable across renders that don't actually touch the
  // draft, which is one less thing that can cascade through
  // HomeSectionRenderer's own prop-drilled children.
  const previewSection = useMemo(() => draftToPublicPreviewSection(draft, storeId), [draft, storeId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Vista previa</p>
          <p className="text-[11px] text-gray-400">Así se vería esta sección en tu tienda</p>
        </div>
        {!draft.isActive && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            <EyeOff className="h-3 w-3" />
            Inactiva
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setDevice('desktop')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
            device === 'desktop' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Monitor className="h-3.5 w-3.5" />
          Escritorio
        </button>
        <button
          type="button"
          onClick={() => setDevice('mobile')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
            device === 'mobile' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          Celular
        </button>
      </div>

      <div className={draft.isActive ? '' : 'opacity-60'}>
        <StorefrontSectionPreviewFrame
          section={previewSection}
          hasContent={hasContent}
          device={device}
          theme={theme}
          storeSlug={storeSlug}
          currency={currency}
          isMenu={isMenu}
          showCartButton={showCartButton}
          productCardCtaLabel={productCardCtaLabel}
          publicProducts={publicProducts}
          categories={categories}
          emptyStateMessage="Todavía no hay contenido para mostrar. Completa este paso para ver la vista previa."
          mobilePreviewScale={0.85}
          mobileMaxHeight={640}
          mobileClipMode="scroll"
        />
      </div>
    </div>
  );
}
