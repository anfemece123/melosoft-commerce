import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/Select';
import { IntegerInput } from '@/components/forms/IntegerInput';
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
  return <InfoStep {...props} headingPlaceholder="Categorías destacadas" />;
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

  function handleSelectionChange(categoryIds: string[]) {
    updateDraft({
      items: categoryIds.map((categoryId) => ({ ...createEmptyDraftItem(), linkedEntityType: 'category', linkedEntityId: categoryId })),
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
          <HomeSectionCategoryPicker categories={categories} selectedCategoryIds={selectedIds} onChange={handleSelectionChange} />
        )
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Se mostrarán automáticamente las categorías principales de tu catálogo.
        </p>
      )}
    </div>
  );
}
