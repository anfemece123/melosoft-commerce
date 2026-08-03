import { IMAGE_ASSET_PRESETS, type ImageAssetKind, type ImageAssetPreset } from './imageAssetPresets';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_SOURCE_PIXELS = 50_000_000;
const OUTPUT_MIME_TYPE = 'image/webp';

export interface LoadedImageFile {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  qualityWarning: string | null;
}

export function getImageAssetPreset(assetKind: ImageAssetKind): ImageAssetPreset {
  return IMAGE_ASSET_PRESETS[assetKind];
}

export function assertImageReadyForUpload(file: File, assetKind: ImageAssetKind): void {
  const preset = getImageAssetPreset(assetKind);
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('La imagen procesada tiene un formato no permitido.');
  }
  if (file.size > preset.maxOutputBytes) {
    throw new Error(
      `La imagen supera el peso optimizado de ${Math.round(preset.maxOutputBytes / 1024)} KB. Vuelve a recortarla antes de subirla.`,
    );
  }
}

export async function loadImageFile(file: File): Promise<LoadedImageFile> {
  const previewUrl = URL.createObjectURL(file);
  try {
    const dimensions = await getImageDimensions(previewUrl);
    return {
      id: crypto.randomUUID(),
      file,
      previewUrl,
      width: dimensions.width,
      height: dimensions.height,
      qualityWarning: null,
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

export function disposeLoadedImageFile(loaded: LoadedImageFile | null | undefined): void {
  if (loaded?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(loaded.previewUrl);
}

export function getLargestCropSize(
  width: number,
  height: number,
  aspectRatio: number,
): { width: number; height: number } {
  if (width / height > aspectRatio) {
    return { width: height * aspectRatio, height };
  }
  return { width, height: width / aspectRatio };
}

export function getAdaptiveOutputSize(
  crop: { width: number; height: number },
  preset: ImageAssetPreset,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    preset.recommendedWidth / crop.width,
    preset.recommendedHeight / crop.height,
  );
  return {
    width: Math.max(1, Math.round(crop.width * scale)),
    height: Math.max(1, Math.round(crop.height * scale)),
  };
}

export async function validateImageFile(file: File, assetKind: ImageAssetKind): Promise<LoadedImageFile> {
  const preset = getImageAssetPreset(assetKind);

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Tipo de archivo no permitido. Usa JPG, PNG, WebP o AVIF.');
  }

  if (file.size > preset.maxBytes) {
    throw new Error(`El archivo es demasiado grande. Máximo ${Math.round(preset.maxBytes / (1024 * 1024))} MB.`);
  }

  const loaded = await loadImageFile(file);
  if (loaded.width * loaded.height > MAX_SOURCE_PIXELS) {
    disposeLoadedImageFile(loaded);
    throw new Error('La imagen tiene una resolución excesiva. Usa una imagen de hasta 50 megapíxeles.');
  }

  const largestCrop = getLargestCropSize(loaded.width, loaded.height, preset.aspectRatio);
  if (
    largestCrop.width < preset.minimumCropWidth
    || largestCrop.height < preset.minimumCropHeight
  ) {
    disposeLoadedImageFile(loaded);
    throw new Error(
      `La imagen es demasiado pequeña para este espacio. El recorte aprovechable debe ser de al menos ${preset.minimumCropWidth}x${preset.minimumCropHeight}px.`
    );
  }

  return {
    ...loaded,
    qualityWarning: largestCrop.width < preset.minWidth || largestCrop.height < preset.minHeight
      ? `La imagen se puede usar, aunque puede verse menos nítida que una de ${preset.minWidth}x${preset.minHeight}px o más.`
      : null,
  };
}

export async function cropImageToFile(
  loaded: LoadedImageFile,
  crop: { x: number; y: number; width: number; height: number },
  output: { width: number; height: number },
  fileNameBase: string,
  maxOutputBytes: number,
): Promise<File> {
  const image = await loadHtmlImage(loaded.previewUrl);
  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar el editor de imagen.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    output.width,
    output.height
  );

  const blob = await encodeCanvasWithinBudget(canvas, maxOutputBytes);
  const outputType = blob.type || OUTPUT_MIME_TYPE;
  const outputExtension = outputType === 'image/webp' ? 'webp' : outputType === 'image/png' ? 'png' : 'jpg';

  return new File([blob], `${fileNameBase}.${outputExtension}`, { type: outputType });
}

async function encodeCanvasWithinBudget(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  let workingCanvas = canvas;
  let smallest: Blob | null = null;

  for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
    for (const quality of [0.88, 0.8, 0.72, 0.64, 0.56]) {
      const blob = await canvasToBlob(workingCanvas, OUTPUT_MIME_TYPE, quality);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= maxBytes) return blob;
    }

    if (!smallest || workingCanvas.width <= 320 || workingCanvas.height <= 180) break;
    const budgetScale = Math.sqrt(maxBytes / smallest.size) * 0.95;
    const scale = Math.min(0.9, Math.max(0.7, budgetScale));
    workingCanvas = resizeCanvas(workingCanvas, scale);
  }

  if (!smallest || smallest.size > maxBytes) {
    throw new Error('No se pudo reducir la imagen al peso seguro. Prueba con un recorte un poco más amplio.');
  }
  return smallest;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen optimizada.'));
    }, type, quality);
  });
}

function resizeCanvas(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const resized = document.createElement('canvas');
  resized.width = Math.max(1, Math.round(source.width * scale));
  resized.height = Math.max(1, Math.round(source.height * scale));
  const context = resized.getContext('2d');
  if (!context) throw new Error('No se pudo optimizar la imagen.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, resized.width, resized.height);
  return resized;
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    image.src = src;
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
    image.src = src;
  });
}
