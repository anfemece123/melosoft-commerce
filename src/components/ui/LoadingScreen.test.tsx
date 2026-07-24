import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingScreen, PanelLoadingState } from './LoadingScreen';

describe('administrative loading states', () => {
  it('renders a branded, accessible full-screen loader', () => {
    const { container } = render(<LoadingScreen label="Cargando empresas…" />);

    expect(screen.getByRole('status', { name: 'Cargando empresas…' })).toBeTruthy();
    expect(screen.getByText('Melosoft Commerce')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/branding/melosoft-mark.png');
  });

  it('provides the same visual language for loading panel content', () => {
    const { container } = render(<PanelLoadingState label="Cargando pedidos…" />);

    expect(screen.getByRole('status', { name: 'Cargando pedidos…' })).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/branding/melosoft-mark.png');
    expect(screen.queryByText('Melosoft Commerce')).toBeNull();
  });
});
