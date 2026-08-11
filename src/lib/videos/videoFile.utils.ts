export const PRODUCT_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const PRODUCT_VIDEO_MAX_DURATION_SECONDS = 15;
export const PRODUCT_VIDEO_MAX_WIDTH = 1920;
export const PRODUCT_VIDEO_MAX_HEIGHT = 1080;
export const PRODUCT_VIDEO_ALLOWED_TYPES = ['video/mp4', 'video/webm'] as const;

export type ProductVideoMimeType = (typeof PRODUCT_VIDEO_ALLOWED_TYPES)[number];

export interface LoadedProductVideo {
  file: File;
  previewUrl: string;
  durationSeconds: number;
  width: number;
  height: number;
}

export function isProductVideoMimeType(value: string): value is ProductVideoMimeType {
  return (PRODUCT_VIDEO_ALLOWED_TYPES as readonly string[]).includes(value);
}

export function formatVideoDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatVideoBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function validateProductVideoFile(file: File): Promise<LoadedProductVideo> {
  if (!isProductVideoMimeType(file.type)) {
    throw new Error('Usa un video MP4 o WebM. Los videos de iPhone en MOV deben exportarse como MP4.');
  }
  if (file.size <= 0 || file.size > PRODUCT_VIDEO_MAX_BYTES) {
    throw new Error(`El video debe pesar máximo ${formatVideoBytes(PRODUCT_VIDEO_MAX_BYTES)}.`);
  }

  const previewUrl = URL.createObjectURL(file);
  try {
    const metadata = await readVideoMetadata(previewUrl);
    if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) {
      throw new Error('No se pudo leer la duración del video.');
    }
    if (metadata.duration > PRODUCT_VIDEO_MAX_DURATION_SECONDS + 0.05) {
      throw new Error(`El video debe durar máximo ${PRODUCT_VIDEO_MAX_DURATION_SECONDS} segundos.`);
    }
    if (metadata.width <= 0 || metadata.height <= 0) {
      throw new Error('No se pudieron leer las dimensiones del video.');
    }
    if (metadata.width > PRODUCT_VIDEO_MAX_WIDTH || metadata.height > PRODUCT_VIDEO_MAX_HEIGHT) {
      throw new Error('El video puede tener hasta 1920×1080 píxeles.');
    }

    return {
      file,
      previewUrl,
      durationSeconds: Number(metadata.duration.toFixed(2)),
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

export function disposeLoadedProductVideo(video: LoadedProductVideo | null | undefined): void {
  if (video?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(video.previewUrl);
}

function readVideoMetadata(src: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve({
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    });
    video.onerror = () => reject(new Error('No se pudo leer este archivo de video.'));
    video.src = src;
    video.load();
  });
}
