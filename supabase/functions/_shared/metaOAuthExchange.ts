interface MetaTokenExchangeUrlParams {
  graphApiVersion: string;
  appId: string;
  appSecret: string;
  code: string;
}

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
  return url.toString();
}
