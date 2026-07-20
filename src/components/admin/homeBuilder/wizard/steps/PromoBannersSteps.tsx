import { useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SwitchField } from '@/components/ui/SwitchField';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import type { ImageAssetKind } from '@/lib/images/imageAssetPresets';
import { InfoStep } from './InfoStep';
import type { WizardStepProps } from '../sectionWizardSteps.types';
import { createEmptyDraftItem, effectiveDraftItems, type HomeSectionDraftItem } from '../homeSectionDraft';
import {
  parsePromoBannerSettings,
  defaultPromoBannerSettings,
  serializePromoBannerSettings,
  promoBannerCountForLayout,
  PROMO_BANNER_LAYOUT_LABELS,
  PROMO_BANNER_BACKGROUND_LABELS,
  PROMO_BANNER_GRADIENT_LABELS,
  PROMO_BANNER_OVERLAY_LABELS,
  PROMO_BANNER_CONTENT_POSITION_LABELS,
  PROMO_SECTION_SIZE_LABELS,
  PROMO_SECTION_SIZE_HINTS,
  PROMO_CONTENT_SIZE_LABELS,
  PROMO_CONTENT_SIZE_HINTS,
  PROMO_BUTTON_SIZE_LABELS,
  PROMO_BUTTON_SIZE_HINTS,
  PROMO_CONTENT_WIDTH_LABELS,
  PROMO_CONTENT_WIDTH_HINTS,
  PROMO_SECTION_SPACING_LABELS,
  PROMO_SECTION_SPACING_HINTS,
  PROMO_SECTION_SPACING_GAP_CLASSES,
  PROMO_TEXT_COLOR_MODE_LABELS,
  PROMO_TEXT_COLOR_MODE_HINTS,
  PROMO_BUTTON_COLOR_MODE_LABELS,
  PROMO_BUTTON_COLOR_MODE_HINTS,
  PROMO_BUTTON_VARIANT_LABELS,
  PROMO_BUTTON_VARIANT_HINTS,
  PROMO_CONTENT_BACKGROUND_MODE_LABELS,
  PROMO_CONTENT_BACKGROUND_MODE_HINTS,
  PROMO_CONTENT_BACKGROUND_OPACITY_LABELS,
  promoRecommendedTitleLength,
  promoRecommendedSubtitleLength,
  promoRecommendedEyebrowLength,
  promoRecommendedButtonLabelLength,
  isPromoBannerContentEmpty,
  type PromoBannerSettings,
  type PromoBannerContentPosition,
  type PromoSectionSize,
  type PromoContentSize,
  type PromoButtonSize,
  type PromoContentWidth,
  type PromoSectionSpacing,
} from '@/features/homeSections/promoBanner.types';

export function PromoBannersInfoStep(props: WizardStepProps) {
  return <InfoStep {...props} headingPlaceholder="Promociones" />;
}

const STRUCTURE_GRID_CLASSES: Record<'grid_1' | 'grid_2', string> = {
  grid_1: '',
  grid_2: 'sm:grid-cols-2',
};

/** Purely visual height per shell tier for the structural wireframe —
 * proportional, not pixel-accurate to the real renderer's padding, but
 * reads the size difference the Select describes ("Compacto" vs
 * "Destacado") at a glance, before any real banner content exists to
 * preview instead. */
// `min-h-*` (not a fixed `h-*`) so a 2-line example title never overlaps
// the CTA pill below it — the wireframe grows with its own content
// instead of clipping/overlapping like a fixed-height box would.
const STRUCTURE_HEIGHT_CLASSES: Record<PromoSectionSize, string> = {
  compact: 'min-h-24',
  normal: 'min-h-32',
  large: 'min-h-40',
  featured: 'min-h-48',
};

/** Realistic example copy per position in the grid — real words (not gray
 * bars) so the wireframe actually shows whether a title like "Combo
 * especial de temporada" *fits* at a given count, not just an abstract
 * rectangle that always looks fine. */
const STRUCTURE_EXAMPLE_COPY = [
  { eyebrow: 'OFERTA', title: 'Combo especial de temporada', subtitle: 'Aprovecha antes de que se acabe' },
  { eyebrow: 'NUEVO', title: 'Descubre la colección', subtitle: 'Diseños pensados para ti' },
];

