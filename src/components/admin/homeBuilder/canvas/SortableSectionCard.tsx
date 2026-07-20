import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { HOME_SECTION_TYPE_LABELS, type StoreHomeSection } from '@/features/homeSections/homeSections.types';
import type { PublicProductPage, PublicStoreCategory } from '@/types/common.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { PreviewDevice } from '@/components/admin/homeBuilder/previewFrame/StorefrontSectionPreviewFrame';
import { HomeSectionPreview } from '../previews/HomeSectionPreview';

interface SortableSectionCardProps {
  section: StoreHomeSection;
  device: PreviewDevice;
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  showCartButton: boolean;
  productCardCtaLabel: string;
  publicProducts: PublicProductPage[];
  categories: PublicStoreCategory[];
  onEdit: () => void;
  onToggleActive: (isActive: boolean) => void;
  onDelete: () => void;
}

export function SortableSectionCard({
  section,
  device,
  theme,
  storeSlug,
  currency,
  isMenu,
  showCartButton,
  productCardCtaLabel,
  publicProducts,
  categories,
  onEdit,
  onToggleActive,
  onDelete,
}: SortableSectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border bg-white transition-shadow ${
        isDragging ? 'z-10 border-indigo-300 shadow-xl' : 'border-gray-200 shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
          aria-label="Arrastrar para reordenar"
          title="Arrastrar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{HOME_SECTION_TYPE_LABELS[section.sectionType]}</p>
            {!section.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Inactiva</span>
            )}
          </div>
          {section.heading && <p className="truncate text-xs text-gray-500">{section.heading}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => onToggleActive(!section.isActive)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title={section.isActive ? 'Ocultar' : 'Mostrar'}
          >
            {section.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
            title="Eliminar sección"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={`p-4 ${section.isActive ? '' : 'opacity-50'}`}>
        <HomeSectionPreview
          section={section}
          device={device}
          theme={theme}
          storeSlug={storeSlug}
          currency={currency}
          isMenu={isMenu}
          showCartButton={showCartButton}
          productCardCtaLabel={productCardCtaLabel}
          publicProducts={publicProducts}
          categories={categories}
        />
      </div>
    </div>
  );
}
