import type { HomeSectionType } from '@/types/common.types';
import type { WizardStepDefinition } from './sectionWizardSteps.types';
import { ConfirmStep } from './steps/ConfirmStep';
import { PromoBannersInfoStep, PromoBannersItemsStep, PromoBannersDesignStep } from './steps/PromoBannersSteps';
import { FeaturedProductsInfoStep, FeaturedProductsSelectionStep, FeaturedProductsDesignStep } from './steps/FeaturedProductsSteps';
import {
  CatalogProductsInfoStep,
  CatalogProductsConfigStep,
  CatalogProductsDesignStep,
  CatalogProductsCategoryNavStep,
} from './steps/CatalogProductsSteps';
import { FeaturedCategoriesInfoStep, FeaturedCategoriesSelectionStep } from './steps/FeaturedCategoriesSteps';
import { TestimonialsInfoStep, TestimonialsItemsStep, TestimonialsDesignStep } from './steps/TestimonialsSteps';
import { ImageTextContentStep, ImageTextDesignStep } from './steps/ImageTextSteps';
import { BenefitsInfoStep, BenefitsItemsStep, BenefitsDesignStep } from './steps/BenefitsSteps';
import { GalleryInfoStep, GalleryImagesStep, GalleryDesignStep } from './steps/GallerySteps';
import { hasNoFieldErrors, effectiveDraftItems, type HomeSectionDraft } from './homeSectionDraft';
import { isPromoBannerContentEmpty } from '@/features/homeSections/promoBanner.types';

// This file is config-only on purpose (no component definitions here) so
// it stays a plain, non-component module for Vite's fast-refresh — every
// step is a real component imported from its own steps/*.tsx file and
// always rendered via JSX by SectionWizardModal (`<currentStep.component
// .../>`), never invoked as a plain function. See the comment on
// WizardStepDefinition.component for why that distinction matters: a step
// like FeaturedProductsSelectionStep calls useState/useEffect internally,
// and calling it as `component(props)` would attach those hooks to
// SectionWizardModal's own hook order instead of the step's own fiber.

const confirmStep: WizardStepDefinition = { key: 'confirm', label: 'Confirmar', component: ConfirmStep };

function activeItems(draft: HomeSectionDraft) {
  return draft.items.filter((item) => item.isActive);
}

/** Benefits: every active item needs a title OR a logo/image — a "marcas"
 * item can be logo-only with no title, but must have at least one of the
 * two (an item with neither renders as a blank tile). */
function everyActiveBenefitHasContent(draft: HomeSectionDraft) {
  const active = activeItems(draft);
  return active.length > 0 && active.every((item) => Boolean(item.title?.trim()) || Boolean(item.imageUrl));
}

/** Testimonials: an active testimonial with no name and no quote is just
 * an empty card on the storefront. */
function everyActiveTestimonialHasTitleAndBody(draft: HomeSectionDraft) {
  const active = activeItems(draft);
  return active.length > 0 && active.every((item) => Boolean(item.title?.trim()) && Boolean(item.body?.trim()));
}

/** Gallery: an active tile with no image renders as a blank square. */
function everyActiveItemHasImage(draft: HomeSectionDraft) {
  const active = activeItems(draft);
  return active.length > 0 && active.every((item) => Boolean(item.imageUrl));
}

/** Promo banners: every active banner (among the ones the chosen count —
 * see effectiveDraftItems — actually shows) needs at least one of title/
 * subtitle/image/CTA/eyebrow — see isPromoBannerContentEmpty, the exact
 * same check the public renderer and the live preview use, so "Guardar
 * sección" can never persist a banner that would show as a blank card (or
 * simply never render) in the real store. Deliberately NOT
 * `activeItems(draft)`/`draft.items` directly — a banner beyond the
 * current count is inert, not "active" in any meaningful sense, so it
 * must never block save just because it happens to still be sitting in
 * the array with isActive: true from before the count was lowered. */
function everyActiveItemHasImageOrTitle(draft: HomeSectionDraft) {
  const active = effectiveDraftItems(draft).filter((item) => item.isActive);
  return active.length > 0 && active.every((item) => !isPromoBannerContentEmpty(item));
}

export function getWizardSteps(sectionType: HomeSectionType): WizardStepDefinition[] {
  switch (sectionType) {
    case 'promo_banners':
      return [
        { key: 'info', label: 'Información', component: PromoBannersInfoStep },
        { key: 'design', label: 'Diseño', component: PromoBannersDesignStep },
        { key: 'banners', label: 'Banners', component: PromoBannersItemsStep, isValid: everyActiveItemHasImageOrTitle },
        confirmStep,
      ];
    case 'featured_products':
      return [
        { key: 'info', label: 'Información', component: FeaturedProductsInfoStep },
        { key: 'selection', label: 'Selección', component: FeaturedProductsSelectionStep, isValid: hasNoFieldErrors },
        { key: 'design', label: 'Diseño', component: FeaturedProductsDesignStep },
        confirmStep,
      ];
    case 'catalog_products':
      return [
        { key: 'info', label: 'Información', component: CatalogProductsInfoStep },
        { key: 'config', label: 'Configuración', component: CatalogProductsConfigStep, isValid: hasNoFieldErrors },
        { key: 'design', label: 'Diseño', component: CatalogProductsDesignStep },
        { key: 'categories', label: 'Categorías', component: CatalogProductsCategoryNavStep },
        confirmStep,
      ];
    case 'featured_categories':
      return [
        { key: 'info', label: 'Información', component: FeaturedCategoriesInfoStep },
        { key: 'selection', label: 'Selección', component: FeaturedCategoriesSelectionStep, isValid: hasNoFieldErrors },
        confirmStep,
      ];
    case 'testimonials':
      return [
        { key: 'info', label: 'Información', component: TestimonialsInfoStep },
        { key: 'items', label: 'Testimonios', component: TestimonialsItemsStep, isValid: everyActiveTestimonialHasTitleAndBody },
        { key: 'design', label: 'Diseño', component: TestimonialsDesignStep },
        confirmStep,
      ];
    case 'image_text':
      return [
        { key: 'content', label: 'Contenido', component: ImageTextContentStep, isValid: hasNoFieldErrors },
        { key: 'design', label: 'Diseño', component: ImageTextDesignStep },
        confirmStep,
      ];
    case 'benefits':
      return [
        { key: 'info', label: 'Información', component: BenefitsInfoStep },
        { key: 'items', label: 'Ítems', component: BenefitsItemsStep, isValid: everyActiveBenefitHasContent },
        { key: 'design', label: 'Diseño', component: BenefitsDesignStep },
        confirmStep,
      ];
    case 'gallery':
      return [
        { key: 'info', label: 'Información', component: GalleryInfoStep },
        { key: 'images', label: 'Imágenes', component: GalleryImagesStep, isValid: everyActiveItemHasImage },
        { key: 'design', label: 'Diseño', component: GalleryDesignStep },
        confirmStep,
      ];
    case 'hero':
    case 'featured_collections':
    case 'menu_highlights':
      // Not offered in "Agregar sección" — defensive fallback only.
      return [confirmStep];
  }
}
