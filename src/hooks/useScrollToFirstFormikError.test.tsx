import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form, Formik } from 'formik';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '@/components/ui/Input';
import { FormikErrorFocus } from './useScrollToFirstFormikError';

describe('FormikErrorFocus', () => {
  it('keeps submit enabled and moves focus to the first invalid field', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <Formik
        initialValues={{ email: '' }}
        validate={(values) => (!values.email ? { email: 'El correo es requerido.' } : {})}
        onSubmit={vi.fn()}
      >
        {({ errors, handleChange, submitCount, values }) => (
          <Form>
            <FormikErrorFocus />
            <Input
              id="email"
              name="email"
              label="Correo"
              value={values.email}
              onChange={handleChange}
              error={submitCount > 0 ? errors.email : undefined}
            />
            <button type="submit">Guardar</button>
          </Form>
        )}
      </Formik>,
    );

    const submit = screen.getByRole('button', { name: 'Guardar' });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);

    expect(await screen.findByText('El correo es requerido.')).toBeTruthy();
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      expect(document.activeElement).toBe(screen.getByLabelText('Correo'));
    });
  });
});
