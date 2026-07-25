import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OwnerCredentialsDialog } from './OwnerCredentialsDialog';

describe('OwnerCredentialsDialog', () => {
  it('keeps the password hidden until requested and copies both credentials', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <OwnerCredentialsDialog
        open
        storeName="Café Central"
        email="owner@example.com"
        password="SecureOwner12!"
        onContinue={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: /empresa y acceso creados/i })).toBeTruthy();
    expect(screen.queryByText('SecureOwner12!')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByText('SecureOwner12!')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar credenciales' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'Email: owner@example.com\nContraseña: SecureOwner12!'
      );
    });
  });
});
