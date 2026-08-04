import { describe, expect, it } from 'vitest';
import { getStoreCreationCommerceDefaults } from './storeCreationDefaults';

describe('store creation commerce defaults', () => {
  it('keeps the primary location capabilities aligned for restaurants', () => {
    const defaults = getStoreCreationCommerceDefaults('food_restaurant');
    expect(defaults.allows_pickup).toBe(true);
    expect(defaults.allows_local_delivery).toBe(true);
    expect(defaults.allows_national_shipping).toBe(false);
  });

  it('does not enable fulfillment capabilities for catalog-only businesses', () => {
    const defaults = getStoreCreationCommerceDefaults('catalog_quote');
    expect(defaults.allows_pickup).toBe(false);
    expect(defaults.allows_local_delivery).toBe(false);
    expect(defaults.allows_national_shipping).toBe(false);
  });
});
