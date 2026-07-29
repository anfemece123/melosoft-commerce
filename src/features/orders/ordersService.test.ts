import { describe, expect, it, vi } from 'vitest';
import type { Order } from './orders.types';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe('ordersService.amendOrderItems', () => {
  it('sends only trusted identifiers and quantities for new catalog lines', async () => {
    const { ordersService } = await import('./ordersService');
    rpcMock.mockResolvedValueOnce({ data: { changed: true }, error: null });
    vi.spyOn(ordersService, 'getOrderWithItems').mockResolvedValueOnce({ id: 'order-1' } as Order);

    await ordersService.amendOrderItems('order-1', {
      expectedUpdatedAt: '2026-07-28T12:00:00.000Z',
      reason: 'Cliente agregó un producto',
      items: [
        { orderItemId: 'existing-item-1', quantity: 2 },
        {
          productId: 'product-2',
          variantId: 'variant-2',
          quantity: 1,
          customizationNotes: 'Sin salsas',
          customizations: [{ optionGroupId: 'group-1', optionItemId: 'option-1' }],
        },
      ],
    });

    expect(rpcMock).toHaveBeenCalledWith('amend_store_order_items', {
      p_order_id: 'order-1',
      p_expected_updated_at: '2026-07-28T12:00:00.000Z',
      p_items: [
        { order_item_id: 'existing-item-1', quantity: 2 },
        {
          product_id: 'product-2',
          variant_id: 'variant-2',
          customization_notes: 'Sin salsas',
          customizations: [{ option_group_id: 'group-1', option_item_id: 'option-1' }],
          quantity: 1,
        },
      ],
      p_reason: 'Cliente agregó un producto',
    });
  });
});
