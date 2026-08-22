import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/Select';
import { IntegerInput } from '@/components/forms/IntegerInput';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { validateIntegerField, type NumericFieldValue } from '@/lib/forms/numericInput.utils';
import { categoriesService } from '@/features/categories/categoriesService';
import type { PublicStoreCategory } from '@/types/common.types';
import { HomeSectionCategoryPicker } from '../../HomeSectionCategoryPicker';
import { createEmptyDraftItem } from '../homeSectionDraft';
import { notify } from '@/lib/notifications';
import { InfoStep } from './InfoStep';
import type { WizardStepProps } from '../sectionWizardSteps.types';

const MAX_ITEMS_MIN = 1;
const MAX_ITEMS_MAX = 12;
const MAX_ITEMS_ERROR_KEY = 'featuredCategoriesMaxItems';

export function FeaturedCategoriesInfoStep(props: WizardStepProps) {
  return <InfoStep {...props} headingPlaceholder="Explora por categoría" />;
}

export function FeaturedCategoriesSelectionStep({ draft, updateDraft, storeId }: WizardStepProps) {
  const content = draft.content.sectionType === 'featured_categories' ? draft.content : null;
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxItemsInput, setMaxItemsInput] = useState<NumericFieldValue>(content?.maxItems ?? '');

  useEffect(() => {
    let cancelled = false;
    categoriesService
      .getStoreCategories(storeId)
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((err) => notify.fromError(err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  if (!content) return null;

  const selectedIds = draft.items.filter((i) => i.linkedEntityType === 'category').map((i) => i.linkedEntityId as string);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const selectedCategories = selectedIds
    .map((categoryId) => categoriesById.get(categoryId))
    .filter((category): category is PublicStoreCategory => Boolean(category));

  function handleSelectionChange(categoryIds: string[]) {
    const previousItems = new Map(
      draft.items
        .filter((item) => item.linkedEntityType === 'category' && item.linkedEntityId)
        .map((item) => [item.linkedEntityId as string, item]),
    );
    updateDraft({
      items: categoryIds.map((categoryId) => previousItems.get(categoryId) ?? {
        ...createEmptyDraftItem(),
        linkedEntityType: 'category',
        linkedEntityId: categoryId,
      }),
    });
  }

  const maxItemsError = validateIntegerField(maxItemsInput, {
    min: MAX_ITEMS_MIN,
    max: MAX_ITEMS_MAX,
    label: 'El máximo de categorías',
  });

  function handleMaxItemsChange(value: NumericFieldValue) {
    setMaxItemsInput(value);
    updateDraft({
      content: typeof value === 'number' ? { ...content!, maxItems: value } : content!,
      fieldErrors: {
        ...draft.fieldErrors,
        [MAX_ITEMS_ERROR_KEY]: validateIntegerField(value, { min: MAX_ITEMS_MIN, max: MAX_ITEMS_MAX, label: 'El máximo de categorías' }),
      },
    });
  }

  return (
    <div className="space-y-4">
      <Select
        label="¿Cómo eliges las categorías?"
        value={content.selectionMode}
        onChange={(e) =>
          updateDraft({ content: { ...content, selectionMode: e.target.value as 'manual' | 'auto' } })
        }
        options={[
          { value: 'auto', label: 'Automático (categorías principales)' },
          { value: 'manual', label: 'Selección manual' },
        ]}
      />
      <IntegerInput
        id="featured-categories-max"
        min={MAX_ITEMS_MIN}
        max={MAX_ITEMS_MAX}
        label="Máximo de categorías a mostrar"
        hint={`Entre ${MAX_ITEMS_MIN} y ${MAX_ITEMS_MAX} categorías.`}
        error={maxItemsError ?? undefined}
        value={maxItemsInput}
        onChange={handleMaxItemsChange}
      />

      {content.selectionMode === 'manual' ? (
        loading ? (
          <p className="text-sm text-gray-400">Cargando categorías…</p>
        ) : (
          <>
            <HomeSectionCategoryPicker categories={categories} selectedCategoryIds={selectedIds} onChange={handleSelectionChange} />

            {selectedCategories.length > 0 && (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Imagen de cada tarjeta</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Si no subes una imagen, se usará la portada de la experiencia y luego la imagen de la categoría como respaldo.
                  </p>
                </div>
                {selectedCategories.map((category) => {
                  const item = draft.items.find((draftItem) => draftItem.linkedEntityId === category.id);
                  if (!item) return null;
                  return (
                    <div key={category.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <p className="mb-2 text-sm font-medium text-gray-800">{category.name}</p>
                      <ImageUploadField
                        id={`featured-category-image-${item.clientId}`}
                        label="Imagen personalizada (opcional)"
                        assetKind="home_section_image"
                        previewUrl={item.imageUrl}
                        onFileSelect={(file) => {
                          if (!file) return;
                          updateDraft({
                            items: draft.items.map((current) => current.clientId === item.clientId
                              ? { ...current, imageUrl: URL.createObjectURL(file), pendingImageFile: file }
                              : current),
                          });
                        }}
                        onClear={() => updateDraft({
                          items: draft.items.map((current) => current.clientId === item.clientId
                            ? { ...current, imageUrl: null, pendingImageFile: null }
                            : current),
                        })}
                        aspectClassName="h-20 w-36 rounded-xl"
                        hint="La imagen personalizada reemplaza la portada solo en esta sección."
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Se mostrarán automáticamente las categorías principales de tu catálogo. Cuando exista una experiencia activa, se usará su portada.
        </p>
      )}
    </div>
  );
}

export function FeaturedCategoriesDesignStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'featured_categories' ? draft.content : null;
  if (!content) return null;

  return (
    <div className="space-y-4">
      <Select
        label="Imagen de las tarjetas"
        value={content.imageSource}
        onChange={(e) => updateDraft({ content: { ...content, imageSource: e.target.value as typeof content.imageSource } })}
        options={[
          { value: 'experience_cover', label: 'Portada de la experiencia' },
          { value: 'category_image', label: 'Imagen de la categoría' },
        ]}
        hint="Las imágenes personalizadas de cada categoría tienen prioridad sobre esta opción."
      />
      <Select
        label="Distribución"
        value={content.layout}
        onChange={(e) => updateDraft({ content: { ...content, layout: e.target.value as typeof content.layout } })}
        options={[
          { value: 'adaptive', label: 'Adaptativa (grilla si son pocas, carrusel si son muchas)' },
          { value: 'grid', label: 'Siempre en grilla' },
          { value: 'carousel', label: 'Siempre en carrusel' },
        ]}
      />
    </div>
  );
}
