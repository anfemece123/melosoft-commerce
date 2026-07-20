import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { DraftItemListEditor } from './DraftItemListEditor';
import { InfoStep } from './InfoStep';
import type { WizardStepProps } from '../sectionWizardSteps.types';

export function GalleryInfoStep(props: WizardStepProps) {
  return <InfoStep {...props} headingPlaceholder="Galería" />;
}

export function GalleryImagesStep({ draft, updateDraft, storeId }: WizardStepProps) {
  return (
    <DraftItemListEditor
      draft={draft}
      updateDraft={updateDraft}
      storeId={storeId}
      emptyLabel="Aún no has agregado imágenes. Agrega al menos una."
      addLabel="Agregar imagen"
      newItemDefaults={() => ({})}
      renderFields={(item, update) => (
        <>
          <ImageUploadField
            id={`gallery-image-${item.clientId}`}
            label="Imagen"
            assetKind="home_section_image"
            previewUrl={item.imageUrl}
            onFileSelect={(file) => {
              if (!file) return;
              update({ imageUrl: URL.createObjectURL(file), pendingImageFile: file });
            }}
            onClear={() => update({ imageUrl: null, pendingImageFile: null })}
            aspectClassName="h-24 w-32 rounded-xl"
            hint="La imagen se sube al guardar la sección."
          />
          <Input
            id={`gallery-caption-${item.clientId}`}
            label="Descripción (opcional)"
            value={item.title ?? ''}
            onChange={(e) => update({ title: e.target.value || null })}
          />
          <Input
            id={`gallery-link-${item.clientId}`}
            label="Enlace (opcional)"
            value={item.linkUrl ?? ''}
            onChange={(e) => update({ linkUrl: e.target.value || null })}
          />
        </>
      )}
    />
  );
}

export function GalleryDesignStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'gallery' ? draft.content : null;
  if (!content) return null;

  return (
    <Select
      label="Diseño"
      value={content.layout}
      onChange={(e) => updateDraft({ content: { ...content, layout: e.target.value as typeof content.layout } })}
      options={[
        { value: 'grid', label: 'Grilla' },
        { value: 'carousel', label: 'Carrusel' },
      ]}
    />
  );
}
