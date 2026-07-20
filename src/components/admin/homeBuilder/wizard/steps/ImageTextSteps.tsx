import { useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { SwitchField } from '@/components/ui/SwitchField';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import {
  IMAGE_TEXT_LAYOUT_LABELS,
  IMAGE_TEXT_LAYOUT_HINTS,
  IMAGE_TEXT_IMAGE_POSITION_LABELS,
  IMAGE_TEXT_ASPECT_LABELS,
  IMAGE_TEXT_ROUNDED_LABELS,
  IMAGE_TEXT_OVERLAY_LABELS,
  IMAGE_TEXT_CONTENT_POSITION_LABELS,
  IMAGE_TEXT_TITLE_SIZE_LABELS,
  IMAGE_TEXT_SUBTITLE_SIZE_LABELS,
  IMAGE_TEXT_BUTTON_SIZE_LABELS,
  IMAGE_TEXT_BUTTON_STYLE_LABELS,
  IMAGE_TEXT_COLOR_MODE_LABELS,
  IMAGE_TEXT_TEXT_ALIGN_LABELS,
  IMAGE_TEXT_CONTENT_WIDTH_LABELS,
  IMAGE_TEXT_SPACING_LABELS,
  IMAGE_TEXT_CONTENT_BG_LABELS,
  IMAGE_TEXT_BG_OPACITY_LABELS,
  IMAGE_TEXT_SECTION_BG_LABELS,
  IMAGE_TEXT_SECTION_SIZE_LABELS,
} from '@/features/homeSections/imageTextSection.types';
import type { WizardStepProps } from '../sectionWizardSteps.types';

const CONTENT_ERROR_KEY = 'imageTextContent';
const LINK_ERROR_KEY = 'imageTextLink';

function SubsectionHeading({ children }: { children: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</p>;
}

function ColorModeField({
  label,
  mode,
  customColor,
  onModeChange,
  onCustomColorChange,
}: {
  label: string;
  mode: string;
  customColor: string | null;
  onModeChange: (value: string) => void;
  onCustomColorChange: (value: string) => void;
}) {
  return (
    <div>
      <Select
        label={label}
        value={mode}
        onChange={(e) => onModeChange(e.target.value)}
        options={Object.entries(IMAGE_TEXT_COLOR_MODE_LABELS).map(([value, label]) => ({ value, label }))}
      />
      {mode === 'custom' && (
        <input
          type="color"
          value={customColor ?? '#111827'}
          onChange={(e) => onCustomColorChange(e.target.value)}
          className="mt-2 h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
        />
      )}
    </div>
  );
}

export function ImageTextContentStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'image_text' ? draft.content : null;

  // Runs on mount too (not just on change) — a brand-new image_text draft
  // starts with heading/subheading/imageUrl/eyebrow all empty, which is
  // already invalid, so "Siguiente" must be disabled from the first
  // render, not only after the user edits something.
  useEffect(() => {
    if (!content) return;
    const hasContent = Boolean(draft.heading?.trim() || draft.subheading?.trim() || content.imageUrl || content.eyebrow?.trim());
    const hasDanglingButton = Boolean(content.linkLabel?.trim() && !content.linkUrl?.trim());
    const nextContentError = hasContent ? null : 'Agrega al menos un título, texto o imagen.';
    const nextLinkError = hasDanglingButton ? 'Agrega el enlace al que debe llevar el botón.' : null;
    if (draft.fieldErrors[CONTENT_ERROR_KEY] === nextContentError && draft.fieldErrors[LINK_ERROR_KEY] === nextLinkError) return;
    updateDraft({
      fieldErrors: { ...draft.fieldErrors, [CONTENT_ERROR_KEY]: nextContentError, [LINK_ERROR_KEY]: nextLinkError },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.heading, draft.subheading, content?.imageUrl, content?.eyebrow, content?.linkLabel, content?.linkUrl]);

  if (!content) return null;

  return (
    <div className="space-y-4">
      <Input
        id="image-text-eyebrow"
        label="Eyebrow (opcional)"
        value={content.eyebrow ?? ''}
        onChange={(e) => updateDraft({ content: { ...content, eyebrow: e.target.value || null } })}
        placeholder="Nueva colección"
        hint="Una etiqueta corta encima del título."
      />
      <Input
        id="image-text-heading"
        label="Título"
        value={draft.heading ?? ''}
        onChange={(e) => updateDraft({ heading: e.target.value || null })}
        error={draft.fieldErrors[CONTENT_ERROR_KEY] ?? undefined}
      />
      <Textarea
        id="image-text-subheading"
        label="Texto"
        rows={3}
        value={draft.subheading ?? ''}
        onChange={(e) => updateDraft({ subheading: e.target.value || null })}
      />
      <ImageUploadField
        id="image-text-image"
        label="Imagen"
        assetKind="home_section_image"
        previewUrl={content.imageUrl}
        onFileSelect={(file) => {
          if (!file) return;
          updateDraft({ content: { ...content, imageUrl: URL.createObjectURL(file) }, pendingContentImageFile: file });
        }}
        onClear={() => updateDraft({ content: { ...content, imageUrl: null }, pendingContentImageFile: null })}
        aspectClassName="h-32 w-48 rounded-xl"
        hint="La imagen se sube al guardar la sección."
      />
      <Input
        id="image-text-link"
        label="Enlace del botón (opcional)"
        value={content.linkUrl ?? ''}
        placeholder="/catalog"
        onChange={(e) => updateDraft({ content: { ...content, linkUrl: e.target.value || null } })}
        error={draft.fieldErrors[LINK_ERROR_KEY] ?? undefined}
      />
      <Input
        id="image-text-link-label"
        label="Texto del botón (opcional)"
        value={content.linkLabel ?? ''}
        onChange={(e) => updateDraft({ content: { ...content, linkLabel: e.target.value || null } })}
      />
    </div>
  );
}

export function ImageTextDesignStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'image_text' ? draft.content : null;
  if (!content) return null;

  const showOverlay = content.layout === 'background';
  const showContentPosition = content.layout === 'background' || content.layout === 'card_overlay';
  const showContentBg = content.layout === 'background' || content.layout === 'card_overlay';

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <SubsectionHeading>Diseño</SubsectionHeading>
        <Select
          label="Layout"
          value={content.layout}
          onChange={(e) => updateDraft({ content: { ...content, layout: e.target.value as typeof content.layout } })}
          options={Object.entries(IMAGE_TEXT_LAYOUT_LABELS).map(([value, label]) => ({
            value,
            label: `${label} — ${IMAGE_TEXT_LAYOUT_HINTS[value as keyof typeof IMAGE_TEXT_LAYOUT_HINTS]}`,
          }))}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Posición de la imagen"
            value={content.imagePosition}
            onChange={(e) => updateDraft({ content: { ...content, imagePosition: e.target.value as typeof content.imagePosition } })}
            options={Object.entries(IMAGE_TEXT_IMAGE_POSITION_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Relación de aspecto"
            value={content.aspect}
            onChange={(e) => updateDraft({ content: { ...content, aspect: e.target.value as typeof content.aspect } })}
            options={Object.entries(IMAGE_TEXT_ASPECT_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <Select
          label="Bordes de la imagen"
          value={content.rounded}
          onChange={(e) => updateDraft({ content: { ...content, rounded: e.target.value as typeof content.rounded } })}
          options={Object.entries(IMAGE_TEXT_ROUNDED_LABELS).map(([value, label]) => ({ value, label }))}
        />
        {showOverlay && (
          <Select
            label="Overlay sobre la imagen"
            value={content.overlay}
            onChange={(e) => updateDraft({ content: { ...content, overlay: e.target.value as typeof content.overlay } })}
            options={Object.entries(IMAGE_TEXT_OVERLAY_LABELS).map(([value, label]) => ({ value, label }))}
            hint="Oscurece la imagen para que el texto se lea bien encima."
          />
        )}
        {showContentPosition && (
          <Select
            label="Ubicación del contenido"
            value={content.contentPosition}
            onChange={(e) => updateDraft({ content: { ...content, contentPosition: e.target.value as typeof content.contentPosition } })}
            options={Object.entries(IMAGE_TEXT_CONTENT_POSITION_LABELS).map(([value, label]) => ({ value, label }))}
          />
        )}
      </div>

      <div className="space-y-4 border-t border-gray-100 pt-4">
        <SubsectionHeading>Texto</SubsectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Tamaño del título"
            value={content.titleSize}
            onChange={(e) => updateDraft({ content: { ...content, titleSize: e.target.value as typeof content.titleSize } })}
            options={Object.entries(IMAGE_TEXT_TITLE_SIZE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Tamaño del subtítulo"
            value={content.subtitleSize}
            onChange={(e) => updateDraft({ content: { ...content, subtitleSize: e.target.value as typeof content.subtitleSize } })}
            options={Object.entries(IMAGE_TEXT_SUBTITLE_SIZE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Tamaño del botón"
            value={content.buttonSize}
            onChange={(e) => updateDraft({ content: { ...content, buttonSize: e.target.value as typeof content.buttonSize } })}
            options={Object.entries(IMAGE_TEXT_BUTTON_SIZE_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ColorModeField
            label="Color del título"
            mode={content.titleColorMode}
            customColor={content.customTitleColor}
            onModeChange={(value) => updateDraft({ content: { ...content, titleColorMode: value as typeof content.titleColorMode } })}
            onCustomColorChange={(value) => updateDraft({ content: { ...content, customTitleColor: value } })}
          />
          <ColorModeField
            label="Color del subtítulo"
            mode={content.subtitleColorMode}
            customColor={content.customSubtitleColor}
            onModeChange={(value) => updateDraft({ content: { ...content, subtitleColorMode: value as typeof content.subtitleColorMode } })}
            onCustomColorChange={(value) => updateDraft({ content: { ...content, customSubtitleColor: value } })}
          />
          <ColorModeField
            label="Color del botón"
            mode={content.buttonColorMode}
            customColor={content.customButtonColor}
            onModeChange={(value) => updateDraft({ content: { ...content, buttonColorMode: value as typeof content.buttonColorMode } })}
            onCustomColorChange={(value) => updateDraft({ content: { ...content, customButtonColor: value } })}
          />
        </div>

        <Select
          label="Estilo del botón"
          value={content.buttonStyle}
          onChange={(e) => updateDraft({ content: { ...content, buttonStyle: e.target.value as typeof content.buttonStyle } })}
          options={Object.entries(IMAGE_TEXT_BUTTON_STYLE_LABELS).map(([value, label]) => ({ value, label }))}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Alineación del texto"
            value={content.textAlign}
            onChange={(e) => updateDraft({ content: { ...content, textAlign: e.target.value as typeof content.textAlign } })}
            options={Object.entries(IMAGE_TEXT_TEXT_ALIGN_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Ancho del contenido"
            value={content.contentWidth}
            onChange={(e) => updateDraft({ content: { ...content, contentWidth: e.target.value as typeof content.contentWidth } })}
            options={Object.entries(IMAGE_TEXT_CONTENT_WIDTH_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Espaciado"
            value={content.spacing}
            onChange={(e) => updateDraft({ content: { ...content, spacing: e.target.value as typeof content.spacing } })}
            options={Object.entries(IMAGE_TEXT_SPACING_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </div>

      {showContentBg && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <SubsectionHeading>Fondo del contenido</SubsectionHeading>
          <Select
            label="Fondo"
            value={content.contentBg}
            onChange={(e) => updateDraft({ content: { ...content, contentBg: e.target.value as typeof content.contentBg } })}
            options={Object.entries(IMAGE_TEXT_CONTENT_BG_LABELS).map(([value, label]) => ({ value, label }))}
          />
          {content.contentBg === 'custom' && (
            <input
              type="color"
              value={content.customContentBgColor ?? '#111827'}
              onChange={(e) => updateDraft({ content: { ...content, customContentBgColor: e.target.value } })}
              className="h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
            />
          )}
          {content.contentBg !== 'none' && (
            <>
              <Select
                label="Opacidad del fondo"
                value={content.contentBgOpacity}
                onChange={(e) => updateDraft({ content: { ...content, contentBgOpacity: e.target.value as typeof content.contentBgOpacity } })}
                options={Object.entries(IMAGE_TEXT_BG_OPACITY_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <SwitchField
                id="image-text-content-bg-blur"
                label="Difuminado suave (blur)"
                checked={content.contentBgBlur}
                onChange={(checked) => updateDraft({ content: { ...content, contentBgBlur: checked } })}
              />
            </>
          )}
        </div>
      )}

      <div className="space-y-4 border-t border-gray-100 pt-4">
        <SubsectionHeading>Fondo y tamaño de la sección</SubsectionHeading>
        <Select
          label="Fondo de la sección"
          value={content.sectionBg}
          onChange={(e) => updateDraft({ content: { ...content, sectionBg: e.target.value as typeof content.sectionBg } })}
          options={Object.entries(IMAGE_TEXT_SECTION_BG_LABELS).map(([value, label]) => ({ value, label }))}
        />
        {content.sectionBg === 'custom' && (
          <input
            type="color"
            value={content.customSectionBgColor ?? '#111827'}
            onChange={(e) => updateDraft({ content: { ...content, customSectionBgColor: e.target.value } })}
            className="h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
          />
        )}
        <Select
          label="Tamaño de la sección"
          value={content.sectionSize}
          onChange={(e) => updateDraft({ content: { ...content, sectionSize: e.target.value as typeof content.sectionSize } })}
          options={Object.entries(IMAGE_TEXT_SECTION_SIZE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>
    </div>
  );
}
