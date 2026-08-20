import type { PublicCartaVariant } from './carta.types';

export interface CartaVariantOptionDisplay {
  id: string;
  name: string;
  values: Array<{
    id: string;
    label: string;
    isAvailable: boolean;
  }>;
}

export interface CartaVariantPriceDisplay {
  id: string;
  name: string;
  values: Array<{
    id: string;
    label: string;
    price: number;
    compareAtPrice: number | null;
    isAvailable: boolean;
  }>;
}

export interface CartaVariantRowDisplay {
  id: string;
  label: string;
  price: number;
  compareAtPrice: number | null;
  isAvailable: boolean;
}

export interface CartaVariantMatrixCell {
  id: string;
  price: number;
  compareAtPrice: number | null;
  isAvailable: boolean;
}

export interface CartaVariantMatrixDisplay {
  rowOptionName: string;
  columnOptionName: string;
  columns: Array<{ id: string; label: string }>;
  rows: Array<{
    id: string;
    label: string;
    isAvailable: boolean;
    cells: Array<CartaVariantMatrixCell | null>;
  }>;
  groups: Array<{
    id: string;
    labels: string[];
    isAvailable: boolean;
    cells: Array<CartaVariantMatrixCell | null>;
  }>;
}

export interface CartaVariantPresentation {
  optionGroups: CartaVariantOptionDisplay[];
  priceGroup: CartaVariantPriceDisplay | null;
  commonPrice: number | null;
  matrix: CartaVariantMatrixDisplay | null;
  rows: CartaVariantRowDisplay[];
}

interface OptionAccumulator {
  id: string;
  name: string;
  values: Map<string, { id: string; label: string; variants: PublicCartaVariant[] }>;
}

interface MatrixColumnMatcher {
  column: { id: string; label: string };
  valueIds: Set<string>;
  acceptsMissingValue: boolean;
}

const IMPLICIT_DEFAULT_VALUE_ID = '__implicit_default__';

function optionId(option: { optionId: string; optionName: string }): string {
  return option.optionId || `name:${option.optionName}`;
}

function optionValueId(option: { valueId: string; value: string }): string {
  return option.valueId || `value:${option.value}`;
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values));
}

function implicitDefaultLabel(optionName: string): string {
  return /prepar|present|modalidad|tipo/i.test(optionName) ? 'Normal' : 'Base';
}

