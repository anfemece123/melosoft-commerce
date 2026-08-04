import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Check, ChevronLeft, ChevronRight, Eye, EyeOff, MessageSquareReply,
  Search, Settings2, ShieldAlert, Star, Trash2, Verified,
} from 'lucide-react';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { SwitchField } from '@/components/ui/SwitchField';
import { Textarea } from '@/components/ui/Textarea';
import { useAppSelector } from '@/app/hooks';
import { selectIsPlatformAdmin } from '@/features/auth/auth.selectors';
import { selectMyMemberships } from '@/features/stores/stores.selectors';
import { reviewsService } from '@/features/reviews/reviewsService';
import type {
  AdminProductReview,
  ReviewDashboard,
  ReviewPublicationStatus,
  StoreReviewSettings,
} from '@/features/reviews/reviews.types';
import { notify } from '@/lib/notifications';
import { cn } from '@/utils/cn';

const PAGE_SIZE = 20;
const EMPTY_DASHBOARD: ReviewDashboard = {
  total: 0, average: 0, published: 0, pending: 0, hidden: 0, removed: 0, withReply: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  bestProducts: [], attentionProducts: [],
};

type StatusFilter = ReviewPublicationStatus | 'all';

function RatingStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className={cn(size === 'md' ? 'h-5 w-5' : 'h-4 w-4', index < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200')} />
      ))}
    </div>
  );
}

function ReviewStatusBadge({ review }: { review: AdminProductReview }) {
  if (review.publicationStatus === 'published') return <Badge variant="success">Publicada</Badge>;
  if (review.publicationStatus === 'hidden') return <Badge variant="neutral">Oculta</Badge>;
  if (review.publicationStatus === 'removed') return <Badge variant="danger">Excluida</Badge>;
  return <Badge variant={review.moderationStatus === 'flagged' ? 'warning' : 'info'}>{review.moderationStatus === 'flagged' ? 'Revisar contenido' : 'Pendiente'}</Badge>;
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) {
  return (
    <Card><CardBody className="p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{value}</p><p className="mt-1 text-xs text-gray-400">{detail}</p></div><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">{icon}</div></div></CardBody></Card>
  );
}

