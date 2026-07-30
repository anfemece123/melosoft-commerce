import { describe, expect, it } from 'vitest';
import type { PublicProductOptionGroup } from '@/types/common.types';
import {
  buildInitialProductOptionSelections,
  toggleProductOptionSelection,
  validateProductOptionSelections,
} from './productOptions.utils';

function group(overrides: Partial<PublicProductOptionGroup> = {}): PublicProductOptionGroup {
  return {
    id: 'drinks',
    name: 'Bebida',
    description: null,
    selectionType: 'single',
    minSelect: 1,
    maxSelect: 1,
    isRequired: true,
    sortOrder: 0,
    items: [
      {
        id: 'cola',
        label: 'Gaseosa',
        description: null,
        priceDelta: 4_000,
        isDefault: true,
        sortOrder: 0,
        isAvailable: true,
        unavailableReason: null,
        linkedProductId: 'product-cola',
        linkedVariantId: null,
        linkedQuantity: 1,
        priceMode: 'catalog',
      },
    ],
    ...overrides,
  };
}

describe('product option availability', () => {
  it('does not preselect a default option that is sold out', () => {
    const soldOut = group({
      items: [{ ...group().items[0], isAvailable: false, unavailableReason: 'Agotado' }],
    });
    expect(buildInitialProductOptionSelections([soldOut])).toEqual({ drinks: [] });
  });

  it('does not allow selecting an unavailable linked product', () => {
    const soldOut = group({
      items: [{ ...group().items[0], isAvailable: false, unavailableReason: 'Agotado' }],
    });
    expect(toggleProductOptionSelection(soldOut, { drinks: [] }, 'cola')).toEqual({ drinks: [] });
  });

  it('explains when a required group has no available choices', () => {
    const soldOut = group({
      items: [{ ...group().items[0], isAvailable: false, unavailableReason: 'Agotado' }],
    });
    expect(validateProductOptionSelections([soldOut], { drinks: [] })).toEqual([
      '"Bebida" no tiene suficientes opciones disponibles en este momento.',
    ]);
  });

  it('rejects a selection that became unavailable after the page loaded', () => {
    const soldOut = group({
      items: [{ ...group().items[0], isAvailable: false, unavailableReason: 'Agotado' }],
    });
    expect(validateProductOptionSelections([soldOut], { drinks: ['cola'] })[0]).toContain('se agotó');
  });
});
