import { describe, expect, it } from 'vitest';
import { buildMetaEmbeddedSignupTokenUrl } from './metaOAuthExchange';

describe('buildMetaEmbeddedSignupTokenUrl', () => {
  it('includes an explicitly empty redirect_uri for codes returned by FB.login()', () => {
    const result = new URL(buildMetaEmbeddedSignupTokenUrl({
      graphApiVersion: 'v25.0',
      appId: 'app-id',
      appSecret: 'app-secret',
      code: 'one-time-code',
    }));

    expect(result.origin).toBe('https://graph.facebook.com');
    expect(result.pathname).toBe('/v25.0/oauth/access_token');
    expect(result.searchParams.get('client_id')).toBe('app-id');
    expect(result.searchParams.get('client_secret')).toBe('app-secret');
    expect(result.searchParams.get('code')).toBe('one-time-code');
    expect(result.searchParams.has('redirect_uri')).toBe(true);
    expect(result.searchParams.get('redirect_uri')).toBe('');
    expect(result.toString()).toContain('redirect_uri=');
  });
});
