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
  // Optional: public HTTPS base URL for Wompi redirect.
  // Required to use Wompi — it rejects HTTP/localhost redirect URLs.
  // Dev:  VITE_PUBLIC_SITE_URL=https://xxxx.ngrok.io
  // Prod: VITE_PUBLIC_SITE_URL=https://yourdomain.com
  publicSiteUrl: getOptionalEnvVar('VITE_PUBLIC_SITE_URL'),
  // Root domain used for the included storefront URL: store-slug.example.com.
  // The matching wildcard (*.example.com) must be assigned to the Vercel project.
  storefrontRootDomain: getOptionalEnvVar('VITE_STOREFRONT_ROOT_DOMAIN'),
  // Optional comma-separated aliases for the platform itself (not stores).
  platformHostnames: getOptionalEnvVar('VITE_PLATFORM_HOSTNAMES'),
} as const;
