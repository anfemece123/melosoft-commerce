import { describe, expect, it } from 'vitest';
import { getStatusConfig } from './OrderStatusBadge';

describe('professional ecommerce order labels', () => {
  it('keeps restaurant preparation language unchanged', () => {
    expect(getStatusConfig('processing', 'restaurant', 'delivery').label).toBe('En preparación');
  });

  it('adapts ecommerce progress to each fulfillment method', () => {
    expect(getStatusConfig('processing', 'retail', 'national_shipping').label).toBe('Preparando despacho');
    expect(getStatusConfig('processing', 'retail', 'pickup').label).toBe('Preparando para recoger');
    expect(getStatusConfig('shipped', 'retail', 'national_shipping').label).toBe('Despachado');
    expect(getStatusConfig('shipped', 'retail', 'local_delivery').label).toBe('En camino');
    expect(getStatusConfig('shipped', 'retail', 'pickup').label).toBe('Listo para recoger');
    expect(getStatusConfig('delivered', 'retail', 'pickup').label).toBe('Recogido');
  });
});
