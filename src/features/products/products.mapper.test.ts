import { describe, expect, it } from 'vitest';
import { mapProductUpdateToRow } from './products.mapper';

describe('product carta price mapping', () => {
  it('updates only carta_price without touching ecommerce prices', () => {
    expect(mapProductUpdateToRow({ cartaPrice: 19000 })).toEqual({ carta_price: 19000 });
    expect(mapProductUpdateToRow({ cartaPrice: null })).toEqual({ carta_price: null });
  });
});
