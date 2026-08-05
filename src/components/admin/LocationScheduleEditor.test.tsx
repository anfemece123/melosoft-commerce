import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreLocation } from '@/features/locations/locations.types';
import { LocationScheduleEditor } from './LocationScheduleEditor';

const { locationsServiceMock } = vi.hoisted(() => ({
  locationsServiceMock: {
    getLocationSchedule: vi.fn(),
    getLocationExceptions: vi.fn(),
    getLocationOrderStatus: vi.fn(),
    saveScheduleConfiguration: vi.fn(),
    saveLocationException: vi.fn(),
    deleteLocationException: vi.fn(),
  },
}));

vi.mock('@/features/locations/locationsService', () => ({
  locationsService: locationsServiceMock,
}));

vi.mock('@/lib/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const location: StoreLocation = {
  id: 'location-1',
  storeId: 'store-1',
  name: 'Sede principal',
  slug: null,
  addressLine: null,
  neighborhood: null,
  city: 'Bogotá',
  department: 'Bogotá D.C.',
  country: 'CO',
  postalCode: null,
  latitude: null,
  longitude: null,
  isPrimary: true,
  isActive: true,
  isPublic: true,
  allowsPickup: true,
  allowsLocalDelivery: true,
  phone: null,
  whatsappNumber: null,
  sortOrder: 0,
  deliveryNotes: null,
  pickupNotes: null,
  timezone: 'America/Bogota',
  orderScheduleMode: 'custom',
  ordersPaused: false,
  ordersPausedUntil: null,
  ordersPauseReason: null,
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};

describe('LocationScheduleEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationsServiceMock.getLocationSchedule.mockResolvedValue([
      {
        id: 'interval-1',
        storeId: 'store-1',
        locationId: 'location-1',
        scheduleKind: 'ordering',
        dayOfWeek: 1,
        startsAt: '10:00:00',
        endsAt: '15:00:00',
        endsNextDay: false,
        isAllDay: false,
        sortOrder: 0,
      },
      {
        id: 'interval-2',
        storeId: 'store-1',
        locationId: 'location-1',
        scheduleKind: 'ordering',
        dayOfWeek: 1,
        startsAt: '18:00:00',
        endsAt: '22:00:00',
        endsNextDay: false,
        isAllDay: false,
        sortOrder: 1,
      },
    ]);
    locationsServiceMock.getLocationExceptions.mockResolvedValue([]);
    locationsServiceMock.getLocationOrderStatus.mockResolvedValue({
      isAcceptingOrders: true,
      statusCode: 'open',
      timezone: 'America/Bogota',
      localDate: '2026-08-04',
      localTime: '12:00:00',
      pausedUntil: null,
      pauseReason: null,
    });
  });

  it('opens on ordering hours and displays multiple shifts for one day', async () => {
    render(<LocationScheduleEditor location={location} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByText('Puedes recibir pedidos en varios turnos el mismo día.')).not.toBeNull();
    expect(screen.getByText('2 franjas')).not.toBeNull();
    expect(screen.getByDisplayValue('10:00')).not.toBeNull();
    expect(screen.getByDisplayValue('15:00')).not.toBeNull();
    expect(screen.getByDisplayValue('18:00')).not.toBeNull();
    expect(screen.getByDisplayValue('22:00')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Agregar otra franja' })).not.toBeNull();
  });
});
