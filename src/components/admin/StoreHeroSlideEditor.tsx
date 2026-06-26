import { useState } from 'react';
import { ImageIcon, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { SwitchField } from '@/components/ui/SwitchField';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { StoreHeroSlidePreview } from './StoreHeroSlidePreview';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';

export interface EditableStoreHeroSlide {
  id: string;
  sortOrder: number;
  isActive: boolean;
  showTitle: boolean;
  showSubtitle: boolean;
  showCta: boolean;
  showMainImage: boolean;
  showBadgeImage: boolean;
  title: string;
  subtitle: string;
  ctaLabel: string;
  mainImageUrl: string | null;
  backgroundImageUrl: string | null;
  badgeImageUrl: string | null;
}

interface StoreHeroSlideEditorProps {
  slide: EditableStoreHeroSlide;
  disabled?: boolean;
  onChange: (slide: EditableStoreHeroSlide) => void;
  onRemove?: () => void;
  onMainImageSelect: (file: File | null) => void;
  onBackgroundImageSelect: (file: File | null) => void;
  onBadgeImageSelect: (file: File | null) => void;
  mainImageUploading?: boolean;
  backgroundImageUploading?: boolean;
  badgeImageUploading?: boolean;
  mainImageError?: string;
  backgroundImageError?: string;
  badgeImageError?: string;
  previewTheme: StorefrontTheme;
  storeName: string;
  logoUrl: string | null;
}

export function StoreHeroSlideEditor({
  slide,
  disabled = false,
  onChange,
  onRemove,
  onMainImageSelect,
  onBackgroundImageSelect,
  onBadgeImageSelect,
  mainImageUploading = false,
  backgroundImageUploading = false,
  badgeImageUploading = false,
  mainImageError,
  backgroundImageError,
  badgeImageError,
  previewTheme,
  storeName,
  logoUrl,
}: StoreHeroSlideEditorProps) {
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  function patch(values: Partial<EditableStoreHeroSlide>) {
    onChange({ ...slide, ...values });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Pantalla {slide.sortOrder}</h3>
              <span
                className={[
                  'rounded-full px-2.5 py-1 text-[11px] font-medium',
                  slide.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600',
                ].join(' ')}
              >
                {slide.isActive ? 'Visible' : 'Oculta'}
              </span>
            </div>
            <p className="text-xs text-gray-500">Puedes mostrarla sola o combinarla en carrusel.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor={`slide-${slide.id}-active`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
          >
            <div className="relative shrink-0">
              <input
                id={`slide-${slide.id}-active`}
                type="checkbox"
                className="peer sr-only"
                checked={slide.isActive}
                disabled={disabled}
                onChange={(event) => patch({ isActive: event.target.checked })}
              />
              <div className="h-5 w-9 rounded-full bg-gray-200 transition-colors peer-checked:bg-indigo-600" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </div>
            Mostrar
          </label>

          {onRemove ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Quitar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(460px,620px)] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_minmax(520px,700px)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <ImageUploadField
              id={`slide-${slide.id}-background-image-upload`}
              label="Imagen de fondo"
              assetKind="store_hero_background"
              previewUrl={slide.backgroundImageUrl}
              onFileSelect={onBackgroundImageSelect}
              onClear={() => patch({ backgroundImageUrl: null })}
              uploading={backgroundImageUploading}
              error={backgroundImageError}
              hint="Fondo completo de la portada."
              aspectClassName="h-28 w-full max-w-[240px] rounded-2xl"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <SwitchField
              id={`slide-${slide.id}-title`}
              label="Mostrar título"
              checked={slide.showTitle}
              disabled={disabled}
              onChange={(checked) => patch({ showTitle: checked })}
            />
            <div className="mt-4">
              <Input
                id={`slide-${slide.id}-title-input`}
                label="Título"
                value={slide.title}
                disabled={disabled || !slide.showTitle}
                maxLength={120}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <SwitchField
              id={`slide-${slide.id}-subtitle`}
              label="Mostrar subtítulo"
              checked={slide.showSubtitle}
              disabled={disabled}
              onChange={(checked) => patch({ showSubtitle: checked })}
            />
            <div className="mt-4">
              <Textarea
                id={`slide-${slide.id}-subtitle-input`}
                label="Subtítulo"
                rows={3}
                value={slide.subtitle}
                disabled={disabled || !slide.showSubtitle}
                maxLength={260}
                onChange={(event) => patch({ subtitle: event.target.value })}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <SwitchField
              id={`slide-${slide.id}-cta`}
              label="Mostrar botón"
              description="Botón de acción"
              checked={slide.showCta}
              disabled={disabled}
              onChange={(checked) => patch({ showCta: checked })}
            />
            <div className="mt-4">
              <Input
                id={`slide-${slide.id}-cta-label`}
                label="Texto del botón"
                value={slide.ctaLabel}
                disabled={disabled || !slide.showCta}
                maxLength={40}
                onChange={(event) => patch({ ctaLabel: event.target.value })}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <SwitchField
              id={`slide-${slide.id}-main-image`}
              label="Mostrar imagen principal"
              description="Se muestra en formato circular en la portada."
              checked={slide.showMainImage}
              disabled={disabled}
              onChange={(checked) => patch({ showMainImage: checked })}
            />
            <div className="mt-4">
              <ImageUploadField
                id={`slide-${slide.id}-main-image-upload`}
                label="Imagen principal"
                assetKind="store_hero"
                previewUrl={slide.mainImageUrl}
                onFileSelect={onMainImageSelect}
                onClear={() => patch({ mainImageUrl: null })}
                uploading={mainImageUploading}
                error={mainImageError}
                hint="Vista circular de la imagen principal."
                aspectClassName="h-32 w-32 rounded-full"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <SwitchField
              id={`slide-${slide.id}-badge`}
              label="Mostrar imagen pequeña"
              description="Sello pequeño superior."
              checked={slide.showBadgeImage}
              disabled={disabled}
              onChange={(checked) => patch({ showBadgeImage: checked })}
            />
            <div className="mt-4">
              <ImageUploadField
                id={`slide-${slide.id}-badge-image-upload`}
                label="Imagen pequeña superior"
                assetKind="store_hero_badge"
                previewUrl={slide.badgeImageUrl}
                onFileSelect={onBadgeImageSelect}
                onClear={() => patch({ badgeImageUrl: null })}
                uploading={badgeImageUploading}
                error={badgeImageError}
                hint="Formato circular."
                aspectClassName="h-24 w-24 rounded-full"
              />
            </div>
          </div>
        </div>

        <div className="xl:sticky xl:top-6">
          <div className="mx-auto w-full max-w-[700px]">
            <StoreHeroSlidePreview
              device={previewDevice}
              slide={slide}
              theme={previewTheme}
              storeName={storeName}
              logoUrl={logoUrl}
              onDeviceChange={setPreviewDevice}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
