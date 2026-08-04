import { useEffect, useMemo, useState } from 'react';
import { ImageIcon, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { SwitchField } from '@/components/ui/SwitchField';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { StoreHeroSlidePreview } from './StoreHeroSlidePreview';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { categoriesService } from '@/features/categories/categoriesService';
import { collectionsService } from '@/features/collections/collectionsService';
import { offersService } from '@/features/offers/offersService';
import { productsService } from '@/features/products/productsService';
import type { Offer } from '@/features/offers/offers.types';
import type { ProductLinkOption } from '@/features/products/products.types';
import type {
  HeroCtaTargetType,
  PublicStoreCategory,
  PublicStoreCollection,
} from '@/types/common.types';
import { heroCtaTargetNeedsEntity } from '@/lib/storefront/heroCta';

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
  ctaTargetType: HeroCtaTargetType;
  ctaTargetId: string | null;
  ctaTargetUrl: string | null;
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
  storeId: string;
  catalogLabel: string;
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
  storeId,
  catalogLabel,
}: StoreHeroSlideEditorProps) {
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [collections, setCollections] = useState<PublicStoreCollection[]>([]);
  const [products, setProducts] = useState<ProductLinkOption[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [destinationsError, setDestinationsError] = useState<string | null>(null);
  const [loadedDestinationsStoreId, setLoadedDestinationsStoreId] = useState<string | null>(null);
  const destinationsLoading = loadedDestinationsStoreId !== storeId;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      categoriesService.getStoreCategories(storeId, { activeOnly: true }),
      collectionsService.getStoreCollections(storeId, { activeOnly: true }),
      productsService.getProductLinkOptionsByStore(storeId),
      offersService.getOffersByStore(storeId),
    ]).then(([categoryData, collectionData, productData, offerData]) => {
      if (cancelled) return;
      setCategories(categoryData);
      setCollections(collectionData);
      setProducts(productData);
      setOffers(offerData.filter((offer) => offer.status === 'active' && offer.isVisibleInStore));
      setDestinationsError(null);
    }).catch((error: unknown) => {
      if (!cancelled) {
        setDestinationsError(error instanceof Error ? error.message : 'No se pudieron cargar los destinos.');
      }
    }).finally(() => {
      if (!cancelled) setLoadedDestinationsStoreId(storeId);
    });
    return () => { cancelled = true; };
  }, [storeId]);

  const entityOptions = useMemo(() => {
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    if (slide.ctaTargetType === 'category') {
      return categories.map((category) => ({
        value: category.id,
        label: category.parentId
          ? `${categoryById.get(category.parentId)?.name ?? 'Categoría'} / ${category.name}`
          : category.name,
      }));
    }
    if (slide.ctaTargetType === 'collection') {
      return collections.map((collection) => ({ value: collection.id, label: collection.name }));
    }
    if (slide.ctaTargetType === 'product') {
      return products.map((product) => ({ value: product.id, label: product.name }));
    }
    if (slide.ctaTargetType === 'offer') {
      return offers.map((offer) => ({ value: offer.id, label: offer.title }));
    }
    return [];
  }, [categories, collections, offers, products, slide.ctaTargetType]);

  function patch(values: Partial<EditableStoreHeroSlide>) {
    onChange({ ...slide, ...values });
  }

  const catalogDestinationLabel = catalogLabel === 'Menú'
    ? 'Ver menú completo'
    : catalogLabel === 'Servicios'
      ? 'Ver todos los servicios'
      : 'Ver todos los productos';

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
            {slide.showCta ? (
              <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                <Select
                  id={`slide-${slide.id}-cta-destination`}
                  label="Destino del botón"
                  value={slide.ctaTargetType}
                  disabled={disabled}
                  onChange={(event) => patch({
                    ctaTargetType: event.target.value as HeroCtaTargetType,
                    ctaTargetId: null,
                    ctaTargetUrl: null,
                  })}
                  options={[
                    { value: 'catalog', label: catalogDestinationLabel },
                    { value: 'sale', label: 'Productos en promoción' },
                    { value: 'featured', label: 'Productos destacados' },
                    { value: 'category', label: 'Categoría o subcategoría específica' },
                    { value: 'collection', label: 'Colección específica' },
                    { value: 'product', label: 'Producto específico' },
                    { value: 'offer', label: 'Campaña u oferta específica' },
                    { value: 'custom', label: 'Enlace personalizado' },
                  ]}
                  hint={`“Ver ${catalogLabel.toLowerCase()}” abre la página completa, no una sección del inicio.`}
                />

                {heroCtaTargetNeedsEntity(slide.ctaTargetType) ? (
                  <Select
                    id={`slide-${slide.id}-cta-entity`}
                    label={slide.ctaTargetType === 'category'
                      ? 'Categoría'
                      : slide.ctaTargetType === 'collection'
                        ? 'Colección'
                        : slide.ctaTargetType === 'product'
                          ? 'Producto'
                          : 'Campaña u oferta'}
                    value={slide.ctaTargetId ?? ''}
                    placeholder={destinationsLoading ? 'Cargando opciones…' : 'Selecciona una opción'}
                    disabled={disabled || destinationsLoading}
                    onChange={(event) => patch({ ctaTargetId: event.target.value || null })}
                    options={entityOptions}
                    error={destinationsError ?? undefined}
                    hint={!destinationsLoading && !destinationsError && entityOptions.length === 0
                      ? 'No hay opciones públicas disponibles para este destino.'
                      : undefined}
                  />
                ) : null}

                {slide.ctaTargetType === 'custom' ? (
                  <Input
                    id={`slide-${slide.id}-cta-custom-url`}
                    label="URL o ruta"
                    value={slide.ctaTargetUrl ?? ''}
                    disabled={disabled}
                    placeholder="https://ejemplo.com o /policies"
                    hint="Acepta una dirección https:// o una ruta interna de esta tienda."
                    onChange={(event) => patch({ ctaTargetUrl: event.target.value || null })}
                  />
                ) : null}
              </div>
            ) : null}
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
