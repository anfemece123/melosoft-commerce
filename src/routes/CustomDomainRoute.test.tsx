import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Outlet, Route, Routes, useOutletContext } from 'react-router-dom';
import { StorefrontDomainContext } from '@/lib/storefront/storefrontDomainContext';
import { CustomDomainRoute } from './CustomDomainRoute';

interface TestOutletContext {
  storeSlug: string;
}

function ContextSource() {
  return <Outlet context={{ storeSlug: 'restaurante-demo' } satisfies TestOutletContext} />;
}

function ContextConsumer() {
  const context = useOutletContext<TestOutletContext>();
  return <div>{context.storeSlug}</div>;
}

describe('CustomDomainRoute', () => {
  it('forwards the parent outlet context to custom-domain pages', () => {
    render(
      <StorefrontDomainContext.Provider value={{ mode: 'custom', resolution: null, hostname: 'restaurante.example' }}>
        <MemoryRouter initialEntries={['/carta']}>
          <Routes>
            <Route element={<ContextSource />}>
              <Route element={<CustomDomainRoute />}>
                <Route path="/carta" element={<ContextConsumer />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </StorefrontDomainContext.Provider>
    );

    expect(screen.getByText('restaurante-demo')).toBeTruthy();
  });
});
