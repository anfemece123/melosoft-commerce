import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SwitchField } from '@/components/ui/SwitchField';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { BENEFIT_ICONS } from '@/lib/homeSections/benefitIcons';
import {
  parseBenefitItemSettings,
  defaultBenefitItemSettings,
  type BenefitItemSettings,
} from '@/features/homeSections/benefitItem.types';
import {
  BENEFITS_LAYOUT_LABELS,
  BENEFITS_LAYOUT_HINTS,
  BENEFITS_ITEM_SIZE_LABELS,
  BENEFITS_STYLE_LABELS,
} from '@/features/homeSections/benefitSection.types';
import { DraftItemListEditor } from './DraftItemListEditor';
import { InfoStep } from './InfoStep';
import type { HomeSectionDraftItem } from '../homeSectionDraft';
import type { WizardStepProps } from '../sectionWizardSteps.types';

export function BenefitsInfoStep(props: WizardStepProps) {
  return <InfoStep {...props} headingPlaceholder="Por qué comprar con nosotros" />;
}

function BenefitFields({ item, update }: { item: HomeSectionDraftItem; update: (patch: Partial<HomeSectionDraftItem>) => void }) {
  const settings = parseBenefitItemSettings(item.settings);

  function updateSettings(patch: Partial<BenefitItemSettings>) {
    update({ settings: { ...settings, ...patch } });
  }

  return (
    <>
      <ImageUploadField
        id={`benefit-logo-${item.clientId}`}
        label="Logo / imagen (opcional)"
        assetKind="home_section_image"
        previewUrl={item.imageUrl}
        onFileSelect={(file) => {
          if (!file) return;
          update({ imageUrl: URL.createObjectURL(file), pendingImageFile: file });
        }}
        onClear={() => update({ imageUrl: null, pendingImageFile: null })}
        aspectClassName="h-16 w-32 rounded-xl"
        hint="Úsalo para marcas/logos. Si subes una imagen, reemplaza al ícono."
      />
      {!item.imageUrl && (
        <Select
          label="Ícono"
          value={settings.iconKey ?? 'truck'}
          onChange={(e) => updateSettings({ iconKey: e.target.value as BenefitItemSettings['iconKey'] })}
          options={Object.entries(BENEFIT_ICONS).map(([key, def]) => ({ value: key, label: def.label }))}
        />
      )}
      <Input
        id={`benefit-title-${item.clientId}`}
        label="Título"
        value={item.title ?? ''}
        onChange={(e) => update({ title: e.target.value || null })}
        placeholder="Envíos nacionales"
      />
      <Input
        id={`benefit-body-${item.clientId}`}
        label="Descripción corta (opcional)"
        value={item.body ?? ''}
        onChange={(e) => update({ body: e.target.value || null })}
        placeholder="Entregamos a todo el país"
      />
      <Input
        id={`benefit-link-${item.clientId}`}
        label="Enlace (opcional)"
        value={item.linkUrl ?? ''}
        onChange={(e) => update({ linkUrl: e.target.value || null })}
        placeholder="https://... o /catalog"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Color de fondo (opcional)</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={settings.customBackgroundColor ?? '#ffffff'}
              onChange={(e) => updateSettings({ customBackgroundColor: e.target.value })}
              className="h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
            />
            {settings.customBackgroundColor && (
              <button
                type="button"
                onClick={() => updateSettings({ customBackgroundColor: null })}
                className="text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Color de texto (opcional)</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={settings.customTextColor ?? '#111827'}
              onChange={(e) => updateSettings({ customTextColor: e.target.value })}
              className="h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
            />
            {settings.customTextColor && (
              <button
                type="button"
                onClick={() => updateSettings({ customTextColor: null })}
                className="text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function BenefitsItemsStep({ draft, updateDraft, storeId }: WizardStepProps) {
  return (
    <DraftItemListEditor
      draft={draft}
      updateDraft={updateDraft}
      storeId={storeId}
      emptyLabel="Aún no has agregado ítems. Agrega al menos uno."
      addLabel="Agregar ítem"
      newItemDefaults={() => ({
        title: 'Nuevo beneficio',
        settings: { ...defaultBenefitItemSettings(), iconKey: 'truck' },
      })}
      renderFields={(item, update) => <BenefitFields item={item} update={update} />}
    />
  );
}

export function BenefitsDesignStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'benefits' ? draft.content : null;
  if (!content) return null;

  return (
    <div className="space-y-4">
      <Select
        label="Modo de visualización"
        value={content.layout}
        onChange={(e) => updateDraft({ content: { ...content, layout: e.target.value as typeof content.layout } })}
        options={Object.entries(BENEFITS_LAYOUT_LABELS).map(([value, label]) => ({
          value,
          label: `${label} — ${BENEFITS_LAYOUT_HINTS[value as keyof typeof BENEFITS_LAYOUT_HINTS]}`,
        }))}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Tamaño de ítems"
          value={content.itemSize}
          onChange={(e) => updateDraft({ content: { ...content, itemSize: e.target.value as typeof content.itemSize } })}
          options={Object.entries(BENEFITS_ITEM_SIZE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Select
          label="Estilo"
          value={content.style}
          onChange={(e) => updateDraft({ content: { ...content, style: e.target.value as typeof content.style } })}
          options={Object.entries(BENEFITS_STYLE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      {content.layout === 'carousel' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SwitchField
            id="benefits-show-arrows"
            label="Mostrar flechas en escritorio"
            checked={content.showArrows}
            onChange={(checked) => updateDraft({ content: { ...content, showArrows: checked } })}
          />
          <SwitchField
            id="benefits-show-dots"
            label="Mostrar indicadores (puntos)"
            checked={content.showDots}
            onChange={(checked) => updateDraft({ content: { ...content, showDots: checked } })}
          />
        </div>
      )}

      {(content.layout === 'band' || content.layout === 'logos') && (
        <SwitchField
          id="benefits-auto-scroll"
          label="Auto-scroll"
          description="Desplaza la fila automáticamente; se pausa cuando el visitante pasa el mouse encima."
          checked={content.autoScroll}
          onChange={(checked) => updateDraft({ content: { ...content, autoScroll: checked } })}
        />
      )}
    </div>
  );
}
