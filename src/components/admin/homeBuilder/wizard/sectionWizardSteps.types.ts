import type { ComponentType } from 'react';
import type { HomeSectionDraft } from './homeSectionDraft';

export interface WizardStepProps {
  draft: HomeSectionDraft;
  updateDraft: (patch: Partial<HomeSectionDraft>) => void;
  storeId: string;
}

export interface WizardStepDefinition {
  key: string;
  label: string;
  /** A real component type — rendered as JSX (`<Component {...props} />`),
   * never invoked as a plain function. Several steps (FeaturedProducts/
   * FeaturedCategories selection) call useState/useEffect internally;
   * calling `component(props)` directly would attach those hooks to
   * SectionWizardModal's own hook order instead of the step's own fiber,
   * and that order changes every time the active step changes — exactly
   * the "Rendered more hooks than during the previous render" class of
   * bug. JSX is what gives each step component its own, independent
   * hook dispatcher. */
  component: ComponentType<WizardStepProps>;
  /** Optional gate — "Siguiente" stays disabled until this returns true. */
  isValid?: (draft: HomeSectionDraft) => boolean;
}
