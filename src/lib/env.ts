function getEnvVar(key: string): string {
  const value = import.meta.env[key] as string | undefined;
  if (!value) {
    console.warn(
      `⚠️ Missing environment variable: ${key}. Create a .env.local file based on .env.example.`
    );
    return '';
  }
  return value;
}

function getOptionalEnvVar(key: string): string | null {
  const value = import.meta.env[key] as string | undefined;
  return value || null;
}

export const env = {
  supabaseUrl: getEnvVar('VITE_SUPABASE_URL'),
  supabaseAnonKey: getEnvVar('VITE_SUPABASE_ANON_KEY'),
  // Origin of the admin panel itself (e.g. https://commerce.melosoftapp.com).
  // Two distinct jobs, NOT interchangeable:
  //  1. Wompi's checkout redirect base — required, Wompi rejects
  //     HTTP/localhost redirect URLs. Dev: an https tunnel (ngrok/
  //     cloudflared) pointed at the local dev server. Prod: this panel's
  //     real HTTPS origin.
  //  2. domainsService.getPlatformStoreUrl()'s fallback base for
  //     `{baseUrl}/s/{slug}` whenever storefrontRootDomain (below) isn't
  //     set yet — never a third-party tunnel domain.
  publicSiteUrl: getOptionalEnvVar('VITE_PUBLIC_SITE_URL'),
  // Wildcard root for the included storefront URL: {slug}.example.com.
  // Leave unset until the wildcard DNS record AND its TLS certificate are
  // verified working — setting it is what makes getPlatformStoreUrl()
  // switch from the `/s/:slug` fallback to the real subdomain, and turns
  // on the automatic /s/:slug → subdomain redirect (StorefrontDomainProvider).
  storefrontRootDomain: getOptionalEnvVar('VITE_STOREFRONT_ROOT_DOMAIN'),
  // Optional comma-separated extra hostnames that must always be treated
  // as the platform (never resolved as a store), beyond publicSiteUrl's
  // own host and every reserved subdomain of storefrontRootDomain (both
  // already covered automatically — see StorefrontDomainProvider).
  platformHostnames: getOptionalEnvVar('VITE_PLATFORM_HOSTNAMES'),
  // Meta App ID and WhatsApp Embedded Signup Configuration ID — both are
  // PUBLIC identifiers (not secrets) the Facebook JS SDK requires
  // client-side to launch FB.login(). The App Secret and access tokens
  // NEVER have a VITE_ variable — see supabase/functions/
  // whatsapp-embedded-signup, which is the only place those are read,
  // from Supabase Secrets, never from the frontend build.
  metaAppId: getOptionalEnvVar('VITE_META_APP_ID'),
  metaWhatsappConfigId: getOptionalEnvVar('VITE_META_WHATSAPP_CONFIG_ID'),
} as const;
