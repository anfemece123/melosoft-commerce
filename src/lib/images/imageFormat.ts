export function isLikelyPngAsset(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url, 'https://local.melosoft');
    const pathname = parsed.pathname.toLowerCase();
    return pathname.endsWith('.png');
  } catch {
    return url.toLowerCase().split('?')[0].endsWith('.png');
  }
}
