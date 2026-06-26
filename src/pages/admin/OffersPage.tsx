import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Plus, Tag, Clock, CalendarClock, Edit, Archive,
  Play, Pause, Copy, CheckCircle, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { useAppSelector } from '@/app/hooks';
import { offersService } from '@/features/offers/offersService';
import { storesService } from '@/features/stores/storesService';
import { notify } from '@/lib/notifications';
import { formatCurrency } from '@/utils/formatCurrency';
import { calculateDiscountPercentage } from '@/lib/pricing/pricing.utils';
import { computeOfferUIStatus } from '@/lib/offers/offerStatus.utils';
import type { Offer } from '@/features/offers/offers.types';
import type { Store } from '@/features/stores/stores.types';
import type { BadgeVariant } from '@/types/common.types';

type FilterTab = 'all' | 'active' | 'scheduled' | 'draft' | 'paused' | 'expired' | 'archived';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  active: 'Activa',
  expired: 'Vencida',
  paused: 'Pausada',
  archived: 'Archivada',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: 'warning',
  scheduled: 'info',
  active: 'success',
  expired: 'neutral',
  paused: 'warning',
  archived: 'neutral',
};

export function OffersPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const store = useAppSelector((s) => s.stores.current);
  const currentCommerceSettings = useAppSelector((s) => s.stores.currentCommerceSettings);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [storeData, setStoreData] = useState<Store | null>(store);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Offer | null>(null);

  const isMenu = currentCommerceSettings?.catalogType === 'menu';
  const entityLabel = isMenu ? 'campañas del menú' : 'campañas de producto';
  const newLabel = isMenu ? 'Nueva campaña' : 'Nueva campaña';
  const currency = storeData?.currency ?? 'COP';

  useEffect(() => {
    setStoreData(store);
  }, [store]);

  useEffect(() => {
    if (!storeId) return;
    async function load() {
      try {
        const [offersData, storeResult] = await Promise.all([
          offersService.getOffersByStore(storeId!),
          store ? Promise.resolve(store) : storesService.getStoreById(storeId!),
        ]);
        setOffers(offersData);
        if (storeResult) setStoreData(storeResult);
      } catch (err) {
        notify.fromError(err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  function getUIStatus(offer: Offer) {
    return computeOfferUIStatus({
      status: offer.status,
      countdownMode: offer.countdownMode,
      startsAt: offer.startsAt,
      endsAt: offer.endsAt,
    });
  }

  const filtered = offers.filter((o) => {
    const uiStatus = getUIStatus(o);
    if (tab === 'all') return true;
    return uiStatus === tab;
  });

  const countByTab = (t: FilterTab) => {
    if (t === 'all') return offers.length;
    return offers.filter((o) => getUIStatus(o) === t).length;
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'active', label: 'Activas' },
    { key: 'scheduled', label: 'Programadas' },
    { key: 'draft', label: 'Borradores' },
    { key: 'paused', label: 'Pausadas' },
    { key: 'expired', label: 'Vencidas' },
    { key: 'archived', label: 'Archivadas' },
  ];

  async function handleActivate(offer: Offer) {
    setActionLoading(offer.id);
    try {
      const updated = await offersService.activateOffer(offer.id);
      setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      notify.success(`"${offer.title}" activada.`);
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePause(offer: Offer) {
    setActionLoading(offer.id);
    try {
      const updated = await offersService.pauseOffer(offer.id);
      setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      notify.success(`"${offer.title}" pausada.`);
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleArchiveConfirmed(offer: Offer) {
    setActionLoading(offer.id);
    setConfirmArchive(null);
    try {
      const updated = await offersService.archiveOffer(offer.id);
      setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      notify.success(`"${offer.title}" archivada.`);
    } catch (err) {
      notify.fromError(err);
    } finally {
      setActionLoading(null);
    }
  }

  function handleCopyLink(offer: Offer) {
    if (!storeData) {
      notify.error('No se pudo obtener el link. Recarga la página.');
      return;
    }
    const url = `${window.location.origin}/s/${storeData.slug}/o/${offer.slug}`;
    navigator.clipboard.writeText(url).then(
      () => notify.success('Link copiado al portapapeles'),
      () => {
        // Fallback: mostrar el link directamente
        notify.info(`Link: ${url}`);
      }
    );
  }

  return (
    <div>
      <PageHeader
        title="Campañas de oferta"
        description={`Landings de ${entityLabel} con contador regresivo para publicitar.`}
        action={
          <Link to={`/admin/stores/${storeId}/offers/new`}>
            <Button leftIcon={<Plus className="w-4 h-4" />}>{newLabel}</Button>
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(({ key, label }) => {
          const count = countByTab(key);
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px',
                tab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {label}
              {count > 0 && (
                <span
                  className={[
                    'ml-1.5 text-xs rounded-full px-1.5 py-0.5',
                    tab === key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500',
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Tag className="w-10 h-10 text-gray-300" />}
          title={tab === 'all' ? 'Sin campañas' : `Sin ${STATUS_LABEL[tab]?.toLowerCase() ?? tab}`}
          description={
            tab === 'all'
              ? 'Crea la primera campaña de oferta con landing y contador regresivo.'
              : `No hay campañas en este estado.`
          }
          action={
            tab === 'all' ? (
              <Link to={`/admin/stores/${storeId}/offers/new`}>
                <Button leftIcon={<Plus className="w-4 h-4" />}>{newLabel}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((offer) => {
            const uiStatus = getUIStatus(offer);
            const hasDiscount = offer.regularPrice > 0 && offer.offerPrice < offer.regularPrice;
            const discountPct = hasDiscount
              ? calculateDiscountPercentage(offer.regularPrice, offer.offerPrice)
              : 0;

            return (
              <Card key={offer.id}>
                <CardBody>
                  <div className="flex items-start gap-4">
                    {/* Image / icon */}
                    <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
                      {offer.heroImageUrl ? (
                        <img
                          src={offer.heroImageUrl}
                          alt={offer.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Tag className="w-6 h-6 text-gray-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 truncate">{offer.title}</span>
                            <Badge variant={STATUS_VARIANT[uiStatus] ?? 'neutral'}>
                              {STATUS_LABEL[uiStatus] ?? uiStatus}
                            </Badge>
                            {offer.isVisibleInStore && (
                              <Badge variant="info">Visible en tienda</Badge>
                            )}
                          </div>
                          {offer.subtitle && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{offer.subtitle}</p>
                          )}
                        </div>

                        {/* Price */}
                        <div className="text-right shrink-0">
                          <p className="font-bold text-gray-900">
                            {formatCurrency(offer.offerPrice, 'es-CO', currency)}
                          </p>
                          {hasDiscount && (
                            <>
                              <p className="text-xs text-gray-400 line-through">
                                {formatCurrency(offer.regularPrice, 'es-CO', currency)}
                              </p>
                              <DiscountBadge percentage={discountPct} className="mt-0.5" />
                            </>
                          )}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          {offer.countdownMode === 'per_visitor' ? (
                            <><Clock className="w-3 h-3" />{offer.durationMinutes ?? 60} min por visitante</>
                          ) : (
                            <><CalendarClock className="w-3 h-3" />Ventana fija</>
                          )}
                        </span>
                        {offer.endsAt && offer.countdownMode === 'fixed_window' && (
                          <span>
                            Vence: {new Date(offer.endsAt).toLocaleDateString('es-CO')}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {(uiStatus === 'draft' || uiStatus === 'paused' || uiStatus === 'scheduled') && (
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={actionLoading === offer.id}
                            onClick={() => void handleActivate(offer)}
                            leftIcon={<Play className="w-3.5 h-3.5" />}
                          >
                            Activar
                          </Button>
                        )}
                        {uiStatus === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={actionLoading === offer.id}
                            onClick={() => void handlePause(offer)}
                            leftIcon={<Pause className="w-3.5 h-3.5" />}
                          >
                            Pausar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyLink(offer)}
                          leftIcon={<Copy className="w-3.5 h-3.5" />}
                        >
                          Copiar link
                        </Button>
                        {uiStatus !== 'archived' && (
                          <Link to={`/admin/stores/${storeId}/offers/${offer.id}/edit`}>
                            <Button size="sm" variant="ghost" leftIcon={<Edit className="w-3.5 h-3.5" />}>
                              Editar
                            </Button>
                          </Link>
                        )}
                        {uiStatus !== 'archived' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmArchive(offer)}
                            leftIcon={<Archive className="w-3.5 h-3.5 text-gray-400" />}
                          >
                            <span className="text-gray-400">Archivar</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Plan info */}
      {!loading && (
        <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
          {offers.filter((o) => getUIStatus(o) === 'active').length > 0 ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
          )}
          {offers.filter((o) => getUIStatus(o) === 'active').length} campaña(s) activa(s)
        </div>
      )}

      <ConfirmDialog
        open={confirmArchive !== null}
        title="Archivar campaña"
        message={`¿Archivar "${confirmArchive?.title}"? La campaña dejará de estar disponible por link. Puedes restaurarla editándola.`}
        confirmLabel="Archivar"
        variant="warning"
        onConfirm={() => {
          if (confirmArchive) void handleArchiveConfirmed(confirmArchive);
        }}
        onCancel={() => setConfirmArchive(null)}
      />
    </div>
  );
}