function normalizeDisplayLabel(label: string): string {
  return label.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildVariantMatrix(
  options: OptionAccumulator[],
  variants: PublicCartaVariant[],
  priceGroup: CartaVariantPriceDisplay | null,
): CartaVariantMatrixDisplay | null {
  if (priceGroup || uniqueNumbers(variants.map((variant) => variant.price)).length <= 1) return null;

  if (options.length < 2) return null;

  const columnCandidates = options.filter((option) => (
    option.values.size > 1
    || variants.some((variant) => !variant.optionValues.some((value) => optionId(value) === option.id))
  ));
  // A base/default variant may not persist a value for the modifier at all.
  // In that case the modifier is still the only candidate, while the other
  // option remains the row dimension (for example Beer x Preparation).
  if (columnCandidates.length === 0) return null;

  const smallestOptionSize = Math.min(...columnCandidates.map((option) => option.values.size));
  const smallestOptions = columnCandidates.filter((option) => option.values.size === smallestOptionSize);
  // Keep the first configured dimension as the row label when both
  // dimensions have the same cardinality; the following dimension is the
  // more useful compact price column in the common two-option matrix.
  const columnOption = smallestOptions[smallestOptions.length - 1];
  const rowOptions = options.filter((option) => option !== columnOption && option.values.size > 0);
  if (rowOptions.length === 0) return null;
  const hasCompleteOptionSet = variants.every((variant) => (
    rowOptions.every((option) => variant.optionValues.some((value) => optionId(value) === option.id))
  ));
  if (!hasCompleteOptionSet) return null;

  const hasImplicitDefault = variants.some((variant) => !variant.optionValues.some((value) => optionId(value) === columnOption.id));
  const defaultLabel = implicitDefaultLabel(columnOption.name);
  const columnMatchers: MatrixColumnMatcher[] = [];
  const matchersByLabel = new Map<string, MatrixColumnMatcher>();
  if (hasImplicitDefault) {
    const defaultMatcher: MatrixColumnMatcher = {
      column: { id: IMPLICIT_DEFAULT_VALUE_ID, label: defaultLabel },
      valueIds: new Set(),
      acceptsMissingValue: true,
    };
    columnMatchers.push(defaultMatcher);
    matchersByLabel.set(normalizeDisplayLabel(defaultLabel), defaultMatcher);
  }
  for (const value of columnOption.values.values()) {
    const labelKey = normalizeDisplayLabel(value.label);
    const matcher = matchersByLabel.get(labelKey) ?? {
      column: { id: value.id, label: value.label },
      valueIds: new Set<string>(),
      acceptsMissingValue: false,
    };
    matcher.valueIds.add(value.id);
    if (!matchersByLabel.has(labelKey)) {
      columnMatchers.push(matcher);
      matchersByLabel.set(labelKey, matcher);
    }
  }
  const columns = columnMatchers.map((matcher) => matcher.column);
  const rowGroups = new Map<string, { id: string; label: string; variants: PublicCartaVariant[] }>();
  for (const variant of variants) {
    const rowValues = rowOptions.map((option) => variant.optionValues.find((value) => optionId(value) === option.id));
    if (rowValues.some((value) => !value)) return null;
    const rowKey = rowValues.map((value) => optionValueId(value!)).join('::');
    const row = rowGroups.get(rowKey) ?? {
      id: rowKey,
      label: rowValues.map((value) => value!.value).join(' · '),
      variants: [],
    };
    row.variants.push(variant);
    rowGroups.set(rowKey, row);
  }

  const rows = Array.from(rowGroups.values()).map((rowValue) => {
    const cells = columnMatchers.map((matcher) => {
      const matchingVariants = rowValue.variants.filter((variant) => (
        variant.optionValues.some((value) => optionId(value) === columnOption.id && matcher.valueIds.has(optionValueId(value)))
        || (matcher.acceptsMissingValue && !variant.optionValues.some((value) => optionId(value) === columnOption.id))
      ));
      const matchingPrices = new Set(matchingVariants.map((variant) => `${variant.price}:${variant.compareAtPrice ?? ''}`));
      if (matchingVariants.length === 0 || matchingPrices.size !== 1) return null;
      const matchingVariant = matchingVariants.find((variant) => variant.isAvailable) ?? matchingVariants[0];
      return {
        id: matchingVariant.id,
        price: matchingVariant.price,
        compareAtPrice: matchingVariant.compareAtPrice,
        isAvailable: matchingVariants.some((variant) => variant.isAvailable),
      };
    });

    return {
      id: rowValue.id,
      label: rowValue.label,
      isAvailable: cells.some((cell) => cell?.isAvailable === true),
      cells,
    };
  });

  if (!rows.some((row) => row.cells.filter(Boolean).length > 1)) return null;

  const groupsBySignature = new Map<string, {
    id: string;
    labels: string[];
    isAvailable: boolean;
    cells: Array<CartaVariantMatrixCell | null>;
  }>();
  for (const row of rows) {
    const signature = row.cells.map((cell) => cell
      ? `${cell.price}:${cell.compareAtPrice ?? ''}:${cell.isAvailable ? 'available' : 'unavailable'}`
      : 'missing').join('|');
    const group = groupsBySignature.get(signature) ?? {
      id: signature,
      labels: [],
      isAvailable: row.isAvailable,
      cells: row.cells,
    };
    group.labels.push(row.label);
    groupsBySignature.set(signature, group);
  }

  return {
    rowOptionName: rowOptions.map((option) => option.name).join(' · '),
    columnOptionName: columnOption.name,
    columns,
    rows,
    groups: Array.from(groupsBySignature.values()),
  };
}

/**
 * Turns the inventory-oriented variant matrix into a customer-oriented
 * summary. An option is treated as a price modifier only when each of its
 * values has one consistent price across the other dimensions. This makes
 * combinations such as Fruit x Water/Milk compact without hiding any of the
 * underlying variants from inventory or orders.
 */
export function buildCartaVariantPresentation(variants: PublicCartaVariant[]): CartaVariantPresentation {
  if (variants.length === 0) {
    return { optionGroups: [], priceGroup: null, commonPrice: null, matrix: null, rows: [] };
  }

  const optionAccumulators = new Map<string, OptionAccumulator>();
  for (const variant of variants) {
    for (const optionValue of variant.optionValues) {
      const id = optionId(optionValue);
      const accumulator = optionAccumulators.get(id) ?? {
        id,
        name: optionValue.optionName || 'Opción',
        values: new Map(),
      };
      const valueId = optionValueId(optionValue);
      const value = accumulator.values.get(valueId) ?? {
        id: valueId,
        label: optionValue.value || 'Presentación',
        variants: [],
      };
      value.variants.push(variant);
      accumulator.values.set(valueId, value);
      optionAccumulators.set(id, accumulator);
    }
  }

  const optionCandidates = Array.from(optionAccumulators.values()).filter((option) => option.values.size > 1);
  const priceCandidates = optionCandidates.filter((option) => {
    if (!variants.every((variant) => variant.optionValues.some((value) => optionId(value) === option.id))) return false;

    const prices = Array.from(option.values.values()).map((value) => uniqueNumbers(value.variants.map((variant) => variant.price)));
    return prices.every((valuePrices) => valuePrices.length === 1) && new Set(prices.map(([price]) => price)).size > 1;
  });

  // If no single option has a consistent price, the matrix builder below
  // groups the repeated modifier values by the remaining dimensions.
  const priceOption = priceCandidates.length === 1 ? priceCandidates[0] : null;
  const optionGroups = Array.from(optionAccumulators.values())
    .filter((option) => option !== priceOption)
    .map((option): CartaVariantOptionDisplay => ({
      id: option.id,
      name: option.name,
      values: Array.from(option.values.values()).map((value) => ({
        id: value.id,
        label: value.label,
        isAvailable: value.variants.some((variant) => variant.isAvailable),
      })),
    }));

  const priceGroup: CartaVariantPriceDisplay | null = priceOption
    ? {
        id: priceOption.id,
        name: priceOption.name,
        values: Array.from(priceOption.values.values()).map((value) => {
          const firstVariant = value.variants[0];
          const compareAtPrices = uniqueNumbers(
            value.variants
              .map((variant) => variant.compareAtPrice)
              .filter((compareAtPrice): compareAtPrice is number => compareAtPrice !== null)
          );
          return {
            id: value.id,
            label: value.label,
            price: firstVariant.price,
            compareAtPrice: compareAtPrices.length === 1 ? compareAtPrices[0] : null,
            isAvailable: value.variants.some((variant) => variant.isAvailable),
          };
        }),
      }
    : null;

  const uniquePrices = uniqueNumbers(variants.map((variant) => variant.price));
  const commonPrice = !priceGroup && uniquePrices.length === 1 ? uniquePrices[0] : null;
  const matrix = !priceGroup && commonPrice === null
    ? buildVariantMatrix(Array.from(optionAccumulators.values()), variants, priceGroup)
    : null;
  const rows = !priceGroup && commonPrice === null && !matrix
    ? variants.map((variant): CartaVariantRowDisplay => ({
        id: variant.id,
        label: variant.optionValues.map((optionValue) => optionValue.value).filter(Boolean).join(' · ') || variant.label,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        isAvailable: variant.isAvailable,
    }))
    : [];

  return {
    optionGroups: priceGroup || commonPrice !== null ? optionGroups : [],
    priceGroup,
    commonPrice,
    matrix,
    rows,
  };
}
