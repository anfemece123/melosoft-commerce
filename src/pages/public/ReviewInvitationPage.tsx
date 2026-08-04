import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Camera, CheckCircle2, ImagePlus, Loader2, Package, ShieldCheck, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { reviewsService } from '@/features/reviews/reviewsService';
import type { PublicReviewInvitation, SubmitProductReviewInput } from '@/features/reviews/reviews.types';
import {
  disposeLoadedImageFile,
  optimizeImageToFile,
  validateImageFile,
} from '@/lib/images/imageFile.utils';
import { getImageAssetPreset } from '@/lib/images/imageFile.utils';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

interface ReviewDraft {
  rating: number;
  title: string;
  comment: string;
  photos: PendingPhoto[];
}

const EMPTY_DRAFT: ReviewDraft = { rating: 0, title: '', comment: '', photos: [] };

function RatingInput({ value, onChange, productName }: { value: number; onChange: (rating: number) => void; productName: string }) {
  const [hovered, setHovered] = useState(0);
  const visible = hovered || value;
  const labels = ['Muy mala', 'Mala', 'Aceptable', 'Buena', 'Excelente'];
  return (
    <fieldset>
      <legend className="sr-only">Calificación para {productName}</legend>
      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
        {Array.from({ length: 5 }, (_, index) => index + 1).map((rating) => (
          <button
            key={rating}
            type="button"
            onMouseEnter={() => setHovered(rating)}
            onFocus={() => setHovered(rating)}
            onBlur={() => setHovered(0)}
            onClick={() => onChange(rating)}
            className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={`${rating} de 5: ${labels[rating - 1]}`}
            aria-pressed={value === rating}
          >
            <Star className={`h-8 w-8 ${rating <= visible ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
          </button>
        ))}
        {value > 0 && <span className="ml-2 text-sm font-medium text-gray-600">{labels[value - 1]}</span>}
      </div>
    </fieldset>
  );
}

function StateCard({ invitation }: { invitation: PublicReviewInvitation }) {
  const content = {
    submitted: ['Gracias por compartir tu experiencia', 'Tu reseña ya fue recibida correctamente.'],
    expired: ['Este enlace venció', 'Por seguridad, las invitaciones para reseñar tienen una vigencia limitada.'],
    disabled: ['Las reseñas no están disponibles', 'Esta empresa no está recibiendo reseñas en este momento.'],
    unavailable: ['Invitación no disponible', 'El pedido o la empresa ya no están disponibles para recibir una reseña.'],
    invalid: ['Enlace no válido', 'Revisa que hayas abierto el enlace completo que recibiste con tu pedido.'],
    ready: ['', ''],
  }[invitation.state];
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {invitation.logoUrl ? (
          <img src={invitation.logoUrl} alt={invitation.storeName ?? 'Empresa'} className="mx-auto mb-5 h-16 w-16 rounded-xl border border-gray-100 object-contain" />
        ) : (
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><ShieldCheck className="h-7 w-7" /></div>
        )}
        <h1 className="text-xl font-bold text-gray-900">{content[0]}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">{content[1]}</p>
        {invitation.storeSlug && (
          <Link to={buildStorefrontPath(invitation.storeSlug)} className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Visitar {invitation.storeName}
          </Link>
        )}
      </div>
    </div>
  );
}

export function ReviewInvitationPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [invitation, setInvitation] = useState<PublicReviewInvitation | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photoBusyProductId, setPhotoBusyProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    void reviewsService.getPublicInvitation(token)
      .then((data) => {
        if (!active) return;
        setInvitation(data);
        if (data.state === 'ready') {
          setDrafts(Object.fromEntries(data.items.map((item) => [item.productId, { ...EMPTY_DRAFT, photos: [] }])));
        }
      })
      .catch(() => { if (active) setError('No pudimos abrir esta invitación. Intenta de nuevo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  function updateDraft(productId: string, values: Partial<ReviewDraft>) {
    setDrafts((current) => ({ ...current, [productId]: { ...(current[productId] ?? EMPTY_DRAFT), ...values } }));
  }

  async function addPhoto(productId: string, file: File | undefined) {
    if (!file) return;
    const current = drafts[productId] ?? EMPTY_DRAFT;
    if (current.photos.length >= 3) return;
    setError(null);
    setPhotoBusyProductId(productId);
    try {
      const loaded = await validateImageFile(file, 'review_image');
      try {
        const preset = getImageAssetPreset('review_image');
        const optimized = await optimizeImageToFile(loaded, `resena-${crypto.randomUUID()}`, preset.maxOutputBytes, 1600);
        const photo = { id: crypto.randomUUID(), file: optimized, previewUrl: URL.createObjectURL(optimized) };
        updateDraft(productId, { photos: [...current.photos, photo] });
      } finally {
        disposeLoadedImageFile(loaded);
      }
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'No pudimos procesar esa foto.');
    } finally {
      setPhotoBusyProductId(null);
    }
  }

  function removePhoto(productId: string, photoId: string) {
    const current = drafts[productId] ?? EMPTY_DRAFT;
    const removed = current.photos.find((photo) => photo.id === photoId);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    updateDraft(productId, { photos: current.photos.filter((photo) => photo.id !== photoId) });
  }

  async function submit() {
    if (!invitation) return;
    const selected: SubmitProductReviewInput[] = invitation.items.flatMap((item) => {
      const draft = drafts[item.productId];
      return draft?.rating ? [{
        productId: item.productId,
        orderItemId: item.orderItemId,
        rating: draft.rating,
        title: draft.title,
        comment: draft.comment,
      }] : [];
    });
    if (selected.length === 0) {
      setError('Califica al menos un producto para enviar tu reseña.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const references = await reviewsService.submitVerifiedReviews(token, selected);
      let failedPhotos = 0;
      for (const reference of references) {
        const photos = drafts[reference.productId]?.photos ?? [];
        for (let index = 0; index < photos.length; index += 1) {
          try {
            await reviewsService.uploadReviewImage(token, reference.reviewId, photos[index].file, index);
          } catch {
            failedPhotos += 1;
          }
        }
      }
      if (failedPhotos > 0) setError(`La reseña quedó guardada, pero ${failedPhotos === 1 ? 'una foto no pudo subirse' : `${failedPhotos} fotos no pudieron subirse`}.`);
      setSuccess(true);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '';
      if (message.includes('REVIEW_ALREADY_SUBMITTED')) setSuccess(true);
      else setError('No pudimos enviar tu reseña. Revisa la información e intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-50"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>;
  if (!invitation) return <StateCard invitation={{ state: 'invalid', storeId: null, storeSlug: null, storeName: null, logoUrl: null, customerName: null, orderNumber: null, expiresAt: null, showReviewPhotos: false, items: [] }} />;
  if (invitation.state !== 'ready') return <StateCard invitation={invitation} />;
  if (success) return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <h1 className="mt-5 text-2xl font-bold text-gray-900">Gracias por tu opinión</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">Tu experiencia fue enviada a {invitation.storeName}. Las reseñas ayudan a otras personas a comprar con más confianza.</p>
        {error && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}
        {invitation.storeSlug && <Link to={buildStorefrontPath(invitation.storeSlug)} className="mt-6 inline-block text-sm font-semibold text-indigo-600">Volver a la tienda</Link>}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 text-center">
          {invitation.logoUrl ? <img src={invitation.logoUrl} alt={invitation.storeName ?? ''} className="mx-auto mb-4 h-16 w-16 rounded-xl border border-gray-200 bg-white object-contain" /> : null}
          <p className="text-sm font-semibold text-indigo-600">Compra verificada · Pedido #{invitation.orderNumber}</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">¿Cómo fue tu experiencia?</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">Hola, {invitation.customerName}. Califica los productos que quieras; puedes omitir los demás.</p>
        </header>

        <div className="space-y-4">
          {invitation.items.map((item) => {
            const draft = drafts[item.productId] ?? EMPTY_DRAFT;
            return (
              <section key={item.productId} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-gray-300" />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-gray-900">{item.productName}</h2>
                    {item.variantLabel && <p className="mt-0.5 text-xs text-gray-500">{item.variantLabel}</p>}
                  </div>
                </div>
                <div className="mt-5"><RatingInput value={draft.rating} onChange={(rating) => updateDraft(item.productId, { rating })} productName={item.productName} /></div>
                {draft.rating > 0 && (
                  <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
                    <Input label="Título (opcional)" value={draft.title} maxLength={120} placeholder="Resume tu experiencia" onChange={(event) => updateDraft(item.productId, { title: event.target.value })} />
                    <Textarea label="Cuéntanos un poco más (opcional)" value={draft.comment} maxLength={2000} rows={4} placeholder="¿Qué te gustó? ¿Qué podría mejorar?" onChange={(event) => updateDraft(item.productId, { comment: event.target.value })} />
                    {invitation.showReviewPhotos && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Fotos (opcional)</p>
                        <p className="mt-1 text-xs text-gray-500">Hasta 3 fotos. Las optimizamos antes de guardarlas.</p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {draft.photos.map((photo) => (
                            <div key={photo.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-gray-200">
                              <img src={photo.previewUrl} alt="Foto para la reseña" className="h-full w-full object-cover" />
                              <button type="button" onClick={() => removePhoto(item.productId, photo.id)} className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white" aria-label="Quitar foto"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ))}
                          {draft.photos.length < 3 && (
                            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600">
                              {photoBusyProductId === item.productId ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                              <span className="mt-1 text-[11px]">Agregar</span>
                              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={photoBusyProductId !== null} onChange={(event) => { void addPhoto(item.productId, event.target.files?.[0]); event.currentTarget.value = ''; }} />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {invitation.items.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center"><Camera className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 text-sm text-gray-500">Este pedido no tiene productos disponibles para reseñar.</p></div>
        ) : (
          <div className="sticky bottom-0 mt-6 border-t border-gray-200 bg-gray-50/95 py-4 backdrop-blur">
            {error && <p role="alert" className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <Button size="lg" className="w-full" isLoading={submitting} disabled={photoBusyProductId !== null} onClick={() => void submit()}>
              Enviar reseña
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-gray-500"><ShieldCheck className="h-3.5 w-3.5" />Solo pueden reseñar clientes con un pedido entregado.</p>
          </div>
        )}
      </div>
    </main>
  );
}
