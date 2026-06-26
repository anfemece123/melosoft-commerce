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

export const env = {
  supabaseUrl: getEnvVar('VITE_SUPABASE_URL'),
  supabaseAnonKey: getEnvVar('VITE_SUPABASE_ANON_KEY'),
} as const;
