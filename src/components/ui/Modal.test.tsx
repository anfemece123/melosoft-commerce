import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders in a portal and closes with Escape', () => {
    const onClose = vi.fn();

    render(
      <Modal open title="Crear partner" description="Datos comerciales" onClose={onClose}>
        <p>Contenido del formulario</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Crear partner' })).toBeTruthy();
    expect(screen.getByText('Contenido del formulario')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close from the backdrop when dismissal is disabled', () => {
    const onClose = vi.fn();

    render(
      <Modal open title="Procesando" onClose={onClose} dismissible={false}>
        <p>Espera un momento</p>
      </Modal>,
    );

    fireEvent.click(screen.getByRole('dialog').previousElementSibling as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });
});
