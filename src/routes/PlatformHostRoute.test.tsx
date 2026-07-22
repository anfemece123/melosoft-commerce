import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlatformHostRoute } from './PlatformHostRoute';
import {
  StorefrontDomainContext,
  type StorefrontDomainMode,
} from '@/lib/storefront/storefrontDomainContext';

// Covers the general host guard required for /admin/*: the panel must
// only render on the platform host (commerce.melosoftapp.com / localhost)
// and never on a storefront (subdomain, custom domain, or a hostname
// still resolving as one) — the exact scenario a customer-facing
// {slug}.melosoftapp.com or a connected custom domain would be in.
function renderAdminRouteInMode(mode: StorefrontDomainMode, hostname: string) {
  return render(
    <StorefrontDomainContext.Provider value={{ mode, resolution: null, hostname }}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<PlatformHostRoute />}>
            <Route path="/admin" element={<div>PANEL_CONTENT</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </StorefrontDomainContext.Provider>,
  );
}

describe('PlatformHostRoute', () => {
  it('renders admin content on the platform host (commerce.melosoftapp.com)', () => {
    renderAdminRouteInMode('platform', 'commerce.melosoftapp.com');
    expect(screen.getByText('PANEL_CONTENT')).toBeTruthy();
  });

  it('renders admin content on localhost (dev)', () => {
    renderAdminRouteInMode('platform', 'localhost');
    expect(screen.getByText('PANEL_CONTENT')).toBeTruthy();
  });

  it('blocks admin content on a store subdomain', () => {
    renderAdminRouteInMode('subdomain', 'padel-shop.melosoftapp.com');
    expect(screen.queryByText('PANEL_CONTENT')).toBeNull();
    expect(screen.getByText(/no está disponible aquí/i)).toBeTruthy();
  });

  it('blocks admin content on a verified custom domain', () => {
    renderAdminRouteInMode('custom', 'centriparts.com.co');
    expect(screen.queryByText('PANEL_CONTENT')).toBeNull();
    expect(screen.getByText(/no está disponible aquí/i)).toBeTruthy();
  });

  it('blocks admin content on an unrecognized host', () => {
    renderAdminRouteInMode('unrecognized', 'no-existe.melosoftapp.com');
    expect(screen.queryByText('PANEL_CONTENT')).toBeNull();
  });

  it('blocks admin content while a non-platform host is still resolving', () => {
    // 'loading' only ever happens for a hostname that is NOT a
    // configured platform host — must be denied immediately, not
    // treated as "maybe platform" while resolution is in flight.
    renderAdminRouteInMode('loading', 'padel-shop.melosoftapp.com');
    expect(screen.queryByText('PANEL_CONTENT')).toBeNull();
  });

  it('never navigates — this is a pure render gate, so it cannot loop', () => {
    // jsdom's Location.prototype.assign/replace are non-configurable, so
    // neither direct assignment nor vi.spyOn can patch them in place —
    // only the `location` property on `window` itself can be swapped.
    const originalLocation = window.location;
    const assign = vi.fn();
    const replace = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign, replace },
    });

    renderAdminRouteInMode('subdomain', 'padel-shop.melosoftapp.com');
    expect(assign).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });
});
