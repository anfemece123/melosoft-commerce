import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';

interface ProductVideoPlayerProps {
  videoUrl: string;
  mimeType: 'video/mp4' | 'video/webm';
  productName: string;
}

/**
 * Product videos are intentionally click-to-play. A muted, off-DOM decoder
 * extracts a real frame from the video for the poster so the product image is
 * never reused as a misleading placeholder.
 */
export function ProductVideoPlayer({
  videoUrl,
  mimeType,
  productName,
}: ProductVideoPlayerProps) {
  const posterUrl = useProductVideoPoster(videoUrl);

  return (
    <video
      controls
      playsInline
      preload="metadata"
      poster={posterUrl ?? undefined}
      className="h-full w-full object-cover"
      aria-label={`Video de ${productName}`}
    >
      <source src={videoUrl} type={mimeType} />
      Tu navegador no puede reproducir este video.
    </video>
  );
}

export function ProductVideoThumbnail({ videoUrl }: { videoUrl: string }) {
  const posterUrl = useProductVideoPoster(videoUrl);

  return posterUrl ? (
    <img src={posterUrl} alt="Fotograma del video" className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-gray-950" aria-hidden="true">
      <Film className="h-5 w-5 text-white/70" />
    </div>
  );
}

export function useProductVideoPoster(videoUrl: string): string | null {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const source = document.createElement('video');
    source.crossOrigin = 'anonymous';
    source.preload = 'metadata';
    source.muted = true;
    source.playsInline = true;

    const captureFrame = () => {
      if (cancelled || source.videoWidth <= 0 || source.videoHeight <= 0) return;
      const side = Math.min(source.videoWidth, source.videoHeight);
      const offsetX = (source.videoWidth - side) / 2;
      const offsetY = (source.videoHeight - side) / 2;
      const canvas = document.createElement('canvas');
      const posterSize = Math.min(720, side);
      canvas.width = posterSize;
      canvas.height = posterSize;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(source, offsetX, offsetY, side, side, 0, 0, posterSize, posterSize);
      try {
        const nextPoster = canvas.toDataURL('image/webp', 0.82);
        if (!cancelled) setPosterUrl(nextPoster);
      } catch {
        // A restrictive CDN CORS policy should not block playback. The native
        // player remains usable without a custom poster in that rare case.
      }
    };

    source.addEventListener('loadeddata', captureFrame, { once: true });
    source.addEventListener('seeked', captureFrame, { once: true });
    source.src = videoUrl;
    source.load();

    return () => {
      cancelled = true;
      source.removeAttribute('src');
      source.load();
    };
  }, [videoUrl]);

  return posterUrl;
}