interface ReviewActionDialogProps {
  review: AdminProductReview | null;
  kind: 'hide' | 'remove';
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function ReviewActionDialog({ review, kind, busy, onClose, onConfirm }: ReviewActionDialogProps) {
  const [reason, setReason] = useState('');
  if (!review) return null;
  const removing = kind === 'remove';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', removing ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600')}>
          {removing ? <ShieldAlert className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">{removing ? 'Excluir reseña por incumplimiento' : 'Ocultar reseña de la tienda'}</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          {removing
            ? 'Úsalo únicamente para fraude, spam, contenido ofensivo o datos personales. La calificación dejará de contar.'
            : 'El comentario dejará de mostrarse, pero su calificación seguirá contando en el promedio. Podrás restaurarlo después.'}
        </p>
        <Textarea className="mt-4" label="Motivo interno" value={reason} maxLength={500} rows={3} placeholder={removing ? 'Ej.: contiene información personal…' : 'Ej.: solicitado por el cliente…'} onChange={(event) => setReason(event.target.value)} />
        <div className="mt-5 flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button variant={removing ? 'danger' : 'primary'} isLoading={busy} disabled={reason.trim().length < 3} onClick={() => onConfirm(reason)}>{removing ? 'Excluir' : 'Ocultar'}</Button></div>
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  busy,
  onPublish,
  onHide,
  onRemove,
  onReply,
  canManage,
}: {
  review: AdminProductReview;
  busy: boolean;
  onPublish: () => void;
  onHide: () => void;
  onRemove: () => void;
  onReply: (body: string) => Promise<void>;
  canManage: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState(review.reply ?? '');
  const [replyBusy, setReplyBusy] = useState(false);

  async function saveReply() {
    if (!reply.trim()) return;
    setReplyBusy(true);
    try {
      await onReply(reply);
      setReplyOpen(false);
    } catch {
      notify.error('No pudimos guardar la respuesta.');
    } finally {
      setReplyBusy(false);
    }
  }

  return (
    <Card className={cn(review.moderationStatus === 'flagged' && 'border-amber-200')}>
      <CardBody className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
              {review.productImageUrl ? <img src={review.productImageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Star className="h-5 w-5 text-gray-300" /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold text-gray-900">{review.productName}</p><ReviewStatusBadge review={review} />{review.moderationStatus === 'flagged' && <Badge variant="warning">Posible enlace o dato de contacto</Badge>}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1"><RatingStars rating={review.rating} /><span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><Verified className="h-3.5 w-3.5" />Compra verificada</span></div>
              {review.title && <h3 className="mt-3 text-sm font-semibold text-gray-900">{review.title}</h3>}
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">{review.comment || <span className="italic text-gray-400">El cliente dejó únicamente su calificación.</span>}</p>
              {review.images.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{review.images.map((image) => <a key={image.id} href={image.imageUrl} target="_blank" rel="noreferrer" className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200"><img src={image.imageUrl} alt="Foto de la reseña" className="h-full w-full object-cover" /></a>)}</div>}
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400"><span>{review.customerDisplayName}</span><span>{new Date(review.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>{review.orderNumber && <span>Pedido #{review.orderNumber}</span>}</div>
              {review.hiddenReason && review.publicationStatus !== 'published' && <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500"><strong>Motivo interno:</strong> {review.hiddenReason}</p>}
              {review.reply && !replyOpen && <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3"><p className="text-xs font-semibold text-indigo-700">Respuesta de la empresa</p><p className="mt-1 whitespace-pre-line text-sm text-gray-700">{review.reply}</p></div>}
              {replyOpen && <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3"><Textarea label="Respuesta pública" value={reply} maxLength={1200} rows={3} placeholder="Agradece, aclara o explica cómo resolverás la situación…" onChange={(event) => setReply(event.target.value)} /><div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" disabled={replyBusy} onClick={() => setReplyOpen(false)}>Cancelar</Button><Button size="sm" isLoading={replyBusy} disabled={!reply.trim()} onClick={() => void saveReply()}>Guardar respuesta</Button></div></div>}
            </div>
          </div>
          {canManage && <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[220px] lg:justify-end">
            {review.publicationStatus !== 'published' && review.publicationStatus !== 'removed' && <Button size="sm" variant="outline" disabled={busy} leftIcon={<Eye className="h-4 w-4" />} onClick={onPublish}>Publicar</Button>}
            {review.publicationStatus === 'hidden' && <Button size="sm" variant="outline" disabled={busy} leftIcon={<Eye className="h-4 w-4" />} onClick={onPublish}>Restaurar</Button>}
            {review.publicationStatus === 'published' && <Button size="sm" variant="outline" disabled={busy} leftIcon={<EyeOff className="h-4 w-4" />} onClick={onHide}>Ocultar</Button>}
            {review.publicationStatus !== 'removed' && <Button size="sm" variant="ghost" disabled={busy} leftIcon={<MessageSquareReply className="h-4 w-4" />} onClick={() => setReplyOpen((open) => !open)}>{review.reply ? 'Editar respuesta' : 'Responder'}</Button>}
            {review.publicationStatus !== 'removed' && <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy} leftIcon={<Trash2 className="h-4 w-4" />} onClick={onRemove}>Reportar</Button>}
          </div>}
        </div>
      </CardBody>
    </Card>
  );
}

export function ReviewsPage() {
  const { storeId = '' } = useParams<{ storeId: string }>();
  const memberships = useAppSelector(selectMyMemberships);
  const isPlatformAdmin = useAppSelector(selectIsPlatformAdmin);
  const role = memberships.find((membership) => membership.storeId === storeId && membership.status === 'active')?.role;
  const canConfigure = isPlatformAdmin || role === 'owner' || role === 'admin';
  const canManage = canConfigure || role === 'staff';

  const [settings, setSettings] = useState<StoreReviewSettings | null>(null);
  const [draftSettings, setDraftSettings] = useState<StoreReviewSettings | null>(null);
  const [dashboard, setDashboard] = useState<ReviewDashboard>(EMPTY_DASHBOARD);
  const [reviews, setReviews] = useState<AdminProductReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [rating, setRating] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [actionReview, setActionReview] = useState<AdminProductReview | null>(null);
  const [actionKind, setActionKind] = useState<'hide' | 'remove'>('hide');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadOverview = useCallback(async () => {
    const [loadedSettings, loadedDashboard] = await Promise.all([
      reviewsService.getSettings(storeId), reviewsService.getDashboard(storeId),
    ]);
    setSettings(loadedSettings);
    setDraftSettings(loadedSettings);
    setDashboard(loadedDashboard);
  }, [storeId]);

  const loadReviews = useCallback(async () => {
    await Promise.resolve();
    setListLoading(true);
    try {
      const result = await reviewsService.getAdminReviews(storeId, {
        status, rating: rating ? Number(rating) : null, search: debouncedSearch, page, pageSize: PAGE_SIZE,
      });
      setReviews(result.items);
      setTotal(result.total);
    } finally {
      setListLoading(false);
    }
  }, [storeId, status, rating, debouncedSearch, page]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    async function bootstrap() {
      await Promise.resolve();
      try {
        await Promise.all([loadOverview(), loadReviews()]);
      } catch {
        if (active) notify.error('No pudimos cargar el módulo de reseñas.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void bootstrap();
    return () => { active = false; };
  }, [storeId, loadOverview, loadReviews]);

  async function refreshAfterAction() {
    await Promise.all([loadReviews(), reviewsService.getDashboard(storeId).then(setDashboard)]);
  }

  async function changeStatus(review: AdminProductReview, next: 'published' | 'hidden' | 'removed', reason?: string) {
    setBusyReviewId(review.id);
    try {
      await reviewsService.setStatus(review.id, next, reason);
      await refreshAfterAction();
      notify.success(next === 'published' ? 'Reseña visible públicamente' : next === 'hidden' ? 'Reseña oculta de la tienda' : 'Reseña excluida del promedio');
      setActionReview(null);
    } catch (actionError) {
      notify.error(actionError instanceof Error ? actionError.message : 'No pudimos actualizar la reseña.');
    } finally {
      setBusyReviewId(null);
    }
  }

  async function saveSettings() {
    if (!draftSettings || !canConfigure) return;
    if (!draftSettings.invitationMessage.trim()) {
      notify.error('Escribe un mensaje para la invitación.');
      return;
    }
    setSavingSettings(true);
    try {
      const saved = await reviewsService.saveSettings(draftSettings);
      setSettings(saved);
      setDraftSettings(saved);
      notify.success('Configuración de reseñas guardada');
    } catch {
      notify.error('No pudimos guardar la configuración.');
    } finally {
      setSavingSettings(false);
    }
  }

  const statusTabs = useMemo(() => [
    { value: 'all' as const, label: 'Todas', count: dashboard.total },
    { value: 'pending' as const, label: 'Pendientes', count: dashboard.pending },
    { value: 'published' as const, label: 'Publicadas', count: dashboard.published },
    { value: 'hidden' as const, label: 'Ocultas', count: dashboard.hidden },
    { value: 'removed' as const, label: 'Excluidas', count: dashboard.removed },
  ], [dashboard]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const responseRate = dashboard.total > 0 ? Math.round((dashboard.withReply / dashboard.total) * 100) : 0;

  if (loading || !draftSettings) return <PanelLoadingState label="Cargando reseñas…" />;

  return (
    <AdminPanelShell
      top={<PageHeader title="Reseñas" description="Opiniones verificadas de clientes con pedidos entregados." sticky={false} />}
      contentClassName="pb-10"
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Calificación promedio" value={dashboard.total ? dashboard.average.toFixed(1) : '—'} detail={`${dashboard.total} reseña${dashboard.total === 1 ? '' : 's'} recibidas`} icon={<Star className="h-5 w-5" />} />
          <MetricCard label="Publicadas" value={dashboard.published} detail={`${dashboard.hidden} ocultas actualmente`} icon={<Eye className="h-5 w-5" />} />
          <MetricCard label="Por revisar" value={dashboard.pending} detail="Contenido pendiente o señalado" icon={<ShieldAlert className="h-5 w-5" />} />
          <MetricCard label="Tasa de respuesta" value={`${responseRate}%`} detail={`${dashboard.withReply} respondidas`} icon={<MessageSquareReply className="h-5 w-5" />} />
        </div>

        {dashboard.total > 0 && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardBody className="p-5"><h2 className="font-semibold text-gray-900">Distribución de calificaciones</h2><div className="mt-4 space-y-2.5">{[5, 4, 3, 2, 1].map((value) => { const count = dashboard.distribution[value as 1 | 2 | 3 | 4 | 5]; const width = dashboard.total ? (count / dashboard.total) * 100 : 0; return <div key={value} className="grid grid-cols-[54px_1fr_28px] items-center gap-2 text-xs"><span className="flex items-center gap-1 text-gray-600">{value}<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /></span><span className="h-2 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${width}%` }} /></span><span className="text-right text-gray-400">{count}</span></div>; })}</div></CardBody></Card>
            <Card><CardBody className="p-5"><h2 className="font-semibold text-gray-900">Mejor valorados</h2><p className="mt-1 text-xs text-gray-500">Productos que más satisfacción generan.</p><div className="mt-4 space-y-3">{dashboard.bestProducts.slice(0, 4).map((product) => <div key={product.productId} className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm text-gray-700">{product.productName}</p><span className="shrink-0 text-sm font-semibold text-gray-900">{product.average.toFixed(1)} <span className="text-xs font-normal text-gray-400">({product.count})</span></span></div>)}</div></CardBody></Card>
            <Card><CardBody className="p-5"><h2 className="font-semibold text-gray-900">Requieren atención</h2><p className="mt-1 text-xs text-gray-500">Prioriza mejoras y respuestas en estos productos.</p>{dashboard.attentionProducts.length > 0 ? <div className="mt-4 space-y-3">{dashboard.attentionProducts.slice(0, 4).map((product) => <div key={product.productId} className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm text-gray-700">{product.productName}</p><span className={cn('shrink-0 text-sm font-semibold', product.average < 3 ? 'text-red-600' : 'text-gray-900')}>{product.average.toFixed(1)} <span className="text-xs font-normal text-gray-400">({product.count})</span></span></div>)}</div> : <p className="mt-5 text-sm text-green-700">No hay productos por debajo de 4 estrellas.</p>}</CardBody></Card>
          </div>
        )}

        <Card>
          <CardBody>
            <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Settings2 className="h-5 w-5" /></div><div><h2 className="font-semibold text-gray-900">Configuración del módulo</h2><p className="mt-1 text-sm text-gray-500">Decide cómo recopilar y mostrar opiniones en esta empresa.</p></div></div>
            {!canConfigure && <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">Puedes gestionar y responder reseñas, pero solo propietarios y administradores pueden cambiar esta configuración.</div>}
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <Select label="Estado de las reseñas" value={draftSettings.mode} disabled={!canConfigure} options={[
                  { value: 'disabled', label: 'Desactivadas' },
                  { value: 'collect_only', label: 'Recopilar sin mostrar públicamente' },
                  { value: 'public', label: 'Activas y públicas' },
                ]} onChange={(event) => setDraftSettings({ ...draftSettings, mode: event.target.value as StoreReviewSettings['mode'] })} />
                <Select label="Vigencia de la invitación" value={String(draftSettings.invitationExpiryDays)} disabled={!canConfigure || draftSettings.mode === 'disabled'} options={[30, 60, 90, 180, 365].map((days) => ({ value: String(days), label: `${days} días` }))} onChange={(event) => setDraftSettings({ ...draftSettings, invitationExpiryDays: Number(event.target.value) })} />
                <Textarea label="Mensaje para compartir la invitación" value={draftSettings.invitationMessage} maxLength={400} disabled={!canConfigure || draftSettings.mode === 'disabled'} rows={3} onChange={(event) => setDraftSettings({ ...draftSettings, invitationMessage: event.target.value })} />
              </div>
              <div className="space-y-3">
                <SwitchField id="reviews-auto-publish" label="Publicar automáticamente" description="Las reseñas limpias aparecen de inmediato; enlaces y datos de contacto quedan pendientes." checked={draftSettings.autoPublish} disabled={!canConfigure || draftSettings.mode === 'disabled'} onChange={(autoPublish) => setDraftSettings({ ...draftSettings, autoPublish })} />
                <SwitchField id="reviews-cards" label="Mostrar estrellas en las tarjetas" description="Usa el promedio real en el inicio y el catálogo." checked={draftSettings.showRatingOnCards} disabled={!canConfigure || draftSettings.mode !== 'public'} onChange={(showRatingOnCards) => setDraftSettings({ ...draftSettings, showRatingOnCards })} />
                <SwitchField id="reviews-detail" label="Mostrar opiniones en el producto" description="Publica comentarios, distribución y respuestas de la empresa." checked={draftSettings.showProductReviews} disabled={!canConfigure || draftSettings.mode !== 'public'} onChange={(showProductReviews) => setDraftSettings({ ...draftSettings, showProductReviews })} />
                <SwitchField id="reviews-photos" label="Permitir fotografías" description="Hasta tres fotos optimizadas por producto reseñado." checked={draftSettings.showReviewPhotos} disabled={!canConfigure || draftSettings.mode === 'disabled'} onChange={(showReviewPhotos) => setDraftSettings({ ...draftSettings, showReviewPhotos })} />
              </div>
            </div>
            {canConfigure && <div className="mt-5 flex justify-end"><Button isLoading={savingSettings} disabled={JSON.stringify(settings) === JSON.stringify(draftSettings)} leftIcon={<Check className="h-4 w-4" />} onClick={() => void saveSettings()}>Guardar configuración</Button></div>}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex max-w-full gap-1 overflow-x-auto pb-1">{statusTabs.map((tab) => <button key={tab.value} type="button" onClick={() => { setStatus(tab.value); setPage(0); }} className={cn('whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition', status === tab.value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800')}>{tab.label}<span className="ml-1.5 text-xs opacity-70">{tab.count}</span></button>)}</div>
              <div className="flex flex-col gap-3 sm:flex-row"><div className="relative sm:w-72"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><Input aria-label="Buscar reseñas" className="pl-9" value={search} placeholder="Cliente, título o comentario" onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filtrar por estrellas" className="sm:w-44" value={rating} options={[{ value: '', label: 'Todas las estrellas' }, ...[5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} estrellas` }))]} onChange={(event) => { setRating(event.target.value); setPage(0); }} /></div>
            </div>
          </CardBody>
        </Card>

        {listLoading ? <PanelLoadingState label="Actualizando reseñas…" /> : reviews.length === 0 ? (
          <EmptyState icon={<Star className="h-7 w-7" />} title="No hay reseñas en esta vista" description={dashboard.total === 0 ? 'Cuando un pedido sea entregado podrás compartir la invitación de reseña con el cliente.' : 'Prueba con otro estado, calificación o término de búsqueda.'} />
        ) : (
          <div className="space-y-3">{reviews.map((review) => <ReviewCard key={review.id} review={review} busy={busyReviewId === review.id} canManage={canManage} onPublish={() => void changeStatus(review, 'published')} onHide={() => { setActionKind('hide'); setActionReview(review); }} onRemove={() => { setActionKind('remove'); setActionReview(review); }} onReply={async (body) => { await reviewsService.saveReply(review.id, body); await refreshAfterAction(); notify.success('Respuesta publicada'); }} />)}</div>
        )}

        {total > PAGE_SIZE && <div className="flex items-center justify-between"><p className="text-sm text-gray-500">Página {page + 1} de {pageCount} · {total} resultados</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} leftIcon={<ChevronLeft className="h-4 w-4" />} onClick={() => setPage((current) => Math.max(0, current - 1))}>Anterior</Button><Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>Siguiente <ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>}
      </div>

      <ReviewActionDialog key={`${actionReview?.id ?? 'closed'}:${actionKind}`} review={actionReview} kind={actionKind} busy={busyReviewId === actionReview?.id} onClose={() => setActionReview(null)} onConfirm={(reason) => { if (actionReview) void changeStatus(actionReview, actionKind === 'hide' ? 'hidden' : 'removed', reason); }} />
    </AdminPanelShell>
  );
}
