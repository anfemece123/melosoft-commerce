import { IMAGE_ASSET_PRESETS, type ImageAssetKind, type ImageAssetPreset } from './imageAssetPresets';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface LoadedImageFile {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

export function getImageAssetPreset(assetKind: ImageAssetKind): ImageAssetPreset {
  return IMAGE_ASSET_PRESETS[assetKind];
}

export async function loadImageFile(file: File): Promise<LoadedImageFile> {
  const dataUrl = await fileToDataUrl(file);
  const dimensions = await getImageDimensions(dataUrl);
  return {
    file,
    dataUrl,
    width: dimensions.width,
    height: dimensions.height,
  };
}

export async function validateImageFile(file: File, assetKind: ImageAssetKind): Promise<LoadedImageFile> {
  const preset = getImageAssetPreset(assetKind);

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Tipo de archivo no permitido. Usa JPG, PNG o WebP.');
  }

  if (file.size > preset.maxBytes) {
    throw new Error(`El archivo es demasiado grande. Máximo ${Math.round(preset.maxBytes / (1024 * 1024))} MB.`);
  }

  const loaded = await loadImageFile(file);
  if (loaded.width < preset.minWidth || loaded.height < preset.minHeight) {
    throw new Error(
      `La imagen es demasiado pequeña. Usa mínimo ${preset.minWidth}x${preset.minHeight}px.`
    );
  }

  return loaded;
}

export async function cropImageToFile(
  loaded: LoadedImageFile,
  crop: { x: number; y: number; width: number; height: number },
  output: { width: number; height: number },
  fileNameBase: string
): Promise<File> {
  const image = await loadHtmlImage(loaded.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar el editor de imagen.');

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

  const outputType = loaded.file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const outputExtension = outputType === 'image/png' ? 'png' : 'jpg';

  const blob = await new Promise<Blob | null>((resolve) => {
    if (outputType === 'image/png') {
      canvas.toBlob((result) => resolve(result), outputType);
      return;
    }

    canvas.toBlob((result) => resolve(result), outputType, 0.92);
  });

  if (!blob) throw new Error('No se pudo generar la imagen recortada.');

  return new File([blob], `${fileNameBase}.${outputExtension}`, { type: outputType });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
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
