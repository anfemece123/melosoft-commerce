import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { ImageIcon, LayoutTemplate, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { homeSectionsService } from '@/features/homeSections/homeSectionsService';
import type { StoreHomeSection } from '@/features/homeSections/homeSections.types';
import type { PublicProductPage, PublicStoreCategory } from '@/types/common.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { PreviewDevice } from '@/components/admin/homeBuilder/previewFrame/StorefrontSectionPreviewFrame';
import { notify } from '@/lib/notifications';
import { SortableSectionCard } from './SortableSectionCard';

interface HomeBuilderCanvasProps {
  storeId: string;
  sections: StoreHomeSection[];
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  showCartButton: boolean;
  productCardCtaLabel: string;
  publicProducts: PublicProductPage[];
  categories: PublicStoreCategory[];
  /** Lifted to HomeBuilderPage (not owned here) so opening the wizard from
   * "Editar" can start it in sync with whatever device mode the canvas is
   * currently showing. */
  viewMode: PreviewDevice;
  onViewModeChange: (mode: PreviewDevice) => void;
  onSectionsChange: (sections: StoreHomeSection[]) => void;
  onAddSection: () => void;
  onEditSection: (section: StoreHomeSection) => void;
}

export function HomeBuilderCanvas({
  storeId,
  sections,
  theme,
  storeSlug,
  currency,
  isMenu,
  showCartButton,
  productCardCtaLabel,
  publicProducts,
  categories,
  viewMode,
  onViewModeChange,
  onSectionsChange,
  onAddSection,
  onEditSection,
}: HomeBuilderCanvasProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleToggleActive(id: string, isActive: boolean) {
    const previous = sections;
    onSectionsChange(sections.map((s) => (s.id === id ? { ...s, isActive } : s)));
    try {
      const updated = await homeSectionsService.toggleStoreHomeSectionActive(id, isActive);
      onSectionsChange(previous.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      onSectionsChange(previous);
      notify.fromError(err);
    }
  }

  async function handleDelete(id: string) {
    const previous = sections;
    onSectionsChange(sections.filter((s) => s.id !== id));
    try {
      await homeSectionsService.deleteStoreHomeSection(id);
      notify.success('Sección eliminada');
    } catch (err) {
      onSectionsChange(previous);
      notify.fromError(err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = sections;
    const reordered = arrayMove(sections, oldIndex, newIndex);
    onSectionsChange(reordered);

    try {
      await homeSectionsService.reorderStoreHomeSections(reordered.map((s) => s.id));
    } catch (err) {
      onSectionsChange(previous);
      notify.fromError(err);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={() => onViewModeChange('desktop')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'desktop' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Monitor className="h-3.5 w-3.5" />
          Escritorio
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('mobile')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'mobile' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          Celular
        </button>
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        {/* Fixed "Portada" block — not a section, not draggable, always first. */}
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3.5 text-sm text-gray-600">
          <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="flex-1">
            <p className="font-medium text-gray-700">Portada principal</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Se configura desde{' '}
              <Link to={`/admin/stores/${storeId}/settings`} className="font-medium text-indigo-600 hover:text-indigo-700">
                Configuración → Portada
              </Link>
              . Siempre aparece antes que estas secciones.
            </p>
          </div>
        </div>

        {sections.length === 0 ? (
          <EmptyState
            icon={<LayoutTemplate className="w-12 h-12" />}
            title="Personaliza el inicio de tu tienda"
            description="Agrega secciones para mostrar promociones, productos destacados, testimonios y más."
            action={<Button onClick={onAddSection}>Agregar sección</Button>}
          />
        ) : (
          <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {sections.map((section) => (
                  <SortableSectionCard
                    key={section.id}
                    section={section}
                    device={viewMode}
                    theme={theme}
                    storeSlug={storeSlug}
                    currency={currency}
                    isMenu={isMenu}
                    showCartButton={showCartButton}
                    productCardCtaLabel={productCardCtaLabel}
                    publicProducts={publicProducts}
                    categories={categories}
                    onEdit={() => onEditSection(section)}
                    onToggleActive={(isActive) => void handleToggleActive(section.id, isActive)}
                    onDelete={() => setDeletingId(section.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <ConfirmDialog
        open={deletingId !== null}
        title="Eliminar sección"
        message="¿Seguro que quieres eliminar esta sección del inicio de tu tienda? Esta acción no se puede deshacer."
        onConfirm={() => deletingId && void handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
