import { Sparkles } from 'lucide-react';
import type { ProductDescriptionSection } from '@/types/common.types';
import { FRAGRANCE_NOTE_FIELDS, mapFragranceNoteSections } from '@/lib/storefront/fragrancePyramid';

interface Props {
  sections: ProductDescriptionSection[];
  onChange: (sections: ProductDescriptionSection[]) => void;
}

/** Exclusive to tiendas de perfumería (see isFragranceStore). Writes
 * into the same descriptionSections array as the generic editor below it,
 * just through 3 fixed fields instead of free-form title/content blocks —
 * so it's unmistakable that these three specifically become the visual
 * pyramid on the public product page. */
export function FragrancePyramidEditor({ sections, onChange }: Props) {
  const matched = mapFragranceNoteSections(sections);
  const filledCount = FRAGRANCE_NOTE_FIELDS.filter((field) => matched[field.key]?.content?.trim()).length;

  function updateField(field: (typeof FRAGRANCE_NOTE_FIELDS)[number], content: string) {
    const existing = matched[field.key];
    if (existing) {
      onChange(sections.map((section) => (section.id === existing.id ? { ...section, content } : section)));
      return;
    }
    onChange([
      ...sections,
      {
        id: crypto.randomUUID(),
        title: field.title,
        icon: field.icon,
        content,
        sortOrder: sections.length,
        isVisible: true,
      },
    ]);
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Pirámide olfativa</h4>
          <p className="mt-0.5 text-xs text-gray-600">
            Al completar las 3 notas, en la página pública del producto se reemplaza el texto plano por un dibujo de pirámide con estas notas —
            solo en tiendas de perfumería. {filledCount}/3 completas.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {FRAGRANCE_NOTE_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-xs font-medium text-gray-700">{field.title}</label>
            <textarea
              rows={2}
              value={matched[field.key]?.content ?? ''}
              onChange={(e) => updateField(field, e.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
