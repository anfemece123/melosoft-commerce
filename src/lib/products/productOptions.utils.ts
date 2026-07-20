import type { PublicProductOptionGroup, SelectedProductOptionItem } from '@/types/common.types';
import { formatCurrency } from '@/utils/formatCurrency';

export type ProductOptionSelections = Record<string, string[]>;

export function buildInitialProductOptionSelections(groups: PublicProductOptionGroup[]): ProductOptionSelections {
  return groups.reduce<ProductOptionSelections>((acc, group) => {
    const defaults = group.items.filter((item) => item.isDefault).map((item) => item.id);
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

  if (group.selectionType === 'single') {
    return { ...selections, [group.id]: current[0] === itemId ? [] : [itemId] };
  }

  const exists = current.includes(itemId);
  if (exists) {
    return { ...selections, [group.id]: current.filter((value) => value !== itemId) };
  }

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
    const count = (selections[group.id] ?? []).length;
    const minimum = group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect;

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
      .filter((item) => selectedIds.includes(item.id))
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
