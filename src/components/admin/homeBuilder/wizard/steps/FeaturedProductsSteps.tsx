import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SwitchField } from '@/components/ui/SwitchField';
import { IntegerInput } from '@/components/forms/IntegerInput';
import { validateIntegerField, type NumericFieldValue } from '@/lib/forms/numericInput.utils';
import { productsService } from '@/features/products/productsService';
import type { Product } from '@/features/products/products.types';
import { HomeSectionProductPicker } from '../../HomeSectionProductPicker';
import { createEmptyDraftItem } from '../homeSectionDraft';
import { notify } from '@/lib/notifications';
import { InfoStep } from './InfoStep';
import type { WizardStepProps } from '../sectionWizardSteps.types';

const MAX_ITEMS_MIN = 1;
const MAX_ITEMS_MAX = 24;
const MAX_ITEMS_ERROR_KEY = 'featuredProductsMaxItems';

export function FeaturedProductsInfoStep(props: WizardStepProps) {
  return <InfoStep {...props} headingPlaceholder="Productos destacados" />;
}

export function FeaturedProductsSelectionStep({ draft, updateDraft, storeId }: WizardStepProps) {
  const content = draft.content.sectionType === 'featured_products' ? draft.content : null;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxItemsInput, setMaxItemsInput] = useState<NumericFieldValue>(content?.maxItems ?? '');

  useEffect(() => {
    let cancelled = false;
    productsService
      .getProductsByStore(storeId)
      .then((data) => {
        if (!cancelled) setProducts(data);
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

  const selectedIds = draft.items.filter((i) => i.linkedEntityType === 'product').map((i) => i.linkedEntityId as string);

  function handleSelectionChange(productIds: string[]) {
    updateDraft({
      items: productIds.map((productId) => ({ ...createEmptyDraftItem(), linkedEntityType: 'product', linkedEntityId: productId })),
    });
  }

  const maxItemsError = validateIntegerField(maxItemsInput, {
    min: MAX_ITEMS_MIN,
    max: MAX_ITEMS_MAX,
    label: 'El máximo de productos',
  });

  function handleMaxItemsChange(value: NumericFieldValue) {
    setMaxItemsInput(value);
    updateDraft({
      content: typeof value === 'number' ? { ...content!, maxItems: value } : content!,
      fieldErrors: {
        ...draft.fieldErrors,
        [MAX_ITEMS_ERROR_KEY]: validateIntegerField(value, { min: MAX_ITEMS_MIN, max: MAX_ITEMS_MAX, label: 'El máximo de productos' }),
      },
    });
  }

  return (
    <div className="space-y-4">
      <Select
        label="¿Cómo eliges los productos?"
        value={content.selectionMode}
        onChange={(e) =>
          updateDraft({ content: { ...content, selectionMode: e.target.value as 'manual' | 'auto' } })
        }
        options={[
          { value: 'auto', label: 'Automático (productos destacados)' },
          { value: 'manual', label: 'Selección manual' },
        ]}
      />
      <IntegerInput
        id="featured-products-max"
        min={MAX_ITEMS_MIN}
        max={MAX_ITEMS_MAX}
        label="Máximo de productos a mostrar"
        hint={`Entre ${MAX_ITEMS_MIN} y ${MAX_ITEMS_MAX} productos.`}
        error={maxItemsError ?? undefined}
        value={maxItemsInput}
        onChange={handleMaxItemsChange}
      />

      {content.selectionMode === 'manual' ? (
        loading ? (
          <p className="text-sm text-gray-400">Cargando productos…</p>
        ) : (
          <HomeSectionProductPicker products={products} selectedProductIds={selectedIds} onChange={handleSelectionChange} />
        )
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Se mostrarán automáticamente los productos marcados como destacados en tu catálogo.
        </p>
      )}
    </div>
  );
}

export function FeaturedProductsDesignStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'featured_products' ? draft.content : null;
  if (!content) return null;

  return (
    <div className="space-y-4">
      <Select
        label="Productos por fila (escritorio)"
        value={String(content.columnsDesktop)}
        onChange={(e) => updateDraft({ content: { ...content, columnsDesktop: Number(e.target.value) } })}
        options={[
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
          { value: '5', label: '5' },
        ]}
      />
      <SwitchField
        id="featured-products-view-all"
        label="Mostrar botón &quot;Ver catálogo&quot;"
        checked={content.showViewAllButton}
        onChange={(checked) => updateDraft({ content: { ...content, showViewAllButton: checked } })}
      />
      {content.showViewAllButton && (
        <Input
          id="featured-products-view-all-label"
          label="Texto del botón"
          value={content.viewAllLabel}
          onChange={(e) => updateDraft({ content: { ...content, viewAllLabel: e.target.value || 'Ver catálogo' } })}
        />
      )}
    </div>
  );
}
