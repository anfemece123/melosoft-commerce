import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SwitchField } from '@/components/ui/SwitchField';
import { IntegerInput } from '@/components/forms/IntegerInput';
import { validateIntegerField, type NumericFieldValue } from '@/lib/forms/numericInput.utils';
import {
  CATALOG_PRODUCTS_MIN_ITEMS,
  CATALOG_PRODUCTS_MAX_ITEMS,
} from '@/features/homeSections/homeSections.types';
import {
  CATALOG_NAV_MODE_LABELS,
  CATALOG_NAV_STYLE_LABELS,
  CATALOG_NAV_ALIGN_LABELS,
  CATALOG_NAV_VISIBLE_OPTIONS,
  CATALOG_ALL_TAB_ID,
} from '@/features/homeSections/catalogNav.types';
import { categoriesService } from '@/features/categories/categoriesService';
import type { PublicStoreCategory } from '@/types/common.types';
import { HomeSectionCategoryPicker } from '../../HomeSectionCategoryPicker';
import { notify } from '@/lib/notifications';
import { InfoStep } from './InfoStep';
import type { WizardStepProps } from '../sectionWizardSteps.types';

export function CatalogProductsInfoStep(props: WizardStepProps) {
  return <InfoStep {...props} headingPlaceholder="Explora nuestro catálogo" />;
}

const MAX_ITEMS_ERROR_KEY = 'catalogProductsMaxItems';

export function CatalogProductsConfigStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'catalog_products' ? draft.content : null;
  // Local display value, separate from draft.content.maxItems — lets the
  // field actually stay empty while the user is typing/deleting (blurring
  // an empty/invalid field must NOT silently snap back to the last valid
  // number, since the whole point is that "Siguiente" then shows an error
  // instead of quietly keeping the old value).
  const [maxItemsInput, setMaxItemsInput] = useState<NumericFieldValue>(content?.maxItems ?? '');

  if (!content) return null;

  const maxItemsError = validateIntegerField(maxItemsInput, {
    min: CATALOG_PRODUCTS_MIN_ITEMS,
    max: CATALOG_PRODUCTS_MAX_ITEMS,
    label: 'El límite de productos',
  });

  function handleMaxItemsChange(value: NumericFieldValue) {
    setMaxItemsInput(value);
    updateDraft({
      content: typeof value === 'number' ? { ...content!, maxItems: value } : content!,
      fieldErrors: {
        ...draft.fieldErrors,
        [MAX_ITEMS_ERROR_KEY]: validateIntegerField(value, {
          min: CATALOG_PRODUCTS_MIN_ITEMS,
          max: CATALOG_PRODUCTS_MAX_ITEMS,
          label: 'El límite de productos',
        }),
      },
    });
  }

  return (
    <div className="space-y-4">
      <IntegerInput
        id="catalog-products-max"
        min={CATALOG_PRODUCTS_MIN_ITEMS}
        max={CATALOG_PRODUCTS_MAX_ITEMS}
        label="Máximo de productos a mostrar"
        hint={`Entre ${CATALOG_PRODUCTS_MIN_ITEMS} y ${CATALOG_PRODUCTS_MAX_ITEMS} productos.`}
        error={maxItemsError ?? undefined}
        value={maxItemsInput}
        onChange={handleMaxItemsChange}
      />
      <Select
        label="Orden de los productos"
        value={content.order}
        onChange={(e) => updateDraft({ content: { ...content, order: e.target.value as typeof content.order } })}
        options={[
          { value: 'recent', label: 'Más recientes primero' },
          { value: 'featured', label: 'Destacados primero' },
          { value: 'name_asc', label: 'Nombre A-Z' },
          { value: 'price_asc', label: 'Precio: menor a mayor' },
        ]}
      />
      <SwitchField
        id="catalog-products-view-all"
        label="Mostrar botón &quot;Ver catálogo completo&quot;"
        checked={content.showViewAllButton}
        onChange={(checked) => updateDraft({ content: { ...content, showViewAllButton: checked } })}
      />
      {content.showViewAllButton && (
        <Input
          id="catalog-products-view-all-label"
          label="Texto del botón"
          value={content.viewAllLabel}
          onChange={(e) => updateDraft({ content: { ...content, viewAllLabel: e.target.value || 'Ver catálogo completo' } })}
        />
      )}
    </div>
  );
}

