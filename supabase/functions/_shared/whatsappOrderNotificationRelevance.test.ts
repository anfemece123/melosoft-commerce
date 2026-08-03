import { describe, expect, it } from 'vitest';
import {
  isWhatsappFulfillmentMilestoneCurrent,
  isWhatsappFulfillmentMilestoneEvent,
} from './whatsappOrderNotificationRelevance.ts';

describe('WhatsApp fulfillment notification relevance', () => {
  it('matches each shipped message to the active fulfillment route', () => {
    expect(isWhatsappFulfillmentMilestoneCurrent('order_ready_for_pickup', 'shipped', 'pickup')).toBe(true);
    expect(isWhatsappFulfillmentMilestoneCurrent('order_out_for_delivery', 'shipped', 'local_delivery')).toBe(true);
    expect(isWhatsappFulfillmentMilestoneCurrent('order_shipped', 'shipped', 'national_shipping')).toBe(true);

    expect(isWhatsappFulfillmentMilestoneCurrent('order_ready_for_pickup', 'shipped', 'local_delivery')).toBe(false);
    expect(isWhatsappFulfillmentMilestoneCurrent('order_shipped', 'shipped', 'pickup')).toBe(false);
  });

  it('rejects queued messages after the order moves backward or forward', () => {
    expect(isWhatsappFulfillmentMilestoneCurrent('order_out_for_delivery', 'processing', 'local_delivery')).toBe(false);
    expect(isWhatsappFulfillmentMilestoneCurrent('order_out_for_delivery', 'delivered', 'local_delivery')).toBe(false);
    expect(isWhatsappFulfillmentMilestoneCurrent('order_delivered', 'processing', 'local_delivery')).toBe(false);
    expect(isWhatsappFulfillmentMilestoneCurrent('order_cancelled', 'confirmed', 'pickup')).toBe(false);
  });

  it('keeps terminal messages valid only in their exact terminal state', () => {
    expect(isWhatsappFulfillmentMilestoneCurrent('order_delivered', 'delivered', 'pickup')).toBe(true);
    expect(isWhatsappFulfillmentMilestoneCurrent('order_cancelled', 'cancelled', 'pickup')).toBe(true);
  });

  it('guards only customer-facing fulfillment milestones', () => {
    expect(isWhatsappFulfillmentMilestoneEvent('order_shipped')).toBe(true);
    expect(isWhatsappFulfillmentMilestoneEvent('order_received')).toBe(false);
    expect(isWhatsappFulfillmentMilestoneEvent('test_message')).toBe(false);
  });
});
