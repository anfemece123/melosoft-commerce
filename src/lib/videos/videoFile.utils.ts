export const PRODUCT_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const PRODUCT_VIDEO_MAX_DURATION_SECONDS = 15;
/** Output ceiling after the in-app crop/encode step. Source videos may use
 * another resolution; they are normalized before upload. */
export const PRODUCT_VIDEO_MAX_WIDTH = 1200;
export const PRODUCT_VIDEO_MAX_HEIGHT = 1200;
export const PRODUCT_VIDEO_ASPECT_RATIO = 1;
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
  return (PRODUCT_VIDEO_ALLOWED_TYPES as readonly string[]).some(
    (type) => value === type || value.startsWith(`${type};`),
  );
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

export interface VideoCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Finds the largest square crop that fits inside a source video. `focusX` and
 * `focusY` are normalized focal coordinates (0–1), so the editor can move the
 * crop without ever exposing pixels outside the source. `zoom` lets the owner
 * choose a tighter crop while retaining the same output aspect ratio. */
export function getVideoCropRect(
  width: number,
  height: number,
  focusX = 0.5,
  focusY = 0.5,
  zoom = 1,
): VideoCropRect {
  const safeFocusX = clamp(focusX, 0, 1);
  const safeFocusY = clamp(focusY, 0, 1);
  const safeZoom = clamp(zoom, 1, 3);
  const sourceAspect = width / height;

  if (sourceAspect > PRODUCT_VIDEO_ASPECT_RATIO) {
    const cropHeight = height / safeZoom;
    const cropWidth = cropHeight * PRODUCT_VIDEO_ASPECT_RATIO;
    return {
      x: (width - cropWidth) * safeFocusX,
      y: 0,
      width: cropWidth,
      height: cropHeight,
    };
  }

  const cropWidth = width / safeZoom;
  const cropHeight = cropWidth / PRODUCT_VIDEO_ASPECT_RATIO;
  return {
    x: 0,
    y: (height - cropHeight) * safeFocusY,
    width: cropWidth,
    height: cropHeight,
  };
}

export function getVideoOutputSize(crop: Pick<VideoCropRect, 'width' | 'height'>): { width: number; height: number } {
  const scale = Math.min(1, PRODUCT_VIDEO_MAX_WIDTH / crop.width, PRODUCT_VIDEO_MAX_HEIGHT / crop.height);
  return {
    width: Math.max(2, Math.round(crop.width * scale)),
    height: Math.max(2, Math.round(crop.height * scale)),
  };
}

/** Encodes the selected crop using browser-native MediaRecorder. This keeps
 * the editor dependency-free and produces a storage-safe WebM/MP4 file while
 * preserving the source audio track when the browser exposes one. */
export async function cropVideoToFile(
  loaded: LoadedProductVideo,
  crop: VideoCropRect,
  fileNameBase = 'product-video',
): Promise<LoadedProductVideo> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Este navegador no puede editar videos aquí. Prueba con Chrome, Edge o Safari actualizado.');
  }

  const output = getVideoOutputSize(crop);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = loaded.previewUrl;
  video.load();
  await waitForVideoReady(video);

  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar el editor de video.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const sourceVideo = video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const captureStream = sourceVideo.captureStream ?? sourceVideo.mozCaptureStream;
  const canvasCapture = canvas.captureStream?.bind(canvas);
  if (!captureStream || !canvasCapture) {
    throw new Error('Este navegador no puede editar videos aquí. Prueba con Chrome, Edge o Safari actualizado.');
  }

  const sourceStream = captureStream.call(sourceVideo);
  const outputStream = canvasCapture(30);
  sourceStream.getAudioTracks().forEach((track) => outputStream.addTrack(track));

  const mimeType = getSupportedVideoMimeType(loaded.file.type);
  if (!mimeType) {
    sourceStream.getTracks().forEach((track) => track.stop());
    outputStream.getTracks().forEach((track) => track.stop());
    throw new Error('Este navegador no tiene un formato de video compatible para guardar el recorte.');
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(outputStream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
    audioBitsPerSecond: 128_000,
  });

  let animationFrame = 0;
  let timeoutId: number | null = null;
  const stopTracks = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    video.pause();
    sourceStream.getTracks().forEach((track) => track.stop());
    outputStream.getTracks().forEach((track) => track.stop());
  };

  const blob = await new Promise<Blob>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // The recorder may already be transitioning to stopped.
        }
      }
      stopTracks();
      if (error) reject(error);
      else resolve(new Blob(chunks, { type: mimeType }));
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => finish(new Error('No se pudo generar el video recortado.'));
    recorder.onstop = () => finish();
    video.onerror = () => finish(new Error('No se pudo leer el video para recortarlo.'));
    video.onended = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };

    const drawFrame = () => {
      context.drawImage(
        video,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        output.width,
        output.height,
      );
      if (!video.ended && recorder.state !== 'inactive') {
        animationFrame = requestAnimationFrame(drawFrame);
      }
    };

    try {
      recorder.start(250);
      drawFrame();
      void video.play().catch(() => finish(new Error('No se pudo reproducir el video para recortarlo.')));
      timeoutId = window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, Math.ceil(loaded.durationSeconds * 1000) + 1000);
    } catch {
      finish(new Error('No se pudo iniciar el editor de video.'));
    }
  });

  if (blob.size <= 0 || blob.size > PRODUCT_VIDEO_MAX_BYTES) {
    throw new Error(`El video editado supera el peso máximo de ${formatVideoBytes(PRODUCT_VIDEO_MAX_BYTES)}.`);
  }

  const outputMimeType = blob.type || mimeType;
  // MediaRecorder often appends codec parameters to the MIME (for example
  // `video/webm;codecs=vp9,opus`). The upload contract intentionally stores
  // only the container MIME, so normalize it before creating the File.
  const normalizedMimeType = outputMimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
  const extension = normalizedMimeType === 'video/mp4' ? 'mp4' : 'webm';
  const file = new File([blob], `${fileNameBase.replace(/\.[^.]+$/, '') || 'product-video'}.${extension}`, {
    type: normalizedMimeType,
  });
  const previewUrl = URL.createObjectURL(file);

  return {
    file,
    previewUrl,
    durationSeconds: Number(Math.min(loaded.durationSeconds, PRODUCT_VIDEO_MAX_DURATION_SECONDS).toFixed(2)),
    width: output.width,
    height: output.height,
  };
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

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('No se pudo leer este archivo de video.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function getSupportedVideoMimeType(sourceMimeType: string): string | null {
  const candidates = sourceMimeType === 'video/mp4'
    ? ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
    : ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
