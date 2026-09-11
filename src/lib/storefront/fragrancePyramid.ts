import type { ProductDescriptionSection } from '@/types/common.types';
import type { FragranceNotes } from '@/components/public/storefront/FragrancePyramid';

/** businessSubcategory value set in StoreFormPage's SUBCATEGORIES under the
 * retail_products vertical — the only per-store signal narrow enough to
 * gate a perfume-only feature without a dedicated store setting. */
const FRAGRANCE_SUBCATEGORY = 'lociones_perfumes';

export function isFragranceStore(businessSubcategory: string | null | undefined): boolean {
  return businessSubcategory === FRAGRANCE_SUBCATEGORY;
}

export interface FragranceNoteField {
  key: keyof FragranceNotes;
  title: string;
  icon: string;
  placeholder: string;
}

/** The 3 fixed fields FragrancePyramidEditor renders (admin) and the
 * titles ProductLandingPage looks for (public) — one source of truth for
 * both sides so they can never drift apart. */
export const FRAGRANCE_NOTE_FIELDS: FragranceNoteField[] = [
  { key: 'top', title: 'Notas de salida', icon: 'zap', placeholder: 'Bergamota, pomelo rosado, pimienta rosa...' },
  { key: 'heart', title: 'Notas de corazón', icon: 'heart', placeholder: 'Cardamomo, flor de azahar, jengibre...' },
  { key: 'base', title: 'Notas de fondo', icon: 'clock', placeholder: 'Cedro, ámbar, almizcle blanco...' },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .trim();
}

const NOTE_TITLE_MATCHERS: { key: keyof FragranceNotes; test: (normalizedTitle: string) => boolean }[] = [
  { key: 'top', test: (t) => t.includes('salida') },
  { key: 'heart', test: (t) => t.includes('corazon') },
  { key: 'base', test: (t) => t.includes('fondo') },
];

/** Finds each note field's current section by title, regardless of
 * whether it's empty or hidden — used by FragrancePyramidEditor, which
 * needs to bind an input to a field even before the merchant fills it in. */
export function mapFragranceNoteSections(
  sections: ProductDescriptionSection[]
): Partial<Record<keyof FragranceNotes, ProductDescriptionSection>> {
  const found: Partial<Record<keyof FragranceNotes, ProductDescriptionSection>> = {};
  for (const section of sections) {
    const normalizedTitle = normalize(section.title ?? '');
    const matcher = NOTE_TITLE_MATCHERS.find((m) => !found[m.key] && m.test(normalizedTitle));
    if (matcher) found[matcher.key] = section;
  }
  return found;
}

/** Public-facing: only returns non-null once all three notes are present,
 * visible and non-empty — see FragrancePyramid / ProductLandingPage.
 * Callers fall back to the plain accordion otherwise. */
export function extractFragranceNotes(
  sections: ProductDescriptionSection[]
): { notes: FragranceNotes; matchedIds: Set<string> } | null {
  const visible = sections.filter((section) => section.isVisible !== false);
  const matched = mapFragranceNoteSections(visible);

  const top = matched.top?.content?.trim();
  const heart = matched.heart?.content?.trim();
  const base = matched.base?.content?.trim();
  if (!top || !heart || !base) return null;

  return {
    notes: { top, heart, base },
    matchedIds: new Set([matched.top!.id, matched.heart!.id, matched.base!.id]),
  };
}
