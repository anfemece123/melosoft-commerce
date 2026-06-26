import { PublicStoreLogo } from './PublicStoreLogo';
import { buildStorefrontTheme } from './storefrontTheme';

interface StorefrontLoaderBranding {
  storeName?: string | null;
  logoUrl?: string | null;
  themeMode?: 'light' | 'dark' | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  buttonRadius?: string | null;
}

interface StorefrontPageLoaderProps {
  branding?: StorefrontLoaderBranding | null;
  label?: string;
}

export function StorefrontPageLoader({
  branding,
  label = 'Preparando la experiencia...',
}: StorefrontPageLoaderProps) {
  const theme = buildStorefrontTheme({
    mode: branding?.themeMode,
    primaryColor: branding?.primaryColor,
    secondaryColor: branding?.secondaryColor,
    accentColor: branding?.accentColor,
    backgroundColor: branding?.backgroundColor,
    textColor: branding?.textColor,
    buttonRadius: branding?.buttonRadius,
  });

  const storeName = branding?.storeName?.trim() || 'Tu tienda';

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ backgroundColor: theme.background, color: theme.text, ...theme.cssVars }}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="animate-pulse">
          <PublicStoreLogo
            logoUrl={branding?.logoUrl ?? null}
            storeName={storeName}
            sizeClassName="h-24 w-24 sm:h-28 sm:w-28"
            fallbackColor={theme.primary}
            outerClassName="border"
            outerStyle={{
              borderColor: theme.border,
              backgroundColor: theme.surface,
              boxShadow: `0 14px 32px ${theme.shadow}`,
            }}
          />
        </div>

        <div className="mt-5 space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">{storeName}</h1>
          <p className="mx-auto max-w-xs text-sm leading-6" style={{ color: theme.mutedText }}>
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
