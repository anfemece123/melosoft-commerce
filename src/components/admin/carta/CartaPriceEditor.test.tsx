import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartaPriceEditor } from './CartaPriceEditor';

describe('CartaPriceEditor', () => {
  it('edits a carta-only value and exposes the ecommerce fallback separately', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <CartaPriceEditor
        productId="dish"
        productName="Hamburguesa"
        currency="COP"
        ecommercePrice={25000}
        cartaPrice={22000}
        value="22000"
        onChange={onChange}
        onBlur={() => undefined}
        onReset={onReset}
      />
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: /Precio en la carta de Hamburguesa/i }), { target: { value: '21000' } });
    expect(onChange).toHaveBeenCalledWith('21000');
    expect(screen.getByText('Independiente del ecommerce')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Usar ecommerce/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('explains when the carta is inheriting the ecommerce price', () => {
    render(
      <CartaPriceEditor
        productId="dish"
        productName="Hamburguesa"
        currency="COP"
        ecommercePrice={25000}
        cartaPrice={null}
        value="25000"
        onChange={() => undefined}
        onBlur={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(screen.getByText(/Usando.*25\.000/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Usar ecommerce/i })).toBeNull();
  });
});
