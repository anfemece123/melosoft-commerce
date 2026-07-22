import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardBody } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { whatsappService } from '@/features/whatsapp/whatsappService';
import { notify } from '@/lib/notifications';
import type { PlatformWhatsappConnectionOverview, WhatsappConnectionStatus } from '@/features/whatsapp/whatsapp.types';

// Read-only operational view for platform_admin — no way to send a
// message, no way to read a conversation, no token ever rendered. The
// phone number here is already masked at the database layer (see
// platform_whatsapp_connections_overview, migration 096) — this page
// does not additionally need to mask it, it never receives the full
// number in the first place.

const STATUS_LABELS: Record<WhatsappConnectionStatus, { label: string; className: string }> = {
  not_connected:      { label: 'No conectado',      className: 'bg-gray-100 text-gray-600' },
  connecting:         { label: 'Conectando',        className: 'bg-blue-50 text-blue-700' },
  connected:          { label: 'Conectado',         className: 'bg-green-50 text-green-700' },
  requires_attention: { label: 'Requiere atención', className: 'bg-amber-50 text-amber-700' },
  disconnected:       { label: 'Desconectado',       className: 'bg-gray-100 text-gray-600' },
};

const TEMPLATE_LABELS: Record<string, string> = {
  not_created: 'Sin crear',
  pending: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  paused: 'Pausada',
  disabled: 'Deshabilitada',
};

export function PlatformWhatsappConnectionsPage() {
  const [rows, setRows] = useState<PlatformWhatsappConnectionOverview[] | null>(null);

  useEffect(() => {
    void whatsappService.getPlatformOverview()
      .then(setRows)
      .catch((err) => {
        notify.error(err instanceof Error ? err.message : 'Error cargando conexiones de WhatsApp');
        setRows([]);
      });
  }, []);

  if (rows === null) return <LoadingScreen />;

  return (
    <div>
      <PageHeader
        title="Conexiones de WhatsApp"
        description="Vista operativa de solo lectura: estado de conexión y plantilla por tienda. No permite enviar mensajes ni ver conversaciones."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="w-10 h-10 text-gray-300" />}
          title="Ninguna tienda ha conectado WhatsApp todavía"
          description="Las tiendas conectan su propio número desde Configuración → WhatsApp."
        />
      ) : (
        <Card>
          <CardBody>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="px-2 py-2 font-medium">Tienda</th>
                    <th className="px-2 py-2 font-medium">Estado</th>
                    <th className="px-2 py-2 font-medium">Número</th>
                    <th className="px-2 py-2 font-medium">WABA ID</th>
                    <th className="px-2 py-2 font-medium">Plantilla</th>
                    <th className="px-2 py-2 font-medium">Última verificación</th>
                    <th className="px-2 py-2 font-medium">Error actual</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const status = STATUS_LABELS[row.connectionStatus];
                    return (
                      <tr key={row.storeId} className="border-b border-gray-50 last:border-0">
                        <td className="px-2 py-2 font-medium text-gray-800">{row.storeName}</td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-gray-600">{row.displayPhoneNumberMasked ?? '—'}</td>
                        <td className="px-2 py-2 text-gray-500 text-xs">{row.wabaId ?? '—'}</td>
                        <td className="px-2 py-2 text-gray-600">{TEMPLATE_LABELS[row.templateStatus] ?? row.templateStatus}</td>
                        <td className="px-2 py-2 text-gray-500 whitespace-nowrap">
                          {row.lastVerifiedAt ? new Date(row.lastVerifiedAt).toLocaleString('es-CO') : '—'}
                        </td>
                        <td className="px-2 py-2 text-xs text-red-500 max-w-[220px] truncate">
                          {row.lastErrorMessage ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
