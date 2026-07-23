import { describe, expect, it } from 'vitest';
import {
  buildMetaEmbeddedSignupTokenUrl,
  normalizeMetaSdkRedirectUri,
} from './metaOAuthExchange';

const sdkRedirectUri =
  'https://staticxx.facebook.com/x/connect/xd_arbiter/?version=46#cb=abc&origin=https%3A%2F%2Fcommerce.melosoftapp.com';

describe('buildMetaEmbeddedSignupTokenUrl', () => {
  it('preserves the exact redirect_uri used by FB.login()', () => {
    const result = new URL(buildMetaEmbeddedSignupTokenUrl({
      graphApiVersion: 'v25.0',
      appId: 'app-id',
      appSecret: 'app-secret',
      code: 'one-time-code',
      redirectUri: sdkRedirectUri,
    }));

    expect(result.origin).toBe('https://graph.facebook.com');
    expect(result.pathname).toBe('/v25.0/oauth/access_token');
    expect(result.searchParams.get('client_id')).toBe('app-id');
    expect(result.searchParams.get('client_secret')).toBe('app-secret');
    expect(result.searchParams.get('code')).toBe('one-time-code');
    expect(result.searchParams.has('redirect_uri')).toBe(true);
    expect(result.searchParams.get('redirect_uri')).toBe(sdkRedirectUri);
  });
});

describe('normalizeMetaSdkRedirectUri', () => {
  it('accepts the official Facebook SDK xd_arbiter redirect', () => {
    expect(normalizeMetaSdkRedirectUri(sdkRedirectUri)).toBe(sdkRedirectUri);
  });

  it('rejects non-Meta hosts and unexpected Meta paths', () => {
    expect(normalizeMetaSdkRedirectUri(
      'https://evil-facebook.com/x/connect/xd_arbiter/?version=46',
    )).toBeNull();
    expect(normalizeMetaSdkRedirectUri(
      'https://www.facebook.com/unexpected/path?version=46',
    )).toBeNull();
  });
});
