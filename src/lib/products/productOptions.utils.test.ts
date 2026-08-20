import { describe, expect, it } from 'vitest';
import type { PublicProductOptionGroup } from '@/types/common.types';
import {
  applyLocationAvailabilityToProductOptions,
  buildProductOptionSelectionsFromCart,
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
        imageUrl: null,
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
  it('replaces the previous option when a one-item group is configured as multiple', () => {
    const oneChoiceGroup = group({
      selectionType: 'multiple',
      maxSelect: 1,
      items: [
        { ...group().items[0], id: 'cola' },
        { ...group().items[0], id: 'juice', label: 'Jugo', isDefault: false },
      ],
    });

    expect(toggleProductOptionSelection(oneChoiceGroup, { drinks: ['cola'] }, 'juice')).toEqual({ drinks: ['juice'] });
  });

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

  it('allows removing a selected option that became unavailable', () => {
    const soldOut = group({
      items: [{ ...group().items[0], isAvailable: false, unavailableReason: 'Agotado' }],
    });
    expect(toggleProductOptionSelection(soldOut, { drinks: ['cola'] }, 'cola')).toEqual({ drinks: [] });
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

  it('disables a linked drink that is unavailable at the selected location', () => {
    const [localized] = applyLocationAvailabilityToProductOptions([group()], new Set(['product-cola']));
    expect(localized.items[0]).toMatchObject({
      isAvailable: false,
      unavailableReason: 'No disponible en esta sede',
    });
  });

  it('restores modifier selections when editing a cart line', () => {
    expect(buildProductOptionSelectionsFromCart([group()], [{
      optionGroupId: 'drinks',
      optionGroupName: 'Bebida',
      optionItemId: 'cola',
      optionItemLabel: 'Gaseosa',
      priceDelta: 4_000,
    }])).toEqual({ drinks: ['cola'] });
  });
});
