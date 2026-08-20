import { describe, expect, it } from 'vitest';
import type { PublicCartaVariant } from './carta.types';
import { buildCartaVariantPresentation } from './cartaVariantPresentation';

function variant(
  id: string,
  fruit: string,
  preparation: string,
  price: number,
  isAvailable = true,
): PublicCartaVariant {
  return {
    id,
    sku: null,
    price,
    compareAtPrice: null,
    stockQuantity: isAvailable ? 5 : 0,
    stockPolicy: 'deny',
    isDefault: id === 'mora-water',
    isAvailable,
    imageUrl: null,
    optionValues: [
      { optionId: 'fruit', optionName: 'Fruta', valueId: fruit.toLowerCase(), value: fruit },
      { optionId: 'preparation', optionName: 'Agua o leche', valueId: preparation.toLowerCase(), value: preparation },
    ],
    label: `Fruta: ${fruit} · Agua o leche: ${preparation}`,
  };
}

function beerVariant(id: string, beer: string, preparation: string, price: number): PublicCartaVariant {
  return {
    ...variant(id, beer, preparation, price),
    optionValues: [
      { optionId: 'beer', optionName: 'Bebida', valueId: beer.toLowerCase(), value: beer },
      { optionId: 'preparation', optionName: 'Preparación', valueId: preparation.toLowerCase(), value: preparation },
    ],
    label: `${beer} · ${preparation}`,
  };
}

describe('carta variant presentation', () => {
  it('groups a product matrix into dimensions and a consistent price modifier', () => {
    const presentation = buildCartaVariantPresentation([
      variant('mora-water', 'Mora', 'Agua', 6000),
      variant('mora-milk', 'Mora', 'Leche', 8000),
      variant('mango-water', 'Mango', 'Agua', 6000),
      variant('mango-milk', 'Mango', 'Leche', 8000),
    ]);

    expect(presentation.optionGroups).toEqual([{
      id: 'fruit',
      name: 'Fruta',
      values: [
        { id: 'mora', label: 'Mora', isAvailable: true },
        { id: 'mango', label: 'Mango', isAvailable: true },
      ],
    }]);
    expect(presentation.priceGroup).toEqual({
      id: 'preparation',
      name: 'Agua o leche',
      values: [
        { id: 'agua', label: 'Agua', price: 6000, compareAtPrice: null, isAvailable: true },
        { id: 'leche', label: 'Leche', price: 8000, compareAtPrice: null, isAvailable: true },
      ],
    });
    expect(presentation.rows).toEqual([]);
  });

  it('keeps a compact row fallback when prices cannot be represented by one modifier', () => {
    const presentation = buildCartaVariantPresentation([
      variant('mora-water', 'Mora', 'Agua', 6000),
      variant('mora-milk', 'Mora', 'Leche', 8000),
      variant('mango-water', 'Mango', 'Agua', 7000),
      variant('mango-milk', 'Mango', 'Leche', 9500),
    ]);

    expect(presentation.priceGroup).toBeNull();
    expect(presentation.matrix).toBeTruthy();
    expect(presentation.matrix?.rowOptionName).toBe('Fruta');
    expect(presentation.matrix?.columnOptionName).toBe('Agua o leche');
    expect(presentation.matrix?.rows.map((row) => row.label)).toEqual(['Mora', 'Mango']);
    expect(presentation.matrix?.rows[0].cells.map((cell) => cell?.price)).toEqual([6000, 8000]);
  });

  it('groups repeated preparation labels even when prices vary by product', () => {
    const presentation = buildCartaVariantPresentation([
      beerVariant('club-water', 'Club Colombia', 'Normal', 7000),
      beerVariant('club-michelada', 'Club Colombia', 'Michelada', 11000),
      beerVariant('corona-water', 'Corona', 'Normal', 9000),
      beerVariant('corona-michelada', 'Corona', 'Michelada', 13000),
    ]);

    expect(presentation.matrix?.rowOptionName).toBe('Bebida');
    expect(presentation.matrix?.columnOptionName).toBe('Preparación');
    expect(presentation.matrix?.columns.map((column) => column.label)).toEqual(['Normal', 'Michelada']);
    expect(presentation.matrix?.rows[1].cells.map((cell) => cell?.price)).toEqual([9000, 13000]);
    expect(presentation.matrix?.groups.map((group) => group.labels)).toEqual([
      ['Club Colombia'],
      ['Corona'],
    ]);

    const groupedPresentation = buildCartaVariantPresentation([
      beerVariant('club-dorada-normal', 'Club dorada', 'Normal', 7000),
      beerVariant('club-dorada-michelada', 'Club dorada', 'Michelada', 11000),
      beerVariant('club-roja-normal', 'Club roja', 'Normal', 7000),
      beerVariant('club-roja-michelada', 'Club roja', 'Michelada', 11000),
      beerVariant('corona-normal', 'Corona', 'Normal', 9000),
      beerVariant('corona-michelada', 'Corona', 'Michelada', 13000),
    ]);

    expect(groupedPresentation.matrix?.groups.map((group) => group.labels)).toEqual([
      ['Club dorada', 'Club roja'],
      ['Corona'],
    ]);
  });

  it('treats a variant without the modifier value as the default presentation', () => {
    const baseBeer = beerVariant('club-normal', 'Club Colombia', 'Normal', 7000);
    const micheladaBeer = beerVariant('club-michelada', 'Club Colombia', 'Michelada', 11000);
    const explicitNormalBeer = beerVariant('club-explicit-normal', 'Club Colombia', 'Normal', 7000);
    baseBeer.optionValues = baseBeer.optionValues.filter((value) => value.optionId !== 'preparation');

    const presentation = buildCartaVariantPresentation([baseBeer, micheladaBeer, explicitNormalBeer]);

    expect(presentation.matrix?.columns.map((column) => column.label)).toEqual(['Normal', 'Michelada']);
    expect(presentation.matrix?.groups[0].cells.map((cell) => cell?.price)).toEqual([7000, 11000]);
  });
});
