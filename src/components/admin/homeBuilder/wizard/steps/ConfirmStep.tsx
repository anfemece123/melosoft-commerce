import { CheckCircle2 } from 'lucide-react';
import { HOME_SECTION_TYPE_LABELS } from '@/features/homeSections/homeSections.types';
import {
  PROMO_SECTION_SIZE_LABELS,
  PROMO_CONTENT_SIZE_LABELS,
  PROMO_BUTTON_SIZE_LABELS,
  PROMO_CONTENT_WIDTH_LABELS,
  PROMO_SECTION_SPACING_LABELS,
} from '@/features/homeSections/promoBanner.types';
import type { WizardStepProps } from '../sectionWizardSteps.types';
import { effectiveDraftItems } from '../homeSectionDraft';

function contentSummaryLine(draft: WizardStepProps['draft']): string | null {
  const { content } = draft;
  switch (content.sectionType) {
    case 'featured_products': {
      const base =
        content.selectionMode === 'manual'
          ? `Selección manual · ${draft.items.length} producto(s)`
          : `Automático · hasta ${content.maxItems} productos destacados`;
      return `${base} · ${content.layout === 'grid' ? 'grilla' : 'carrusel'}`;
    }
    case 'catalog_products':
      return `Hasta ${content.maxItems} productos · ${content.layout === 'grid' ? 'grilla' : 'carrusel'}`;
    case 'featured_categories':
      return content.selectionMode === 'manual'
        ? `Selección manual · ${draft.items.length} categoría(s)`
        : `Automático · hasta ${content.maxItems} categorías principales`;
    case 'promo_banners': {
      const columns = content.layout === 'grid_1' ? '1 columna' : '2 columnas';
      const size = PROMO_SECTION_SIZE_LABELS[content.sectionSize];
      const contentSize = PROMO_CONTENT_SIZE_LABELS[content.contentSize];
      const buttonSize = PROMO_BUTTON_SIZE_LABELS[content.buttonSize];
      const width = PROMO_CONTENT_WIDTH_LABELS[content.contentWidth];
      const spacing = content.layout !== 'grid_1' ? ` · Espaciado ${PROMO_SECTION_SPACING_LABELS[content.spacing]}` : '';
      return `${effectiveDraftItems(draft).length} banner(s) · ${columns} · Sección ${size} · Contenido ${contentSize} · Botón ${buttonSize} · Ancho ${width}${spacing}`;
    }
    case 'testimonials':
      return `${draft.items.length} testimonio(s) · ${content.layout === 'carousel' ? 'carrusel' : 'grilla'}`;
    case 'benefits':
      return `${draft.items.length} beneficio(s)`;
    case 'gallery':
      return `${draft.items.length} imagen(es) · ${content.layout === 'carousel' ? 'carrusel' : 'grilla'}`;
    case 'image_text':
      return `Imagen a la ${content.imagePosition === 'right' ? 'derecha' : 'izquierda'}`;
    default:
      return null;
  }
}

export function ConfirmStep({ draft }: WizardStepProps) {
  const summaryLine = contentSummaryLine(draft);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <CheckCircle2 className="h-4 w-4 text-indigo-600" />
        Revisa antes de guardar
      </div>

      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Tipo</span>
          <span className="font-medium text-gray-900">{HOME_SECTION_TYPE_LABELS[draft.sectionType]}</span>
        </div>
        {draft.heading && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Título</span>
            <span className="max-w-[70%] truncate text-right font-medium text-gray-900">{draft.heading}</span>
          </div>
        )}
        {summaryLine && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Contenido</span>
            <span className="max-w-[70%] text-right font-medium text-gray-900">{summaryLine}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Estado</span>
          <span className={`font-medium ${draft.isActive ? 'text-green-600' : 'text-gray-500'}`}>
            {draft.isActive ? 'Activa (visible en tu tienda)' : 'Inactiva (guardada, oculta)'}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Al presionar "Guardar sección" se crea en tu tienda. Si cancelas ahora, no se guarda nada.
      </p>
    </div>
  );
}
