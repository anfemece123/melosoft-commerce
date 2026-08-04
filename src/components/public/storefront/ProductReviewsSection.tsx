import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, MessageCircleReply, Star } from 'lucide-react';
import type { PublicProductPage } from '@/types/common.types';
import type { PublicProductReview } from '@/features/reviews/reviews.types';
import { reviewsService } from '@/features/reviews/reviewsService';
import type { StorefrontTheme } from './storefrontTheme';
import { StorefrontRatingStars } from './StorefrontRatingStars';

function ReviewStars({ rating, theme }: { rating: number; theme: StorefrontTheme }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className={`h-4 w-4 ${index < rating ? 'fill-amber-400 text-amber-400' : ''}`} style={index < rating ? undefined : { color: theme.border }} />
      ))}
    </div>
  );
}

export function ProductReviewsSection({ product, theme }: { product: PublicProductPage; theme: StorefrontTheme }) {
  const [reviews, setReviews] = useState<PublicProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState(0);
  const [sort, setSort] = useState<'recent' | 'high' | 'low'>('recent');
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    if (!product.reviewsEnabled || !product.showProductReviews) return;
    let active = true;
    void reviewsService.getPublicProductReviews(product.productId)
      .then((items) => { if (active) setReviews(items); })
      .catch(() => { if (active) setReviews([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [product.productId, product.reviewsEnabled, product.showProductReviews]);

  const filtered = useMemo(() => {
    const result = ratingFilter ? reviews.filter((review) => review.rating === ratingFilter) : [...reviews];
    if (sort === 'high') result.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));
    if (sort === 'low') result.sort((a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt));
    return result;
  }, [reviews, ratingFilter, sort]);

  if (!product.reviewsEnabled || !product.showProductReviews) return null;

  return (
    <section id="opiniones" className="mt-16 border-t pt-10" style={{ borderColor: theme.border }}>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: theme.primary }}>Opiniones verificadas</p>
          <h2 className="mt-2 text-2xl font-semibold" style={{ color: theme.text }}>Lo que dicen los clientes</h2>
          {product.reviewCount > 0 ? (
            <div className="mt-6">
              <div className="flex items-end gap-3"><span className="text-5xl font-semibold tracking-tight" style={{ color: theme.text }}>{product.reviewAverage.toFixed(1)}</span><span className="pb-1 text-sm" style={{ color: theme.mutedText }}>de 5</span></div>
              <div className="mt-2"><StorefrontRatingStars theme={theme} rating={product.reviewAverage} count={product.reviewCount} size="md" /></div>
              <div className="mt-6 space-y-2.5">
                {[5, 4, 3, 2, 1].map((value) => {
                  const count = product.reviewDistribution[value as 1 | 2 | 3 | 4 | 5] ?? 0;
                  const percentage = product.reviewCount ? (count / product.reviewCount) * 100 : 0;
                  return (
                    <button key={value} type="button" onClick={() => setRatingFilter((current) => current === value ? 0 : value)} className="grid w-full grid-cols-[24px_1fr_26px] items-center gap-2 text-left text-xs" aria-pressed={ratingFilter === value}>
                      <span style={{ color: ratingFilter === value ? theme.primary : theme.mutedText }}>{value}</span>
                      <span className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: theme.surfaceAlt }}><span className="block h-full rounded-full bg-amber-400 transition-all" style={{ width: `${percentage}%` }} /></span>
                      <span className="text-right" style={{ color: theme.mutedText }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6" style={{ color: theme.mutedText }}>Este producto todavía no tiene reseñas. Solo los clientes con pedidos entregados pueden compartir su experiencia.</p>
          )}
        </div>

        <div>
          {product.reviewCount > 0 && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm" style={{ color: theme.mutedText }}>{ratingFilter ? `${filtered.length} de ${ratingFilter} estrellas` : `${product.reviewCount} calificaciones verificadas`}</p>
              <label className="relative"><span className="sr-only">Ordenar opiniones</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="appearance-none rounded-lg border bg-transparent py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2" style={{ borderColor: theme.border, color: theme.text }}><option value="recent">Más recientes</option><option value="high">Mejor calificadas</option><option value="low">Menor calificación</option></select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4" style={{ color: theme.mutedText }} /></label>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">{[0, 1].map((key) => <div key={key} className="h-36 animate-pulse rounded-xl" style={{ backgroundColor: theme.surfaceAlt }} />)}</div>
          ) : filtered.length === 0 && product.reviewCount > 0 ? (
            <div className="rounded-xl border p-6 text-center text-sm" style={{ borderColor: theme.border, color: theme.mutedText }}>No hay comentarios públicos con este filtro. Algunas calificaciones pueden no incluir comentario.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: theme.border }}>
              {filtered.slice(0, visibleCount).map((review) => (
                <article key={review.id} className="py-6 first:pt-0" style={{ borderColor: theme.border }}>
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><ReviewStars rating={review.rating} theme={theme} /><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm font-semibold" style={{ color: theme.text }}>{review.customerDisplayName}</span><span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />Compra verificada</span></div></div><time className="text-xs" style={{ color: theme.mutedText }}>{new Date(review.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</time></div>
                  {review.title && <h3 className="mt-4 text-sm font-semibold" style={{ color: theme.text }}>{review.title}</h3>}
                  {review.comment && <p className="mt-2 whitespace-pre-line text-sm leading-7" style={{ color: theme.mutedText }}>{review.comment}</p>}
                  {review.images.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{review.images.map((image) => <a key={image.id} href={image.imageUrl} target="_blank" rel="noreferrer" className="h-20 w-20 overflow-hidden rounded-lg border" style={{ borderColor: theme.border }}><img src={image.imageUrl} alt="Foto compartida por el cliente" className="h-full w-full object-cover" /></a>)}</div>}
                  {review.merchantReply && <div className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: theme.surfaceAlt }}><p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.text }}><MessageCircleReply className="h-3.5 w-3.5" />Respuesta de la empresa</p><p className="mt-1.5 whitespace-pre-line text-sm leading-6" style={{ color: theme.mutedText }}>{review.merchantReply}</p></div>}
                </article>
              ))}
            </div>
          )}
          {filtered.length > visibleCount && <button type="button" onClick={() => setVisibleCount((count) => count + 6)} className="mt-5 rounded-lg border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: theme.border, color: theme.text }}>Ver más opiniones</button>}
        </div>
      </div>
    </section>
  );
}
