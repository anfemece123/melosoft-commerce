import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: invokeMock },
    rpc: rpcMock,
  },
}));

import { domainsService } from './domainsService';

describe('domainsService while custom-domain management is paused', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    rpcMock.mockClear();
  });

  it('returns no custom domains without invoking the management function', async () => {
    await expect(domainsService.list('store-1')).resolves.toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('blocks management actions locally without making network requests', async () => {
    await expect(domainsService.connect('store-1', 'tienda.example.com'))
      .rejects.toThrow('no está disponible temporalmente');
    await expect(domainsService.refresh('domain-1'))
      .rejects.toThrow('no está disponible temporalmente');
    await expect(domainsService.remove('domain-1'))
      .rejects.toThrow('no está disponible temporalmente');

    expect(invokeMock).not.toHaveBeenCalled();
  });
});
