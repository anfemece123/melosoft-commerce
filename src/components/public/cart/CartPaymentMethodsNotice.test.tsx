import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CartPaymentMethodsNotice } from './CartPaymentMethodsNotice';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

const theme = {
  primary: '#4f46e5',
  text: '#111827',
  mutedText: '#6b7280',
} as StorefrontTheme;

describe('CartPaymentMethodsNotice', () => {
  it('informa los medios disponibles sin convertirlos en una elección', () => {
    render(
      <CartPaymentMethodsNotice
        theme={theme}
        showCashOnDelivery
        showOnline
      />,
    );

    expect(screen.getByText('Formas de pago')).toBeTruthy();
    expect(screen.getByText('Online y contraentrega')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('¿Cómo quieres pagar?')).toBeNull();
  });

  it('muestra el único medio habilitado', () => {
    const { rerender } = render(
      <CartPaymentMethodsNotice
        theme={theme}
        showCashOnDelivery={false}
        showOnline
      />,
    );

    expect(screen.getByText('Pago online con Wompi')).toBeTruthy();

    rerender(
      <CartPaymentMethodsNotice
        theme={theme}
        showCashOnDelivery
        showOnline={false}
      />,
    );

    expect(screen.getByText('Pago contraentrega')).toBeTruthy();
  });
});
