import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminStoreIdentityMark } from './AdminStoreIdentityMark';

describe('AdminStoreIdentityMark', () => {
  it('muestra el logo configurado de la empresa', () => {
    render(
      <AdminStoreIdentityMark
        storeName="Café Central"
        logoUrl="https://cdn.example.com/cafe.png"
      />,
    );

    const logo = screen.getByAltText('Logo de Café Central');
    expect(logo.getAttribute('src')).toBe('https://cdn.example.com/cafe.png');
  });

  it('usa las iniciales cuando no hay logo o la imagen falla', () => {
    const { rerender } = render(
      <AdminStoreIdentityMark storeName="Café Central" logoUrl={null} />,
    );
    expect(screen.getByText('CC')).toBeTruthy();

    rerender(
      <AdminStoreIdentityMark
        storeName="Café Central"
        logoUrl="https://cdn.example.com/broken.png"
      />,
    );
    fireEvent.error(screen.getByAltText('Logo de Café Central'));
    expect(screen.getByText('CC')).toBeTruthy();
  });
});
