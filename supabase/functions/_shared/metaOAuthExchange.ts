interface MetaTokenExchangeUrlParams {
  graphApiVersion: string;
  appId: string;
  appSecret: string;
  code: string;
  redirectUri: string;
}

export function normalizeMetaSdkRedirectUri(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 4_096) return null;
  try {
    const url = new URL(value);
    const trustedHost = url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com');
    const normalizedPath = url.pathname.replace(/\/+$/, '');
    return url.protocol === 'https:' &&
        trustedHost &&
        normalizedPath === '/x/connect/xd_arbiter' &&
        url.searchParams.has('version')
      ? value
      : null;
  } catch {
    return null;
  }
}

export function buildMetaEmbeddedSignupTokenUrl({
  graphApiVersion,
  appId,
  appSecret,
  code,
  redirectUri,
}: MetaTokenExchangeUrlParams): string {
  const url = new URL(`https://graph.facebook.com/${graphApiVersion}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('code', code);
  url.searchParams.set('redirect_uri', redirectUri);
  return url.toString();
}
