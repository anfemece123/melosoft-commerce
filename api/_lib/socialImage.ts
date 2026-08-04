import sharp from 'sharp';

export const SOCIAL_IMAGE_SIZE = 1200;
const LOGO_CONTENT_SIZE = 960;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 50_000_000;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 2;
const SUPPORTED_SOURCE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type FetchLike = typeof fetch;

function configuredSupabaseHost(): string | null {
  const raw = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function trustedSocialImageHosts(request: Request): Set<string> {
  const hosts = new Set([new URL(request.url).hostname.toLowerCase()]);
  const supabaseHost = configuredSupabaseHost();
  if (supabaseHost) hosts.add(supabaseHost);
  return hosts;
}

function assertTrustedImageUrl(rawUrl: string, trustedHosts: Set<string>): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Unsupported social image protocol.');
  }
  if (!trustedHosts.has(url.hostname.toLowerCase())) {
    throw new Error('Untrusted social image host.');
  }
  return url;
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) {
    throw new Error('Social image source is too large.');
  }
  if (!response.body) throw new Error('Social image source has no body.');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error('Social image source is too large.');
    }
    chunks.push(value);
  }

  if (total === 0) throw new Error('Social image source is empty.');
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function fetchSocialImage(
  rawUrl: string,
  trustedHosts: Set<string>,
  fetchImpl: FetchLike = fetch,
): Promise<Uint8Array> {
  let url = assertTrustedImageUrl(rawUrl, trustedHosts);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new Error('Social image redirect could not be followed.');
      }
      url = assertTrustedImageUrl(new URL(location, url).toString(), trustedHosts);
      continue;
    }

    if (!response.ok) throw new Error(`Social image source returned HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!SUPPORTED_SOURCE_TYPES.has(contentType)) {
      throw new Error(`Unsupported social image content type: ${contentType || 'unknown'}.`);
    }
    return readLimitedBody(response);
  }

  throw new Error('Social image redirect limit exceeded.');
}

export async function renderSquareLogoPng(source: Uint8Array): Promise<Uint8Array> {
  const padding = (SOCIAL_IMAGE_SIZE - LOGO_CONTENT_SIZE) / 2;
  const output = await sharp(source, {
    failOn: 'error',
    limitInputPixels: MAX_SOURCE_PIXELS,
  })
    .autoOrient()
    .resize(LOGO_CONTENT_SIZE, LOGO_CONTENT_SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return new Uint8Array(output);
}

export async function renderNeutralFallbackPng(): Promise<Uint8Array> {
  const output = await sharp({
    create: {
      width: SOCIAL_IMAGE_SIZE,
      height: SOCIAL_IMAGE_SIZE,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return new Uint8Array(output);
}
