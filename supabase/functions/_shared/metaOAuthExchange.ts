interface MetaTokenExchangeUrlParams {
  graphApiVersion: string;
  appId: string;
  appSecret: string;
  code: string;
}

// FB.login() owns an internal, dynamic cross-domain redirect URI used to
// deliver its popup result back to the JavaScript SDK. That URI is not
// exposed in authResponse. For a code produced by that SDK flow, Meta's
// token endpoint distinguishes an omitted redirect_uri from an explicitly
// empty one: the latter tells it there was no caller-provided redirect URI.
// Omitting this parameter produces OAuthException subcode 36008.
export function buildMetaEmbeddedSignupTokenUrl({
  graphApiVersion,
  appId,
  appSecret,
  code,
}: MetaTokenExchangeUrlParams): string {
  const url = new URL(`https://graph.facebook.com/${graphApiVersion}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('code', code);
  url.searchParams.set('redirect_uri', '');
  return url.toString();
}
