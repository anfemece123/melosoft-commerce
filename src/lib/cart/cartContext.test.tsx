import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartProvider, useCart, type CartItem } from './cartContext';

const line: CartItem = {
  lineId: 'line-1',
  productId: 'product-1',
  storeId: 'store-1',
  productSlug: 'producto-1',
  productName: 'Producto de prueba',
  imageUrl: null,
  unitPrice: 1000,
  quantity: 1,
  customizationNotes: null,
  customizations: [],
};

function CartHarness() {
  const { items, updateQuantity } = useCart();
  const item = items[0];

  return (
    <>
      <span data-testid="quantity">{item?.quantity ?? 0}</span>
      <button type="button" onClick={() => updateQuantity('line-1', (quantity) => quantity + 1)}>
        aumentar
      </button>
      <button type="button" onClick={() => updateQuantity('line-1', (quantity) => quantity - 1)}>
        disminuir
      </button>
    </>
  );
}

describe('CartProvider quantity updates', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'melosoft_cart_test-store',
      JSON.stringify({ items: [line], updatedAt: 1 }),
    );
  });

  it('applies consecutive increments against the latest cart quantity', () => {
    render(
      <CartProvider storeSlug="test-store">
        <CartHarness />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'aumentar' }));
    fireEvent.click(screen.getByRole('button', { name: 'aumentar' }));

    expect(screen.getByTestId('quantity').textContent).toBe('3');
  });

  it('removes the line when consecutive decrements reach zero', () => {
    localStorage.setItem(
      'melosoft_cart_test-store',
      JSON.stringify({ items: [{ ...line, quantity: 2 }], updatedAt: 1 }),
    );

    render(
      <CartProvider storeSlug="test-store">
        <CartHarness />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'disminuir' }));
    fireEvent.click(screen.getByRole('button', { name: 'disminuir' }));

    expect(screen.getByTestId('quantity').textContent).toBe('0');
  });
});
