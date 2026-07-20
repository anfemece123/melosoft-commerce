import { Input } from '@/components/ui/Input';
import { SwitchField } from '@/components/ui/SwitchField';
import type { WizardStepProps } from '../sectionWizardSteps.types';

interface InfoStepProps extends WizardStepProps {
  headingPlaceholder?: string;
}

export function InfoStep({ draft, updateDraft, headingPlaceholder }: InfoStepProps) {
  return (
    <div className="space-y-4">
      <Input
        id="wizard-heading"
        label="Título de la sección"
        value={draft.heading ?? ''}
        onChange={(e) => updateDraft({ heading: e.target.value || null })}
        placeholder={headingPlaceholder}
      />
      <Input
        id="wizard-subheading"
        label="Subtítulo (opcional)"
        value={draft.subheading ?? ''}
        onChange={(e) => updateDraft({ subheading: e.target.value || null })}
      />
      <SwitchField
        id="wizard-active"
        label="Sección activa"
        description="Si la desactivas, se guarda pero no se muestra en tu tienda pública."
        checked={draft.isActive}
        onChange={(checked) => updateDraft({ isActive: checked })}
      />
    </div>
  );
}