export function CatalogProductsDesignStep({ draft, updateDraft }: WizardStepProps) {
  const content = draft.content.sectionType === 'catalog_products' ? draft.content : null;
  if (!content) return null;

  return (
    <div className="space-y-4">
      <Select
        label="Formato"
        value={content.layout}
        onChange={(e) => updateDraft({ content: { ...content, layout: e.target.value as typeof content.layout } })}
        options={[
          { value: 'carousel', label: 'Carrusel' },
          { value: 'grid', label: 'Grilla' },
        ]}
      />
      <Select
        label="Productos visibles en escritorio"
        value={String(content.columnsDesktop)}
        onChange={(e) => updateDraft({ content: { ...content, columnsDesktop: Number(e.target.value) } })}
        options={[
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
          { value: '5', label: '5' },
        ]}
      />
      {content.layout === 'carousel' && (
        <Select
          label="Productos visibles en mobile"
          value={String(content.visibleMobile)}
          onChange={(e) => updateDraft({ content: { ...content, visibleMobile: Number(e.target.value) } })}
          options={[
            { value: '1', label: '1 (con vista previa del siguiente)' },
            { value: '2', label: '2' },
          ]}
        />
      )}
    </div>
  );
}

export function CatalogProductsCategoryNavStep({ draft, updateDraft, storeId }: WizardStepProps) {
  const content = draft.content.sectionType === 'catalog_products' ? draft.content : null;
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Whatever the tabs would actually show right now, given the current
  // mode — so "Categoría inicial" can never offer a category that
  // wouldn't be one of the visible tabs.
  const candidateCategories =
    content.categoryNavMode === 'manual'
      ? categories.filter((c) => content.manualCategoryIds.includes(c.id))
      : content.categoryNavMode === 'root_only'
      ? categories.filter((c) => !c.parentId)
      : categories;

  return (
    <div className="space-y-4">
      <SwitchField
        id="catalog-products-show-category-nav"
        label="Mostrar navegación por categorías"
        description="Agrega botones de categoría arriba de esta sección para filtrarla en el inicio."
        checked={content.showCategoryNav}
        onChange={(checked) => updateDraft({ content: { ...content, showCategoryNav: checked } })}
      />

      {content.showCategoryNav && (
        <>
          <Select
            label="Categorías a mostrar"
            value={content.categoryNavMode}
            onChange={(e) => updateDraft({ content: { ...content, categoryNavMode: e.target.value as typeof content.categoryNavMode } })}
            options={Object.entries(CATALOG_NAV_MODE_LABELS).map(([value, label]) => ({ value, label }))}
          />

          {content.categoryNavMode === 'manual' &&
            (loading ? (
              <p className="text-sm text-gray-400">Cargando categorías…</p>
            ) : (
              <HomeSectionCategoryPicker
                categories={categories}
                selectedCategoryIds={content.manualCategoryIds}
                onChange={(categoryIds) => updateDraft({ content: { ...content, manualCategoryIds: categoryIds } })}
              />
            ))}

          <Select
            label="Categoría inicial"
            value={content.defaultCategoryId ?? CATALOG_ALL_TAB_ID}
            onChange={(e) =>
              updateDraft({
                content: {
                  ...content,
                  defaultCategoryId: e.target.value === CATALOG_ALL_TAB_ID ? null : e.target.value,
                },
              })
            }
            options={[
              { value: CATALOG_ALL_TAB_ID, label: 'Todo' },
              ...candidateCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Estilo de navegación"
              value={content.navStyle}
              onChange={(e) => updateDraft({ content: { ...content, navStyle: e.target.value as typeof content.navStyle } })}
              options={Object.entries(CATALOG_NAV_STYLE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="Alineación"
              value={content.navAlign}
              onChange={(e) => updateDraft({ content: { ...content, navAlign: e.target.value as typeof content.navAlign } })}
              options={Object.entries(CATALOG_NAV_ALIGN_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>

          <Select
            label="Límite de categorías visibles"
            value={String(content.maxVisibleCategories)}
            onChange={(e) => updateDraft({ content: { ...content, maxVisibleCategories: Number(e.target.value) as typeof content.maxVisibleCategories } })}
            options={CATALOG_NAV_VISIBLE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            hint="Si hay más categorías que este límite, se recortan; el resto siempre se puede desplazar horizontalmente."
          />
        </>
      )}
    </div>
  );
}
