import type { ReactNode } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { PublicStoreLogo } from '@/components/public/storefront/PublicStoreLogo';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { EditableStoreHeroSlide } from './StoreHeroSlideEditor';

interface StoreHeroSlidePreviewProps {
  device: 'desktop' | 'mobile';
  slide: EditableStoreHeroSlide;
  theme: StorefrontTheme;
  storeName: string;
  logoUrl: string | null;
  onDeviceChange: (device: 'desktop' | 'mobile') => void;
}

export function StoreHeroSlidePreview({
  device,
  slide,
  theme,
  storeName,
  logoUrl,
  onDeviceChange,
}: StoreHeroSlidePreviewProps) {
  const title = slide.showTitle ? slide.title.trim() : '';
  const subtitle = slide.showSubtitle ? slide.subtitle.trim() : '';
  const ctaLabel = slide.showCta ? slide.ctaLabel.trim() : '';
  const badgeImageUrl = slide.showBadgeImage ? slide.badgeImageUrl ?? logoUrl : null;
  const isMobile = device === 'mobile';

  const fallbackBackground =
    theme.mode === 'dark'
      ? [
          'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.38) 100%)',
          'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.07) 0, transparent 14%)',
          'radial-gradient(circle at 82% 16%, rgba(255,255,255,0.06) 0, transparent 13%)',
          `linear-gradient(135deg, ${theme.background} 0%, #1a1a1a 52%, #090b0f 100%)`,
        ].join(', ')
      : [
          `radial-gradient(circle at 14% 22%, ${theme.softPrimary} 0, transparent 16%)`,
          'radial-gradient(circle at 82% 20%, rgba(255,255,255,0.58) 0, transparent 12%)',
          `linear-gradient(135deg, ${theme.secondary} 0%, #f9f7f2 45%, ${theme.background} 100%)`,
        ].join(', ');

  const heroBackgroundStyle = slide.backgroundImageUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(15, 23, 42, 0.24), rgba(15, 23, 42, 0.12)), url(${slide.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: fallbackBackground,
      };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-900">Vista previa</h4>
        <div className="flex rounded-full border border-gray-200 bg-gray-50 p-1">
          <PreviewTab
            active={device === 'desktop'}
            icon={<Monitor className="h-4 w-4" />}
            label="Web"
            onClick={() => onDeviceChange('desktop')}
          />
          <PreviewTab
            active={device === 'mobile'}
            icon={<Smartphone className="h-4 w-4" />}
            label="Móvil"
            onClick={() => onDeviceChange('mobile')}
          />
        </div>
      </div>

      <div
        className={[
          'mx-auto overflow-hidden rounded-[28px] border border-gray-200 shadow-sm',
          isMobile ? 'max-w-[320px]' : 'max-w-none',
        ].join(' ')}
        style={{ backgroundColor: theme.background }}
      >
        <div
          className="relative overflow-hidden"
          style={heroBackgroundStyle}
        >
          <div
            className={[
              'grid gap-6',
              isMobile
                ? 'px-5 pb-6 pt-5'
                : 'grid-cols-[minmax(0,1fr)_300px] items-center px-6 pb-6 pt-6',
            ].join(' ')}
          >
            <div className={isMobile ? 'order-2 text-center' : 'order-1'}>
              <div className={isMobile ? 'mx-auto max-w-[240px]' : 'max-w-[360px]'}>
                {title ? (
                  <h5
                    className={isMobile ? 'text-[20px] font-black leading-tight' : 'text-[28px] font-black leading-[1.02]'}
                    style={{ color: theme.text }}
                  >
                    {title}
                  </h5>
                ) : (
                  <div className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: theme.mutedText }}>
                    Sin título
                  </div>
                )}

                {subtitle ? (
                  <p
                    className={isMobile ? 'mt-3 text-[12px] leading-5' : 'mt-3 text-[13px] leading-5'}
                    style={{ color: theme.mutedText }}
                  >
                    {subtitle}
                  </p>
                ) : null}

                {ctaLabel ? (
                  <div className={isMobile ? 'mt-4' : 'mt-5'}>
                    <div
                      className={[
                        'inline-flex items-center justify-center rounded-full px-6 font-medium text-white',
                        isMobile ? 'h-10 min-w-[180px] text-sm' : 'h-10 min-w-[160px] text-sm',
                      ].join(' ')}
                      style={{ backgroundColor: theme.primary }}
                    >
                      {ctaLabel}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={isMobile ? 'order-1 flex justify-center' : 'order-2 flex justify-center'}>
              <div className="relative">
                <div
                  className={isMobile ? 'h-[170px] w-[170px] rounded-full' : 'h-[220px] w-[220px] rounded-full'}
                  style={{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#d8e0e8' }}
                />
                <div
                  className={[
                    'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full',
                    isMobile ? 'h-[138px] w-[138px]' : 'h-[186px] w-[186px]',
                  ].join(' ')}
                  style={{
                    background: theme.mode === 'dark'
                      ? 'radial-gradient(circle at 30% 18%, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 16%, transparent 16.5%), radial-gradient(circle at 50% 60%, rgba(0,0,0,0.22) 0, rgba(0,0,0,0.45) 100%), rgba(255,255,255,0.06)'
                      : 'radial-gradient(circle at 30% 18%, rgba(255,255,255,0.45) 0, rgba(255,255,255,0.45) 16%, transparent 16.5%), #d8e0e8',
                  }}
                >
                  {slide.showMainImage && slide.mainImageUrl ? (
                    <img src={slide.mainImageUrl} alt={storeName} className="h-full w-full object-contain" />
                  ) : slide.showMainImage ? (
                    <div className="flex h-full w-full items-center justify-center text-center text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>
                      Imagen
                    </div>
                  ) : null}
                </div>

                {slide.showBadgeImage && badgeImageUrl ? (
                  <div
                    className={[
                      'absolute right-0 top-0 flex items-center justify-center rounded-full border-[3px] bg-white p-[3px]',
                      isMobile ? 'h-[54px] w-[54px]' : 'h-[68px] w-[68px]',
                    ].join(' ')}
                    style={{
                      borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.18)' : '#d6dce2',
                      backgroundColor: theme.mode === 'dark' ? 'rgba(15,23,42,0.92)' : '#ffffff',
                    }}
                  >
                    {slide.badgeImageUrl ? (
                      <img src={slide.badgeImageUrl} alt={`${storeName} badge`} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <PublicStoreLogo
                        logoUrl={logoUrl}
                        storeName={storeName}
                        sizeClassName="h-full w-full"
                        fallbackColor={theme.primary}
                        outerClassName={theme.mode === 'dark' ? 'border border-white/10 bg-slate-950' : 'border border-gray-200 bg-white'}
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}