/** Structural wireframe for the "Diseño" step — count/size/spacing don't
 * have any real banner content yet to preview through the real renderer
 * (a brand-new section's `draft.items` is still empty at this step), so
 * this gives immediate visual feedback on its own instead of leaving the
 * owner to guess. Mirrors the real renderer's grid/gap classes so it never
 * shows a taller/shorter result than what will actually render. Uses
 * realistic example copy (clamped the same way the real renderer clamps
 * it) rather than abstract bars — the point is to catch "this title looks
 * cramped" *before* the owner has typed real content, not to look tidy no
 * matter what. */
function StructurePreview({
  layout,
  sectionSize,
  spacing,
}: {
  layout: 'grid_1' | 'grid_2';
  sectionSize: PromoSectionSize;
  spacing: PromoSectionSpacing;
}) {
  const count = promoBannerCountForLayout(layout);
  const titleClassName = count === 2 ? 'text-base' : 'text-lg';

  return (
    <div className="space-y-2.5 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Vista previa de estructura</p>
      <div className={`grid grid-cols-1 ${PROMO_SECTION_SPACING_GAP_CLASSES[spacing]} ${STRUCTURE_GRID_CLASSES[layout]}`}>
        {Array.from({ length: count }).map((_, i) => {
          const example = STRUCTURE_EXAMPLE_COPY[i % STRUCTURE_EXAMPLE_COPY.length];
          return (
            <div
              key={i}
              className={`flex flex-col justify-between gap-2 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-500 to-indigo-400 p-3 ${STRUCTURE_HEIGHT_CLASSES[sectionSize]}`}
            >
              <span className="inline-flex w-fit items-center rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                {example.eyebrow}
              </span>
              <div className="space-y-1">
                <p className={`line-clamp-2 font-bold leading-tight text-white ${titleClassName}`}>{example.title}</p>
                <p className="line-clamp-1 text-[11px] text-white/80">{example.subtitle}</p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-900">
                Comprar ahora
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400">
        Representación aproximada con texto de ejemplo — el diseño final depende del tipo de banner que elijas para cada uno.
      </p>
    </div>
  );
}

/** Step 2 — structure only: how many banners (max 2), their general size
 * tier and (with 2) the spacing between them. Deliberately does NOT include
 * contentSize/buttonSize/contentWidth anymore — those depend on real
 * banner content (title/subtitle/image) to judge visually, which doesn't
 * exist yet at this step for a brand-new section, so they moved to the
 * "Banners" step's "Apariencia general" block, right next to the real
 * live preview (see PromoBannersItemsStep). This step gets its own
 * StructurePreview wireframe instead, so count/size/spacing still have
 * immediate visual feedback without needing real content. */
export function PromoBannersDesignStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'promo_banners' ? draft.content : null;
  if (!content) return null;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-900">¿Cuántos banners quieres mostrar?</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              { value: 'grid_1', label: '1 banner principal', hint: 'Ideal para una promoción destacada.' },
              { value: 'grid_2', label: '2 banners', hint: 'Perfecto para mostrar dos promociones equilibradas.' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateDraft({ content: { ...content, layout: option.value } })}
              className={`rounded-xl border p-4 text-left transition-colors ${
                content.layout === option.value
                  ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Mini visual preview of the grid shape, not just a label. */}
              <div className="mb-3 flex h-10 gap-1">
                {Array.from({ length: promoBannerCountForLayout(option.value) }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-md bg-gray-300" />
                ))}
              </div>
              <p className="text-sm font-semibold text-gray-900">{option.label}</p>
              <p className="text-xs text-gray-500">{option.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-900">Tamaño general de la sección</p>
          <Select
            value={content.sectionSize}
            onChange={(e) => updateDraft({ content: { ...content, sectionSize: e.target.value as PromoSectionSize } })}
            options={(Object.entries(PROMO_SECTION_SIZE_LABELS) as [PromoSectionSize, string][]).map(([value, label]) => ({
              value,
              label: `${label} — ${PROMO_SECTION_SIZE_HINTS[value]}`,
            }))}
            hint="Altura y padding del fondo de cada banner. Punto de partida — podrás afinar el contenido en el siguiente paso."
          />
        </div>

        {content.layout !== 'grid_1' && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-900">Espaciado entre banners</p>
            <Select
              value={content.spacing}
              onChange={(e) => updateDraft({ content: { ...content, spacing: e.target.value as PromoSectionSpacing } })}
              options={(Object.entries(PROMO_SECTION_SPACING_LABELS) as [PromoSectionSpacing, string][]).map(([value, label]) => ({
                value,
                label: `${label} — ${PROMO_SECTION_SPACING_HINTS[value]}`,
              }))}
              hint="Separación entre los banners de la grilla."
            />
          </div>
        )}
      </div>

      <StructurePreview layout={content.layout} sectionSize={content.sectionSize} spacing={content.spacing} />

      <p className="text-xs text-gray-400">
        En el siguiente paso ajustarás el tamaño del texto, del botón y el ancho del contenido viendo el banner real —
        aquí solo defines la estructura general.
      </p>
    </div>
  );
}

/** "Apariencia general" — contentSize/buttonSize/contentWidth, moved here
 * (out of the "Diseño" step) precisely because they only make sense next
 * to the real, live preview: by this step `draft.items` already has real
 * (even if still empty) banners, and the owner is actively filling in
 * title/image/style right here, so changing "Tamaño del botón" and seeing
 * the actual button react is possible — it wasn't in "Diseño", where no
 * real banner content exists yet to render. */
function GeneralAppearanceFields({ draft, updateDraft }: Pick<WizardStepProps, 'draft' | 'updateDraft'>) {
  const content = draft.content.sectionType === 'promo_banners' ? draft.content : null;
  if (!content) return null;

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">Apariencia general</p>
        <p className="text-xs text-gray-500">
          Se aplica a todos los banners de esta sección — ajusta viendo la vista previa real.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Tamaño del contenido"
          value={content.contentSize}
          onChange={(e) => updateDraft({ content: { ...content, contentSize: e.target.value as PromoContentSize } })}
          options={(Object.entries(PROMO_CONTENT_SIZE_LABELS) as [PromoContentSize, string][]).map(([value, label]) => ({
            value,
            label: `${label} — ${PROMO_CONTENT_SIZE_HINTS[value]}`,
          }))}
          hint="Tamaño del texto pequeño, título y subtítulo."
        />

        <Select
          label="Tamaño del botón"
          value={content.buttonSize}
          onChange={(e) => updateDraft({ content: { ...content, buttonSize: e.target.value as PromoButtonSize } })}
          options={(Object.entries(PROMO_BUTTON_SIZE_LABELS) as [PromoButtonSize, string][]).map(([value, label]) => ({
            value,
            label: `${label} — ${PROMO_BUTTON_SIZE_HINTS[value]}`,
          }))}
          hint="Alto, padding y tamaño de texto del botón."
        />

        <Select
          label="Ancho del contenido"
          value={content.contentWidth}
          onChange={(e) => updateDraft({ content: { ...content, contentWidth: e.target.value as PromoContentWidth } })}
          options={(Object.entries(PROMO_CONTENT_WIDTH_LABELS) as [PromoContentWidth, string][]).map(([value, label]) => ({
            value,
            label: `${label} — ${PROMO_CONTENT_WIDTH_HINTS[value]}`,
          }))}
          hint="Cuánto espacio ocupa el bloque de texto dentro del banner."
        />
      </div>
    </div>
  );
}

/** Step 3 — shows exactly as many "Banner N" blocks as the previous step's
 * count, no add/remove/reorder controls (the count already decided that).
 * Reconciles `draft.items` to that count on mount and whenever the count
 * changes: pads with empty banners if the array is shorter, and never
 * truncates if it's longer — a banner beyond the current count just
 * becomes inert (see effectiveDraftItems), so lowering the count and
 * raising it again brings back whatever was already typed instead of
 * silently discarding it. */
export function PromoBannersItemsStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'promo_banners' ? draft.content : null;
  const count = content ? promoBannerCountForLayout(content.layout) : 0;

  useEffect(() => {
    if (!content || draft.items.length >= count) return;
    const missing = count - draft.items.length;
    updateDraft({
      items: [
        ...draft.items,
        ...Array.from({ length: missing }, () => ({
          ...createEmptyDraftItem(),
          settings: serializePromoBannerSettings(defaultPromoBannerSettings()),
        })),
      ],
    });
    // Only re-run when the target count itself changes — draft.items and
    // updateDraft change on every keystroke in this same step, which would
    // otherwise re-trigger this padding effect constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (!content) return null;

  const visibleItems = effectiveDraftItems(draft);
  // A section saved before the max was lowered to 2 can still have older
  // items sitting in `draft.items` beyond the current count — inert
  // (never shown, never previewed, never saved, per effectiveDraftItems),
  // but the owner deserves to know why a banner they remember configuring
  // isn't here anymore, instead of silently losing it.
  const hasLegacyExtraItems = draft.items.length > count;

  function updateItem(index: number, patch: Partial<HomeSectionDraftItem>) {
    updateDraft({ items: draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  return (
    <div className="space-y-5">
      {hasLegacyExtraItems && (
        <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <p>Esta sección tenía más banners, pero ahora el máximo permitido es 2 para mantener un diseño profesional.</p>
        </div>
      )}
      <GeneralAppearanceFields draft={draft} updateDraft={updateDraft} />

      <div className="space-y-4">
        {visibleItems.map((item, index) => {
          const isEmpty = item.isActive && isPromoBannerContentEmpty(item);
          return (
            <div
              key={item.clientId}
              className={`rounded-xl border bg-white ${isEmpty ? 'border-amber-300' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-sm font-semibold text-gray-700">Banner {index + 1}</p>
                <SwitchField
                  id={`banner-active-${item.clientId}`}
                  label="Activo"
                  checked={item.isActive}
                  onChange={(checked) => updateItem(index, { isActive: checked })}
                />
              </div>
              {isEmpty && (
                <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    Completa este banner (imagen, título, subtítulo o botón) o reduce la cantidad seleccionada en el paso
                    "Diseño" — un banner vacío nunca se muestra en tu tienda ni se puede guardar.
                  </p>
                </div>
              )}
              <div className="space-y-3 p-3">
                <BannerFields item={item} update={(patch) => updateItem(index, patch)} bannerCount={count} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 9-position picker for image_focus's `contentPosition` — a compact 3x3
 * grid of dots is far more legible at a glance than a 9-option <Select>,
 * and doubles as a tiny diagram of where the text will actually land. */
const CONTENT_POSITION_GRID: PromoBannerContentPosition[] = [
  'top_left', 'top_center', 'top_right',
  'center_left', 'center', 'center_right',
  'bottom_left', 'bottom_center', 'bottom_right',
];

function ContentPositionPicker({
  value,
  onChange,
}: {
  value: PromoBannerContentPosition;
  onChange: (value: PromoBannerContentPosition) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">Posición del contenido</label>
      <div className="grid w-32 grid-cols-3 gap-1.5 rounded-xl border border-gray-200 bg-gray-100 p-2">
        {CONTENT_POSITION_GRID.map((position) => (
          <button
            key={position}
            type="button"
            title={PROMO_BANNER_CONTENT_POSITION_LABELS[position]}
            aria-label={PROMO_BANNER_CONTENT_POSITION_LABELS[position]}
            aria-pressed={value === position}
            onClick={() => onChange(position)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
              value === position ? 'border-indigo-500 bg-indigo-500' : 'border-gray-200 bg-white hover:border-indigo-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${value === position ? 'bg-white' : 'bg-gray-300'}`} />
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">{PROMO_BANNER_CONTENT_POSITION_LABELS[value]} — dónde se ubica el texto sobre la imagen.</p>
    </div>
  );
}

/** Soft character-count guidance — never blocks typing or saving, just
 * tells the owner where they stand. Plain gray hint text under the limit
 * (matches every other hint in this wizard); past it, a short, specific
 * note instead of just a scary number, per "no quiero mensajes molestos,
 * pero sí guías profesionales". */
function lengthHint(value: string, max: number, overLimitNote: string): string {
  const length = value.length;
  return length > max ? `${length}/${max} — ${overLimitNote}` : `${length}/${max} caracteres`;
}

function promoBannerImageAssetKind(layout: PromoBannerSettings['layout'], bannerCount: number): ImageAssetKind {
  if (layout === 'split') return 'promo_banner_split';
  if (layout === 'promo_card' && bannerCount === 2) return 'home_section_image';
  return 'promo_banner_wide';
}

function promoBannerImageHint(assetKind: ImageAssetKind): string {
  switch (assetKind) {
    case 'promo_banner_split':
      return 'Formato 4:3 · 1600×1200 px. Coincide con el espacio de imagen junto al texto y se muestra completa.';
    case 'home_section_image':
      return 'Formato 16:9 · 1920×1080 px. Ideal para cada tarjeta cuando muestras dos banners.';
    case 'promo_banner_wide':
    default:
      return 'Formato panorámico 3:1 · 1800×600 px. Mantén logos y texto importante en la zona central para celular.';
  }
}

function promoBannerUploadPreviewClass(assetKind: ImageAssetKind): string {
  if (assetKind === 'promo_banner_split') return 'h-24 w-32 rounded-xl';
  if (assetKind === 'home_section_image') return 'h-24 w-[171px] rounded-xl';
  return 'h-20 w-60 rounded-xl';
}

function BannerFields({
  item,
  update,
  bannerCount,
}: {
  item: HomeSectionDraftItem;
  update: (patch: Partial<HomeSectionDraftItem>) => void;
  bannerCount: number;
}) {
  const settings = parsePromoBannerSettings(item.settings);
  const imageAssetKind = promoBannerImageAssetKind(settings.layout, bannerCount);

  function updateSettings(patch: Partial<PromoBannerSettings>) {
    update({ settings: { ...settings, ...patch } });
  }

  // Whether the overlay control is actually meaningful right now — only
  // when there's an image to put a legibility scrim over: image_focus
  // always shows the image, other layouts only when the owner picked
  // "Imagen de fondo" as their background.
  const showOverlayControl = settings.layout === 'image_focus' || settings.backgroundType === 'image';
  // "Fondo del banner" paints the *entire* card — only meaningful for the
  // two layouts with no separate text box (hero_center, minimal).
  // split/promo_card show a dedicated "Fondo del bloque de texto" instead
  // (below), and image_focus's text sits directly on the image (overlay
  // handles legibility there, not a background color).
  const showBannerBackgroundControl = settings.layout === 'hero_center' || settings.layout === 'minimal';
  // "Fondo del bloque de texto" — only the two layouts with an actual
  // separate, colorable text box next to/below the image.
  const showContentBackgroundControl = settings.layout === 'split' || settings.layout === 'promo_card';
  const showContentAlignControl = settings.layout === 'hero_center' || settings.layout === 'promo_card';

  return (
    <>
      {/* The composition comes first because it determines the crop ratio.
          Asking for the image before this choice was the root mismatch:
          every upload was forced to 16:9 even when the renderer needed a
          panoramic or 4:3 asset. */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Composición</p>
        <Select
          label="Tipo de banner"
          value={settings.layout}
          onChange={(e) => {
            const layout = e.target.value as PromoBannerSettings['layout'];
            updateSettings({
              layout,
              ...(item.imageUrl && (layout === 'hero_center' || layout === 'minimal')
                ? { backgroundType: 'image' as const }
                : {}),
            });
          }}
          options={Object.entries(PROMO_BANNER_LAYOUT_LABELS).map(([value, label]) => ({ value, label }))}
          hint="El tipo define la proporción exacta que usará el recorte de imagen."
        />
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Imagen principal</p>
        <ImageUploadField
          id={`banner-image-${item.clientId}`}
          label="Imagen del banner"
          assetKind={imageAssetKind}
          previewUrl={item.imageUrl}
          onFileSelect={(file) => {
            if (!file) return;
            update({
              imageUrl: URL.createObjectURL(file),
              pendingImageFile: file,
              settings: {
                ...settings,
                ...((settings.layout === 'hero_center' || settings.layout === 'minimal')
                  ? { backgroundType: 'image' as const }
                  : {}),
              },
            });
          }}
          onClear={() => update({ imageUrl: null, pendingImageFile: null })}
          aspectClassName={promoBannerUploadPreviewClass(imageAssetKind)}
          hint={`${promoBannerImageHint(imageAssetKind)} Se sube al guardar la sección.`}
        />
      </div>

      {/* Visual styling after composition and image. */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Estilo del banner</p>

        {showBannerBackgroundControl && (
          <>
            <Select
              label="Fondo del banner"
              value={settings.backgroundType}
              onChange={(e) => updateSettings({ backgroundType: e.target.value as PromoBannerSettings['backgroundType'] })}
              options={Object.entries(PROMO_BANNER_BACKGROUND_LABELS).map(([value, label]) => ({ value, label }))}
              hint="El color del tema es solo el punto de partida — puedes cambiarlo por un color propio, un degradado o tu imagen."
            />

            {settings.backgroundType === 'solid' && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor={`banner-bg-color-${item.clientId}`}>
                  Color
                </label>
                <input
                  id={`banner-bg-color-${item.clientId}`}
                  type="color"
                  value={settings.backgroundColor ?? '#ef4444'}
                  onChange={(e) => updateSettings({ backgroundColor: e.target.value })}
                  className="h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
                />
              </div>
            )}

            {settings.backgroundType === 'gradient' && (
              <Select
                label="Degradado"
                value={settings.gradientPreset}
                onChange={(e) => updateSettings({ gradientPreset: e.target.value as PromoBannerSettings['gradientPreset'] })}
                options={Object.entries(PROMO_BANNER_GRADIENT_LABELS).map(([value, label]) => ({ value, label }))}
                hint="Los colores del degradado se toman del tema de tu tienda."
              />
            )}

            {settings.backgroundType === 'image' && (
              <p className="text-xs text-gray-500">Se usa la imagen principal de este banner como fondo.</p>
            )}
          </>
        )}

        {showContentBackgroundControl && (
          <>
            <Select
              label="Fondo del bloque de texto"
              value={settings.contentBackgroundMode}
              onChange={(e) =>
                updateSettings({ contentBackgroundMode: e.target.value as PromoBannerSettings['contentBackgroundMode'] })
              }
              options={Object.entries(PROMO_CONTENT_BACKGROUND_MODE_LABELS).map(([value, label]) => ({
                value,
                label: `${label} — ${PROMO_CONTENT_BACKGROUND_MODE_HINTS[value as keyof typeof PROMO_CONTENT_BACKGROUND_MODE_HINTS]}`,
              }))}
            />

            {settings.contentBackgroundMode === 'solid' && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor={`banner-content-bg-color-${item.clientId}`}>
                  Color
                </label>
                <input
                  id={`banner-content-bg-color-${item.clientId}`}
                  type="color"
                  value={settings.customContentBackgroundColor ?? '#ef4444'}
                  onChange={(e) => updateSettings({ customContentBackgroundColor: e.target.value })}
                  className="h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
                />
              </div>
            )}

            {(settings.contentBackgroundMode === 'theme' ||
              settings.contentBackgroundMode === 'solid' ||
              settings.contentBackgroundMode === 'white' ||
              settings.contentBackgroundMode === 'dark') && (
              <Select
                label="Intensidad del fondo"
                value={settings.contentBackgroundOpacity}
                onChange={(e) =>
                  updateSettings({ contentBackgroundOpacity: e.target.value as PromoBannerSettings['contentBackgroundOpacity'] })
                }
                options={Object.entries(PROMO_CONTENT_BACKGROUND_OPACITY_LABELS).map(([value, label]) => ({ value, label }))}
              />
            )}
          </>
        )}

        <Select
          label="Color del texto"
          value={settings.textColorMode}
          onChange={(e) => updateSettings({ textColorMode: e.target.value as PromoBannerSettings['textColorMode'] })}
          options={Object.entries(PROMO_TEXT_COLOR_MODE_LABELS).map(([value, label]) => ({ value, label }))}
          hint={PROMO_TEXT_COLOR_MODE_HINTS[settings.textColorMode]}
        />

        {settings.textColorMode === 'custom' && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700" htmlFor={`banner-text-color-${item.clientId}`}>
              Color del texto
            </label>
            <input
              id={`banner-text-color-${item.clientId}`}
              type="color"
              value={settings.customTextColor ?? '#ffffff'}
              onChange={(e) => updateSettings({ customTextColor: e.target.value })}
              className="h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Select
              label="Color del botón"
              value={settings.buttonColorMode}
              onChange={(e) => updateSettings({ buttonColorMode: e.target.value as PromoBannerSettings['buttonColorMode'] })}
              options={Object.entries(PROMO_BUTTON_COLOR_MODE_LABELS).map(([value, label]) => ({ value, label }))}
              hint={PROMO_BUTTON_COLOR_MODE_HINTS[settings.buttonColorMode]}
            />
            {settings.buttonColorMode === 'custom' && (
              <input
                type="color"
                value={settings.customButtonColor ?? '#ef4444'}
                onChange={(e) => updateSettings({ customButtonColor: e.target.value })}
                className="mt-2 h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
              />
            )}
          </div>

          <Select
            label="Estilo del botón"
            value={settings.buttonVariant}
            onChange={(e) => updateSettings({ buttonVariant: e.target.value as PromoBannerSettings['buttonVariant'] })}
            options={Object.entries(PROMO_BUTTON_VARIANT_LABELS).map(([value, label]) => ({
              value,
              label: `${label} — ${PROMO_BUTTON_VARIANT_HINTS[value as keyof typeof PROMO_BUTTON_VARIANT_HINTS]}`,
            }))}
          />
        </div>

        {settings.layout === 'split' && (
          <Select
            label="Posición de la imagen"
            value={settings.imagePosition}
            onChange={(e) => updateSettings({ imagePosition: e.target.value as PromoBannerSettings['imagePosition'] })}
            options={[
              { value: 'left', label: 'Izquierda' },
              { value: 'right', label: 'Derecha' },
            ]}
          />
        )}

        {settings.layout === 'image_focus' && (
          <ContentPositionPicker
            value={settings.contentPosition}
            onChange={(contentPosition) => updateSettings({ contentPosition })}
          />
        )}

        {showContentAlignControl && (
          <Select
            label="Alineación del contenido"
            value={settings.contentAlign}
            onChange={(e) => updateSettings({ contentAlign: e.target.value as PromoBannerSettings['contentAlign'] })}
            options={[
              { value: 'left', label: 'Izquierda' },
              { value: 'center', label: 'Centro' },
              { value: 'right', label: 'Derecha' },
            ]}
          />
        )}

        {showOverlayControl && (
          <Select
            label="Overlay sobre la imagen"
            value={settings.overlay}
            onChange={(e) => updateSettings({ overlay: e.target.value as PromoBannerSettings['overlay'] })}
            options={Object.entries(PROMO_BANNER_OVERLAY_LABELS).map(([value, label]) => ({ value, label }))}
            hint="Oscurece la imagen para que el texto se lea bien encima."
          />
        )}
      </div>

      {/* Contenido al final */}
      <div className="space-y-3 rounded-xl border border-gray-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contenido</p>

        <Input
          id={`banner-eyebrow-${item.clientId}`}
          label="Texto pequeño (opcional)"
          placeholder="Ej: Ahorra hasta 45% OFF"
          value={item.body ?? ''}
          onChange={(e) => update({ body: e.target.value || null })}
          hint={
            item.body
              ? lengthHint(item.body, promoRecommendedEyebrowLength(), 'puede no caber en una sola línea.')
              : 'Aparece como una etiqueta destacada arriba del título.'
          }
        />
        <Input
          id={`banner-title-${item.clientId}`}
          label="Título"
          value={item.title ?? ''}
          onChange={(e) => update({ title: e.target.value || null })}
          hint={lengthHint(
            item.title ?? '',
            promoRecommendedTitleLength(bannerCount),
            bannerCount === 2
              ? `puede verse muy largo con 2 banners — recomendado máx. ${promoRecommendedTitleLength(bannerCount)}.`
              : 'puede verse largo — se recorta a 2 líneas en el banner.'
          )}
        />
        <Input
          id={`banner-subtitle-${item.clientId}`}
          label="Subtítulo"
          value={item.subtitle ?? ''}
          onChange={(e) => update({ subtitle: e.target.value || null })}
          hint={lengthHint(
            item.subtitle ?? '',
            promoRecommendedSubtitleLength(bannerCount),
            'usa un texto más corto para evitar saturar el banner — se recorta a 2 líneas.'
          )}
        />
        <Input
          id={`banner-link-label-${item.clientId}`}
          label="Texto del botón (opcional)"
          value={item.linkLabel ?? ''}
          onChange={(e) => update({ linkLabel: e.target.value || null })}
          hint={lengthHint(item.linkLabel ?? '', promoRecommendedButtonLabelLength(), 'puede no caber bien en el botón, sobre todo en mobile.')}
        />
        <Input
          id={`banner-link-${item.clientId}`}
          label="Enlace del botón (opcional)"
          value={item.linkUrl ?? ''}
          placeholder="/catalog?cat=ofertas"
          onChange={(e) => update({ linkUrl: e.target.value || null })}
        />
      </div>
    </>
  );
}
