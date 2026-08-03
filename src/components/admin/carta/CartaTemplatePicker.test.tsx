import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartaTemplatePicker } from './CartaTemplatePicker';

describe('CartaTemplatePicker', () => {
  it('presents the former gallery format as the new Editorial mode', () => {
    render(<CartaTemplatePicker value="signature" onChange={vi.fn()} />);

    expect(screen.getByText('Editorial')).toBeTruthy();
    expect(screen.getByText(/Imagen y descripción ordenadas/i)).toBeTruthy();
    expect(screen.queryByText('Galería')).toBeNull();
    expect(screen.queryByText(/platos destacados/i)).toBeNull();
  });

  it('keeps the existing gallery storage key when Editorial is selected', () => {
    const onChange = vi.fn();
    render(<CartaTemplatePicker value="signature" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Editorial/i }));

    expect(onChange).toHaveBeenCalledWith('gallery');
  });
});
