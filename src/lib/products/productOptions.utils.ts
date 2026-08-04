import type { PublicProductOptionGroup, SelectedProductOptionItem } from '@/types/common.types';
import { formatCurrency } from '@/utils/formatCurrency';

export type ProductOptionSelections = Record<string, string[]>;

export function applyLocationAvailabilityToProductOptions(
  groups: PublicProductOptionGroup[],
  unavailableProductIds: ReadonlySet<string>,
): PublicProductOptionGroup[] {
  if (unavailableProductIds.size === 0) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => item.linkedProductId && unavailableProductIds.has(item.linkedProductId)
      ? { ...item, isAvailable: false, unavailableReason: 'No disponible en esta sede' }
      : item),
  }));
}

export function buildProductOptionSelectionsFromCart(
  groups: PublicProductOptionGroup[],
  customizations: SelectedProductOptionItem[],
): ProductOptionSelections {
  const selectedIds = new Set(customizations.map((item) => item.optionItemId));
  return groups.reduce<ProductOptionSelections>((selections, group) => {
    selections[group.id] = group.items
      .filter((item) => selectedIds.has(item.id))
      .map((item) => item.id);
    return selections;
  }, {});
}

export function buildInitialProductOptionSelections(groups: PublicProductOptionGroup[]): ProductOptionSelections {
  return groups.reduce<ProductOptionSelections>((acc, group) => {
    const defaults = group.items.filter((item) => item.isDefault && item.isAvailable).map((item) => item.id);
    if (defaults.length > 0) {
      acc[group.id] = group.selectionType === 'single' ? defaults.slice(0, 1) : defaults;
    } else {
      acc[group.id] = [];
    }
    return acc;
  }, {});
}

export function toggleProductOptionSelection(
  group: PublicProductOptionGroup,
  selections: ProductOptionSelections,
  itemId: string
): ProductOptionSelections {
  const current = selections[group.id] ?? [];
  const item = group.items.find((candidate) => candidate.id === itemId);
  if (!item) return selections;

  if (group.selectionType === 'single') {
    if (current[0] === itemId) return { ...selections, [group.id]: [] };
    if (!item.isAvailable) return selections;
    return { ...selections, [group.id]: [itemId] };
  }

  const exists = current.includes(itemId);
  if (exists) {
    return { ...selections, [group.id]: current.filter((value) => value !== itemId) };
  }

  if (!item.isAvailable) return selections;

  if (group.maxSelect !== null && current.length >= group.maxSelect) {
    return selections;
  }

  return { ...selections, [group.id]: [...current, itemId] };
}

export function calculateCustomizationTotal(
  groups: PublicProductOptionGroup[],
  selections: ProductOptionSelections
): number {
  return groups.reduce((sum, group) => {
    const selectedIds = selections[group.id] ?? [];
    const selectedTotal = group.items
      .filter((item) => selectedIds.includes(item.id))
      .reduce((groupSum, item) => groupSum + item.priceDelta, 0);
    return sum + selectedTotal;
  }, 0);
}

export function validateProductOptionSelections(
  groups: PublicProductOptionGroup[],
  selections: ProductOptionSelections
): string[] {
  const errors: string[] = [];

  groups.forEach((group) => {
    const availableIds = new Set(group.items.filter((item) => item.isAvailable).map((item) => item.id));
    const selectedIds = selections[group.id] ?? [];
    const count = selectedIds.filter((id) => availableIds.has(id)).length;
    const minimum = group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect;

    if (selectedIds.some((id) => !availableIds.has(id))) {
      errors.push(`Una opción de "${group.name}" se agotó. Elige otra para continuar.`);
      return;
    }

    if (minimum > group.items.filter((item) => item.isAvailable).length) {
      errors.push(`"${group.name}" no tiene suficientes opciones disponibles en este momento.`);
      return;
    }

    if (minimum > 0 && count < minimum) {
      errors.push(`Debes completar "${group.name}".`);
      return;
    }

    if (group.maxSelect !== null && count > group.maxSelect) {
      errors.push(`"${group.name}" permite máximo ${group.maxSelect} selección(es).`);
    }
  });

  return errors;
}

// Structured form of the current selections — this is what gets attached
// to a cart line and sent to the server (ids only matter there; labels/
// deltas here are for this session's own UI, the server re-resolves and
// re-prices everything from product_option_groups/items regardless).
export function buildSelectedProductOptions(
  groups: PublicProductOptionGroup[],
  selections: ProductOptionSelections
): SelectedProductOptionItem[] {
  const result: SelectedProductOptionItem[] = [];

  groups.forEach((group) => {
    const selectedIds = selections[group.id] ?? [];
    group.items
      .filter((item) => item.isAvailable && selectedIds.includes(item.id))
      .forEach((item) => {
        result.push({
          optionGroupId: group.id,
          optionGroupName: group.name,
          optionItemId: item.id,
          optionItemLabel: item.label,
          priceDelta: item.priceDelta,
        });
      });
  });

  return result;
}

// One line per selected modifier, price included — for WhatsApp messages
// and anywhere else that needs to show extras with their cost rather than
// a single flattened "Grupo: A, B" summary.
export function buildCustomizationPricedLines(customizations: SelectedProductOptionItem[]): string[] {
  return customizations.map(
    (c) => `- ${c.optionItemLabel} (+${formatCurrency(c.priceDelta, 'es-CO', 'COP')})`
  );
}

export function buildCustomizationSummaryLines(
  groups: PublicProductOptionGroup[],
  selections: ProductOptionSelections,
  customerNote: string
): string[] {
  const lines: string[] = [];

  groups.forEach((group) => {
    const selectedIds = selections[group.id] ?? [];
    if (selectedIds.length === 0) return;

    const labels = group.items
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => item.label);

    if (labels.length > 0) {
      lines.push(`${group.name}: ${labels.join(', ')}`);
    }
  });

  if (customerNote.trim()) {
    lines.push(`Indicaciones: ${customerNote.trim()}`);
  }

  return lines;
}
