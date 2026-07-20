let activeStorefrontHostnameStoreSlug: string | null = null;

export function setActiveStorefrontHostnameStore(storeSlug: string | null): void {
  activeStorefrontHostnameStoreSlug = storeSlug;
}

export function isUsingStorefrontHostname(storeSlug: string): boolean {
  return activeStorefrontHostnameStoreSlug === storeSlug;
}

export function buildStorefrontPath(storeSlug: string, suffix = ''): string {
  const normalizedSuffix = suffix && !suffix.startsWith('/') ? `/${suffix}` : suffix;
  if (isUsingStorefrontHostname(storeSlug)) return normalizedSuffix || '/';
  return `/s/${storeSlug}${normalizedSuffix}`;
}
