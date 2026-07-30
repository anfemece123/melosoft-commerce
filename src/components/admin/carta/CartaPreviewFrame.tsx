import { Monitor, Smartphone } from 'lucide-react';
import { CartaMenu } from '@/components/public/carta/CartaMenu';
import type { PublicCartaPage } from '@/features/carta/carta.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { StorefrontMobileFrame } from '@/components/admin/homeBuilder/previewFrame/StorefrontMobileFrame';
import { StorefrontViewportScaler } from '@/components/admin/homeBuilder/previewFrame/StorefrontViewportScaler';

export type CartaPreviewDevice = 'desktop' | 'mobile';

interface CartaPreviewFrameProps {
  page: PublicCartaPage;
  theme: StorefrontTheme;
  device: CartaPreviewDevice;
  onDeviceChange: (device: CartaPreviewDevice) => void;
}

export function CartaPreviewFrame({ page, theme, device, onDeviceChange }: CartaPreviewFrameProps) {
  const previewProducts = page.categories.flatMap((category) => category.products);
  const imageCount = page.categories.reduce((total, category) => {
    const imageMode = category.id ? page.categoryImageModes[category.id] ?? page.productImageMode : page.productImageMode;
    if (imageMode === 'none') return total;
    if (imageMode === 'first_per_category') {
      return total + Number(Boolean(category.imageUrl || category.products.some((product) => product.imageUrl)));
    }
    return total + category.products.filter((product) => product.imageUrl).length;
  }, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <div className="ml-2 hidden rounded-md bg-gray-100 px-3 py-1 text-[11px] text-gray-500 sm:block">
            {previewProducts.length} platos · {imageCount} {imageCount === 1 ? 'foto visible' : 'fotos visibles'}
          </div>
        </div>
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => onDeviceChange('desktop')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${device === 'desktop' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            aria-pressed={device === 'desktop'}
          >
            <Monitor className="h-3.5 w-3.5" /> Escritorio
          </button>
          <button
            type="button"
            onClick={() => onDeviceChange('mobile')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${device === 'mobile' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            aria-pressed={device === 'mobile'}
          >
            <Smartphone className="h-3.5 w-3.5" /> Celular
          </button>
        </div>
      </div>

      <div className="min-h-[420px] bg-gray-100 p-3 sm:p-5">
        {device === 'mobile' ? (
          <div className="flex justify-center" data-carta-preview-scroll="mobile">
            <StorefrontMobileFrame
              backgroundColor={theme.background}
              scale={0.78}
              maxHeight={640}
              clipMode="scroll"
              allowInteractions
            >
              <CartaMenu page={page} theme={theme} preview />
            </StorefrontMobileFrame>
          </div>
        ) : (
          <div
            className="relative max-h-[640px] overflow-x-hidden overflow-y-auto rounded-xl border border-gray-200 shadow-sm"
            data-carta-preview-scroll="desktop"
          >
            <StorefrontViewportScaler backgroundColor={theme.background}>
              <CartaMenu page={page} theme={theme} preview />
            </StorefrontViewportScaler>
          </div>
        )}
      </div>
    </div>
  );
}
