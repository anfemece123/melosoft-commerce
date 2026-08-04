import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { reviewsService } from '@/features/reviews/reviewsService';
import type { ReviewInvitationAdmin } from '@/features/reviews/reviews.types';
import type { Order } from '@/features/orders/orders.types';
import { env } from '@/lib/env';
import { buildWhatsAppContactUrl } from '@/lib/whatsapp/whatsappUrl';

export function OrderReviewInvitationCard({ order }: { order: Order }) {
  const [invitation, setInvitation] = useState<ReviewInvitationAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void reviewsService.ensureOrderInvitation(order.id)
      .then((result) => { if (active) setInvitation(result); })
      .catch(() => { if (active) setInvitation(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [order.id]);

  if (loading) return <div className="h-20 animate-pulse rounded-xl bg-gray-100" />;
  if (!invitation) return null;
  if (invitation.mode === 'disabled') {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-start gap-3"><Star className="mt-0.5 h-4 w-4 text-gray-400" /><div><p className="text-sm font-medium text-gray-700">Invitación de reseña desactivada</p><p className="mt-1 text-xs leading-5 text-gray-500">Activa la recopilación para poder compartir el enlace de este pedido.</p><Link to={`/admin/stores/${order.storeId}/reviews`} className="mt-2 inline-block text-xs font-semibold text-indigo-600">Configurar reseñas</Link></div></div>
      </div>
    );
  }

  const baseUrl = (env.publicSiteUrl || window.location.origin).replace(/\/$/, '');
  const reviewUrl = `${baseUrl}/review/${invitation.token}`;
  const message = `${invitation.invitationMessage}\n\nPedido #${order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}\n${reviewUrl}`;
  const whatsappUrl = buildWhatsAppContactUrl(order.customerPhone, message);

  async function copyLink() {
    await navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-white p-2 text-indigo-600 shadow-sm"><Star className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-900">Reseña del pedido</p>{invitation.submittedAt && <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><Check className="h-3.5 w-3.5" />Recibida</span>}</div>
          <p className="mt-1 text-xs leading-5 text-gray-500">{invitation.submittedAt ? 'El cliente ya utilizó esta invitación.' : `Disponible hasta ${new Date(invitation.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}.`}</p>
          {!invitation.submittedAt && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copiado' : 'Copiar enlace'}</button>{whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"><MessageCircle className="h-3.5 w-3.5" />Enviar por WhatsApp</a>}<a href={reviewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"><ExternalLink className="h-3.5 w-3.5" />Vista previa</a></div>}
        </div>
      </div>
    </div>
  );
}
