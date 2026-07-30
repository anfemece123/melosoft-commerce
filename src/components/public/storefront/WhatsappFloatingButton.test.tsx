import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildStorefrontTheme } from './storefrontTheme';
import { WhatsappFloatingButton } from './WhatsappFloatingButton';

const theme = buildStorefrontTheme({
  mode: 'light',
  primaryColor: '#111827',
  backgroundColor: '#ffffff',
  textColor: '#111827',
});

describe('WhatsappFloatingButton', () => {
  it('renders a stable floating WhatsApp action without pulse animations', () => {
    const { container } = render(
      <WhatsappFloatingButton
        href="https://wa.me/573001234567"
        layout="floating"
        storeName="Tienda demo"
        theme={theme}
      />
    );

    expect(screen.getByRole('link', { name: 'Escribir a Tienda demo por WhatsApp' })).toBeTruthy();
    expect(screen.getByText('Chatea con nosotros')).toBeTruthy();
    expect(container.querySelector('.animate-ping')).toBeNull();
  });

  it('renders the integrated presentation inside the page flow', () => {
    render(
      <WhatsappFloatingButton
        href="https://wa.me/573001234567"
        layout="inline"
        storeName="Tienda demo"
        theme={theme}
      />
    );

    expect(screen.getByText('¿Necesitas ayuda?')).toBeTruthy();
    expect(screen.getByText('Habla directamente con Tienda demo por WhatsApp.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Escribir a Tienda demo por WhatsApp' })).toBeTruthy();
  });
});
