import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderingStatusNotice } from './OrderingStatusNotice';

const { useSelectedLocationMock } = vi.hoisted(() => ({
  useSelectedLocationMock: vi.fn(),
}));

vi.mock('@/lib/locations/locationContext', () => ({
  useSelectedLocation: useSelectedLocationMock,
}));

describe('OrderingStatusNotice', () => {
  beforeEach(() => {
    useSelectedLocationMock.mockReset();
  });

  it('does not show a banner while orders are available', () => {
    useSelectedLocationMock.mockReturnValue({
      scheduleLoading: false,
      orderStatus: { isAcceptingOrders: true, statusCode: 'open' },
    });

    const { container } = render(<OrderingStatusNotice />);

    expect(container.innerHTML).toBe('');
    expect(screen.queryByText('Pedidos disponibles')).toBeNull();
  });

  it('keeps the actionable warning when ordering is paused', () => {
    useSelectedLocationMock.mockReturnValue({
      scheduleLoading: false,
      orderStatus: { isAcceptingOrders: false, statusCode: 'paused' },
    });

    render(<OrderingStatusNotice />);

    expect(screen.getByText('Los pedidos están pausados temporalmente.')).not.toBeNull();
  });
});
