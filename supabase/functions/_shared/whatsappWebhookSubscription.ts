export interface MetaWabaWebhookSubscriptionResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

export function resolveWhatsappWebhookCallbackUrl(params: {
  supabaseUrl: string;
  configuredUrl?: string | null;
}): string {
  const configuredUrl = params.configuredUrl?.trim();
  if (configuredUrl) return configuredUrl;
  return `${params.supabaseUrl.replace(/\/$/, '')}/functions/v1/whatsapp-webhook`;
}

// Meta supports one app-level callback plus a different messages callback
// for each WABA. Commerce uses this override so the same Meta app can keep
// its default callback assigned to Melosoft Citas.
export async function subscribeWhatsappWabaWithWebhookOverride(params: {
  graphApiVersion: string;
  wabaId: string;
  accessToken: string;
  callbackUrl: string;
  verifyToken: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaWabaWebhookSubscriptionResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/${params.graphApiVersion}/${encodeURIComponent(params.wabaId)}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          override_callback_uri: params.callbackUrl,
          verify_token: params.verifyToken,
        }),
        signal: controller.signal,
      },
    );
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: {} };
  } finally {
    clearTimeout(timeout);
  }
}
