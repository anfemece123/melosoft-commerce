import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Star } from 'lucide-react';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { DraftItemListEditor } from './DraftItemListEditor';
import { InfoStep } from './InfoStep';
import type { WizardStepProps } from '../sectionWizardSteps.types';

export function TestimonialsInfoStep(props: WizardStepProps) {
  return <InfoStep {...props} headingPlaceholder="Lo que dicen nuestros clientes" />;
}

function StarRatingInput({ value, onChange }: { value: number | null; onChange: (rating: number | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)} className="text-amber-400" title={`${n} estrellas`}>
          <Star className={`h-5 w-5 ${value !== null && n <= value ? 'fill-amber-400' : 'fill-none'}`} />
        </button>
      ))}
    </div>
  );
}

export function TestimonialsItemsStep({ draft, updateDraft, storeId }: WizardStepProps) {
  return (
    <DraftItemListEditor
      draft={draft}
      updateDraft={updateDraft}
      storeId={storeId}
      emptyLabel="Aún no has agregado testimonios. Agrega al menos uno."
      addLabel="Agregar testimonio"
      newItemDefaults={() => ({ title: 'Nombre del cliente' })}
      renderFields={(item, update) => (
        <>
          <Input
            id={`testimonial-title-${item.clientId}`}
            label="Nombre del cliente"
            value={item.title ?? ''}
            onChange={(e) => update({ title: e.target.value || null })}
          />
          <Input
            id={`testimonial-subtitle-${item.clientId}`}
            label="Cargo / ciudad (opcional)"
            value={item.subtitle ?? ''}
            onChange={(e) => update({ subtitle: e.target.value || null })}
          />
          <Textarea
            id={`testimonial-body-${item.clientId}`}
            label="Testimonio"
            rows={3}
            value={item.body ?? ''}
            onChange={(e) => update({ body: e.target.value || null })}
          />
          <div>
            <p className="mb-1 block text-sm font-medium text-gray-700">Calificación (opcional)</p>
            <StarRatingInput value={item.rating} onChange={(rating) => update({ rating })} />
          </div>
          <ImageUploadField
            id={`testimonial-image-${item.clientId}`}
            label="Avatar (opcional)"
            assetKind="home_section_image"
            previewUrl={item.imageUrl}
            onFileSelect={(file) => {
              if (!file) return;
              update({ imageUrl: URL.createObjectURL(file), pendingImageFile: file });
            }}
            onClear={() => update({ imageUrl: null, pendingImageFile: null })}
            aspectClassName="h-16 w-16 rounded-full"
            hint="La imagen se sube al guardar la sección."
          />
        </>
      )}
    />
  );
}

export function TestimonialsDesignStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'testimonials' ? draft.content : null;
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
