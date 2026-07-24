import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Store } from '@/features/stores/stores.types';
import { StoreActivationControl } from './StoreActivationControl';

const { setStoreActivationMock } = vi.hoisted(() => ({
  setStoreActivationMock: vi.fn(),
}));

vi.mock('@/features/stores/storesService', () => ({
  storesService: {
    setStoreActivation: setStoreActivationMock,
  },
}));

vi.mock('@/lib/notifications', () => ({
  notify: {
    success: vi.fn(),
    fromError: vi.fn(),
  },
}));

function buildStore(status: Store['status']): Store {
  return {
    id: 'store-1',
    ownerId: 'owner-1',
    name: 'Café Central',
    slug: 'cafe-central',
    slogan: null,
    businessType: 'restaurante',
    businessVertical: 'food_restaurant',
    businessSubcategory: null,
    description: null,
    logoUrl: null,
    faviconUrl: null,
    heroEnabled: true,
    heroTitle: null,
    heroSubtitle: null,
    heroCtaLabel: null,
    heroImageUrl: null,
    heroBackgroundImageUrl: null,
    whatsappNumber: null,
    supportEmail: null,
    instagramUrl: null,
    facebookUrl: null,
    tiktokUrl: null,
    country: 'CO',
    city: 'Bogotá',
    currency: 'COP',
    status,
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  };
}

describe('StoreActivationControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires confirmation and deactivates an active company', async () => {
    const activeStore = buildStore('active');
    const inactiveStore = buildStore('inactive');
    const onChanged = vi.fn();
    setStoreActivationMock.mockResolvedValueOnce(inactiveStore);

    render(<StoreActivationControl store={activeStore} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(screen.getByRole('dialog', { name: 'Desactivar empresa' })).toBeTruthy();
    expect(screen.getByText(/sus datos no se eliminarán/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, desactivar' }));

    await waitFor(() => {
      expect(setStoreActivationMock).toHaveBeenCalledWith('store-1', false);
      expect(onChanged).toHaveBeenCalledWith(inactiveStore);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('activates an inactive company through the same guarded operation', async () => {
    const inactiveStore = buildStore('inactive');
    const activeStore = buildStore('active');
    const onChanged = vi.fn();
    setStoreActivationMock.mockResolvedValueOnce(activeStore);

    render(<StoreActivationControl store={inactiveStore} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, activar' }));

    await waitFor(() => {
      expect(setStoreActivationMock).toHaveBeenCalledWith('store-1', true);
      expect(onChanged).toHaveBeenCalledWith(activeStore);
    });
  });

  it('does not overwrite suspended or archived lifecycle states', () => {
    render(<StoreActivationControl store={buildStore('suspended')} onChanged={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /activar|desactivar/i })).toBeNull();
    expect(screen.getByText(/requiere una gestión administrativa específica/i)).toBeTruthy();
  });
});
