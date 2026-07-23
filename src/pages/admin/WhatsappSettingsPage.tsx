import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import {
  MessageCircle, CheckCircle, AlertCircle, Loader2, Send, Info, Clock, Check, CheckCheck,
  XCircle, Ban, PhoneOff, RotateCcw, Link2, Unlink, RefreshCw, ShieldAlert, FileText,
} from 'lucide-react';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useScrollToFirstFormikError } from '@/hooks/useScrollToFirstFormikError';
import { notify } from '@/lib/notifications';
import { whatsappService } from '@/features/whatsapp/whatsappService';
import { launchWhatsAppEmbeddedSignup } from '@/lib/whatsapp/embeddedSignup';
import { isStorefrontHostnameMode, useStorefrontDomain } from '@/lib/storefront/storefrontDomainContext';
import { whatsappSettingsSchema, type WhatsappSettingsFormValues } from '@/schemas/whatsappSettings.schema';
import type {
  StoreWhatsappSettings,
  WhatsappNotification,
  WhatsappNotificationStatus,
  StoreWhatsappConnection,
  WhatsappConnectionStatus,
} from '@/features/whatsapp/whatsapp.types';

const FUTURE_EVENTS: { label: string; description: string }[] = [
  { label: 'Pago aprobado', description: 'Se enviará cuando el pago en línea sea confirmado' },
  { label: 'Pedido en preparación', description: 'Disponible próximamente' },
  { label: 'Pedido listo para recoger', description: 'Disponible próximamente' },
  { label: 'Pedido enviado', description: 'Disponible próximamente' },
  { label: 'Pedido entregado', description: 'Disponible próximamente' },
];

function StatusBadge({ status }: { status: WhatsappNotificationStatus }) {
  const map: Record<WhatsappNotificationStatus, { label: string; className: string; icon: React.ReactNode }> = {
    queued:            { label: 'En cola',           className: 'bg-gray-100 text-gray-600',    icon: <Clock className="w-3 h-3" /> },
    sending:           { label: 'Enviando',          className: 'bg-blue-50 text-blue-600',     icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    sent:              { label: 'Enviado',           className: 'bg-blue-50 text-blue-700',     icon: <Check className="w-3 h-3" /> },
    delivered:         { label: 'Entregado',         className: 'bg-indigo-50 text-indigo-700', icon: <CheckCheck className="w-3 h-3" /> },
    read:              { label: 'Leído',             className: 'bg-green-50 text-green-700',   icon: <CheckCheck className="w-3 h-3" /> },
    failed:            { label: 'Fallido',           className: 'bg-red-50 text-red-700',       icon: <XCircle className="w-3 h-3" /> },
    invalid_recipient: { label: 'Teléfono inválido', className: 'bg-amber-50 text-amber-700',   icon: <PhoneOff className="w-3 h-3" /> },
    blocked:           { label: 'Bloqueado',         className: 'bg-amber-50 text-amber-700',   icon: <ShieldAlert className="w-3 h-3" /> },
  };
  const item = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${item.className}`}>
      {item.icon}
      {item.label}
    </span>
  );
}

const CONNECTION_STATUS_LABELS: Record<WhatsappConnectionStatus, { label: string; dotClass: string; textClass: string }> = {
  not_connected:      { label: 'No conectado',       dotClass: 'bg-gray-400',   textClass: 'text-gray-500' },
  connecting:         { label: 'Conectando',         dotClass: 'bg-blue-500',   textClass: 'text-blue-600' },
  connected:          { label: 'Conectado',          dotClass: 'bg-green-500', textClass: 'text-green-700' },
  requires_attention: { label: 'Requiere atención',  dotClass: 'bg-amber-500', textClass: 'text-amber-700' },
  disconnected:       { label: 'Desconectado',       dotClass: 'bg-gray-400',   textClass: 'text-gray-500' },
};

const TEMPLATE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  not_created: { label: 'Sin crear', className: 'bg-gray-100 text-gray-600' },
  pending:     { label: 'En revisión de Meta', className: 'bg-blue-50 text-blue-700' },
  approved:    { label: 'Aprobada', className: 'bg-green-50 text-green-700' },
  rejected:    { label: 'Rechazada', className: 'bg-red-50 text-red-700' },
  paused:      { label: 'Pausada', className: 'bg-amber-50 text-amber-700' },
  disabled:    { label: 'Deshabilitada', className: 'bg-red-50 text-red-700' },
};

// Every error code launchWhatsAppEmbeddedSignup/completeEmbeddedSignup
// can throw, mapped to a user-facing message — so a caught error always
// ends in something readable instead of the button just going back to
// idle with no explanation. Backend codes (META_*, PHONE_NOT_IN_WABA,
// CONNECTION_SAVE_FAILED, PHONE_NUMBER_ALREADY_CONNECTED) mirror the
// `message` text whatsapp-embedded-signup/index.ts computes for the
// same code — kept in sync by hand since the frontend only receives the
// machine code now (see extractFunctionErrorCode in whatsappService.ts).
const EMBEDDED_SIGNUP_ERROR_MESSAGES: Record<string, string> = {
  WHATSAPP_EMBEDDED_SIGNUP_NOT_CONFIGURED: 'La conexión con Meta todavía no está configurada en esta plataforma.',
  WHATSAPP_EMBEDDED_SIGNUP_REQUIRES_HTTPS:
    'Conecta WhatsApp desde https://commerce.melosoftapp.com — Meta no permite iniciar la conexión desde HTTP o localhost.',
  EMBEDDED_SIGNUP_CANCELLED: 'Conexión cancelada.',
  EMBEDDED_SIGNUP_TIMEOUT: 'La conexión tardó demasiado y se canceló. Intenta de nuevo.',
  EMBEDDED_SIGNUP_POPUP_CLOSED: 'La ventana de Meta se cerró antes de terminar. Intenta de nuevo sin cerrarla manualmente.',
  EMBEDDED_SIGNUP_SDK_UNAVAILABLE: 'No se pudo cargar el SDK de Meta. Revisa tu conexión o desactiva bloqueadores de anuncios/scripts e intenta de nuevo.',
  EMBEDDED_SIGNUP_ERROR: 'Meta reportó un error durante la conexión. Intenta de nuevo.',
  EMBEDDED_SIGNUP_MISSING_SESSION_DATA:
    'Meta no envió los datos de la cuenta de WhatsApp Business (WABA o número). Intenta de nuevo y confirma que seleccionaste una cuenta y un número.',
  PHONE_NUMBER_ALREADY_CONNECTED: 'Ese número de WhatsApp ya está conectado a otra tienda de Melosoft.',
  META_TOKEN_EXCHANGE_FAILED: 'No se pudo completar la conexión con Meta. Intenta de nuevo.',
  META_WABA_VERIFICATION_FAILED: 'No se pudo verificar la cuenta de WhatsApp Business con Meta.',
  PHONE_NOT_IN_WABA: 'El número indicado no pertenece a esa cuenta de WhatsApp Business.',
  META_PHONE_DETAIL_FAILED: 'No se pudo obtener el número verificado desde Meta.',
  META_APP_SUBSCRIPTION_FAILED:
    'La conexión con Meta se validó, pero no se pudo suscribir la app a tu cuenta de WhatsApp Business. Intenta reconectar.',
  CONNECTION_SAVE_FAILED: 'No se pudo guardar la conexión.',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  order_received: 'Pedido recibido',
  order_confirmed: 'Pedido confirmado',
  payment_approved: 'Pago aprobado',
  payment_declined: 'Pago rechazado',
  order_preparing: 'En preparación',
  order_ready_for_pickup: 'Listo para recoger',
  order_shipped: 'Enviado',
  order_delivered: 'Entregado',
  order_cancelled: 'Cancelado',
  test_message: 'Mensaje de prueba',
};

export function WhatsappSettingsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { mode: domainMode } = useStorefrontDomain();

  const [settings, setSettings] = useState<StoreWhatsappSettings | null>(null);
  const [connection, setConnection] = useState<StoreWhatsappConnection | null>(null);
  const [history, setHistory] = useState<WhatsappNotification[]>([]);
  const [loadedStoreId, setLoadedStoreId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [coexistence, setCoexistence] = useState(false);
  const [syncingTemplate, setSyncingTemplate] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const loading = loadedStoreId !== storeId;

  function loadHistory(id: string) {
    void whatsappService.getRecentNotifications(id, 15).then(setHistory).catch(() => undefined);
  }

  function reloadAll(id: string) {
    return Promise.all([
      whatsappService.getSettings(id),
      whatsappService.getConnection(id),
      whatsappService.getRecentNotifications(id, 15),
    ]).then(([s, c, h]) => {
      setSettings(s);
      setConnection(c);
      setHistory(h);
    });
  }

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void reloadAll(storeId)
      .catch(() => {
        if (!cancelled) notify.error('Error cargando configuración de WhatsApp');
      })
      .finally(() => {
        if (!cancelled) setLoadedStoreId(storeId);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const formik = useFormik<WhatsappSettingsFormValues>({
    initialValues: {
      enabled: settings?.enabled ?? false,
      customerOrderConfirmationEnabled: settings?.customerOrderConfirmationEnabled ?? true,
      finalMessage: settings?.finalMessage ?? '',
    },
    enableReinitialize: true,
    validationSchema: whatsappSettingsSchema,
    onSubmit: async (values, helpers) => {
      if (!storeId) return;
      try {
        const saved = await whatsappService.upsertSettings({
          storeId,
          enabled: values.enabled ?? false,
          senderMode: 'dedicated',
          customerOrderConfirmationEnabled: values.customerOrderConfirmationEnabled ?? true,
          orderConfirmedEnabled: settings?.orderConfirmedEnabled ?? false,
          paymentApprovedEnabled: settings?.paymentApprovedEnabled ?? false,
          paymentDeclinedEnabled: settings?.paymentDeclinedEnabled ?? false,
          orderPreparingEnabled: settings?.orderPreparingEnabled ?? false,
          orderReadyForPickupEnabled: settings?.orderReadyForPickupEnabled ?? false,
          orderShippedEnabled: settings?.orderShippedEnabled ?? false,
          orderDeliveredEnabled: settings?.orderDeliveredEnabled ?? false,
          orderCancelledEnabled: settings?.orderCancelledEnabled ?? false,
          locale: settings?.locale ?? 'es_CO',
          timezone: settings?.timezone ?? 'America/Bogota',
          finalMessage: values.finalMessage?.trim() || null,
        });
        setSettings(saved);
        helpers.resetForm({ values });
        notify.success('Configuración de WhatsApp guardada');
      } catch (err) {
        notify.error(err instanceof Error ? err.message : 'Error guardando configuración');
      }
    },
  });

  useScrollToFirstFormikError({
    errors: formik.errors,
    submitCount: formik.submitCount,
    isSubmitting: formik.isSubmitting,
  });

  async function handleConnect() {
    if (!storeId) return;
    // Embedded Signup must only ever start from the admin panel host —
    // never from a store's own public subdomain/custom domain, even if a
    // session happens to be present there.
    if (isStorefrontHostnameMode(domainMode)) {
      notify.error('Conecta WhatsApp desde el panel de administración, no desde el sitio público de la tienda.');
      return;
    }
    setConnecting(true);
    try {
      const { code, session } = await launchWhatsAppEmbeddedSignup({ coexistence });
      if (!session.wabaId || !session.phoneNumberId) {
        throw new Error('EMBEDDED_SIGNUP_MISSING_SESSION_DATA');
      }
      await whatsappService.completeEmbeddedSignup({
        storeId,
        code,
        wabaId: session.wabaId,
        phoneNumberId: session.phoneNumberId,
        businessId: session.businessId,
        coexistence,
      });
      notify.success('WhatsApp Business conectado correctamente');
      await reloadAll(storeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const friendlyMessage = EMBEDDED_SIGNUP_ERROR_MESSAGES[message];
      if (message === 'EMBEDDED_SIGNUP_CANCELLED') {
        notify.warning(friendlyMessage);
      } else if (friendlyMessage) {
        notify.error(friendlyMessage);
      } else {
        notify.error('No se pudo completar la conexión con WhatsApp.');
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleSyncTemplate() {
    if (!storeId) return;
    setSyncingTemplate(true);
    try {
      await whatsappService.syncTemplate(storeId);
      notify.success('Estado de la plantilla actualizado');
      await reloadAll(storeId);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'No se pudo sincronizar la plantilla');
    } finally {
      setSyncingTemplate(false);
    }
  }

  async function handleDisconnect() {
    if (!storeId) return;
    setShowDisconnectConfirm(false);
    setDisconnecting(true);
    try {
      await whatsappService.disconnect(storeId);
      notify.success('WhatsApp Business desconectado');
      await reloadAll(storeId);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'No se pudo desconectar');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSendTest() {
    if (!storeId || !testPhone.trim()) return;
    setSendingTest(true);
    try {
      await whatsappService.sendTestMessage(storeId, testPhone.trim());
      notify.success('Mensaje de prueba en cola. Puede tardar hasta un minuto en llegar.');
      setTestPhone('');
      loadHistory(storeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('TEST_RATE_LIMIT_EXCEEDED')) {
        notify.error('Límite de mensajes de prueba alcanzado (máx. 3 por hora). Intenta más tarde.');
      } else if (message.includes('INVALID_PHONE')) {
        notify.error('El número de teléfono no es válido.');
      } else {
        notify.error('No se pudo enviar el mensaje de prueba.');
      }
    } finally {
      setSendingTest(false);
    }
  }

  const hasChanges = formik.dirty;
  const isConnected = connection?.connectionStatus === 'connected';
  const canReconnect = connection?.connectionStatus === 'requires_attention' || connection?.connectionStatus === 'disconnected';
  const canSendTest = isConnected && connection?.templateStatus === 'approved';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusInfo = CONNECTION_STATUS_LABELS[connection?.connectionStatus ?? 'not_connected'];
  const templateInfo = TEMPLATE_STATUS_LABELS[connection?.templateStatus ?? 'not_created'];

  return (
    <AdminPanelShell
      top={(
        <PageHeader
          title="WhatsApp Business"
          description="Conecta el número de WhatsApp de tu empresa para enviar confirmaciones de pedido automáticas."
          sticky={false}
          className="mb-4"
        />
      )}
    >
      <div className="max-w-2xl space-y-6 pb-6">

        {/* ── Connection card ── */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-50 p-2.5">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Conexión con Meta</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Cada empresa envía desde su propio número</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                <span className={statusInfo.textClass}>{statusInfo.label}</span>
              </span>
            </div>

            {isConnected || connection?.connectionStatus === 'requires_attention' ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Número conectado</span>
                    <span className="font-medium text-gray-800">{connection?.displayPhoneNumber ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Nombre comercial</span>
                    <span className="font-medium text-gray-800">{connection?.verifiedName ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-500 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Plantilla</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${templateInfo.className}`}>
                      {templateInfo.label}
                    </span>
                  </div>
                  {connection?.templateRejectedReason && (
                    <p className="text-xs text-red-600 pt-1">{connection.templateRejectedReason}</p>
                  )}
                </div>

                {connection?.connectionStatus === 'requires_attention' && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Meta rechazó el último envío con esta conexión — puede que el acceso haya sido revocado.
                      {connection.lastErrorMessage ? ` (${connection.lastErrorMessage})` : ''} Reconecta para restablecerla.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSyncTemplate()}
                    disabled={syncingTemplate}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {syncingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Verificar plantilla
                  </button>
                  {canReconnect && (
                    <button
                      type="button"
                      onClick={() => void handleConnect()}
                      disabled={connecting}
                      className="flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Reconectar
                    </button>
                  )}
                  {isConnected && (
                    <button
                      type="button"
                      onClick={() => setShowDisconnectConfirm(true)}
                      disabled={disconnecting}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                      Desconectar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-2.5 text-xs text-gray-600 rounded-xl border border-gray-200 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={coexistence}
                    onChange={(e) => setCoexistence(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  <span>
                    Ya uso WhatsApp Business en mi celular con este número y quiero conservar la app y el número
                    (coexistencia). Si Meta no ofrece esta opción para tu cuenta, el proceso se detendrá y te lo indicaremos.
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Conectar WhatsApp Business
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Te llevará a iniciar sesión con tu cuenta de Meta Business. La conexión se hace una sola vez.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {!isConnected && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Los mensajes de pedidos de tu tienda saldrán desde tu propio número de WhatsApp Business, nunca desde
              Melosoft ni desde el número de otra empresa. Conecta tu número para activar los envíos.
            </p>
          </div>
        )}

        {/* ── Events form ── */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-5">
              <h3 className="font-semibold text-gray-900">Eventos y mensaje</h3>
              {hasChanges && (
                <span className="ml-auto text-xs text-amber-600 font-medium">Cambios sin guardar</span>
              )}
            </div>

            <form onSubmit={formik.handleSubmit} className="space-y-5">
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="customerOrderConfirmationEnabled"
                  checked={formik.values.customerOrderConfirmationEnabled ?? false}
                  onChange={formik.handleChange}
                  className="mt-0.5 h-4 w-4 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Confirmación de pedido recibido</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Se envía automáticamente en cuanto se crea el pedido, si el cliente dio su consentimiento y tu
                    número está conectado con una plantilla aprobada.
                  </p>
                </div>
              </label>

              {FUTURE_EVENTS.map((event) => (
                <label
                  key={event.label}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 opacity-60 cursor-not-allowed"
                >
                  <input type="checkbox" disabled className="mt-0.5 h-4 w-4 rounded" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">{event.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{event.description}</p>
                  </div>
                </label>
              ))}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Mensaje final (opcional)</label>
                <textarea
                  name="finalMessage"
                  rows={2}
                  maxLength={300}
                  value={formik.values.finalMessage ?? ''}
                  onChange={formik.handleChange}
                  placeholder="¡Gracias por tu compra! Cualquier duda escríbenos."
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400">
                  Se agrega al final del mensaje de confirmación. Máximo 300 caracteres.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formik.isSubmitting || !hasChanges}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {formik.isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Guardar configuración</>
                  )}
                </button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* ── Test send ── */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-1">Enviar mensaje de prueba</h3>
            <p className="text-xs text-gray-500 mb-4">
              Máximo 3 mensajes de prueba por hora. Se usa una plantilla aprobada por Meta, desde tu propio número.
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="3001234567"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => void handleSendTest()}
                disabled={sendingTest || !testPhone.trim() || !canSendTest}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar
              </button>
            </div>
            {!isConnected && (
              <p className="text-xs text-amber-600 mt-2">Conecta tu WhatsApp Business para poder enviar una prueba.</p>
            )}
            {isConnected && connection?.templateStatus !== 'approved' && (
              <p className="text-xs text-amber-600 mt-2">La plantilla de prueba todavía no está aprobada por Meta.</p>
            )}
          </CardBody>
        </Card>

        {/* ── History ── */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-4">Historial reciente</h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no se han enviado mensajes.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="px-2 py-2 font-medium">Fecha</th>
                      <th className="px-2 py-2 font-medium">Evento</th>
                      <th className="px-2 py-2 font-medium">Estado</th>
                      <th className="px-2 py-2 font-medium">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-2 py-2 whitespace-nowrap text-gray-500">
                          {new Date(item.createdAt).toLocaleString('es-CO')}
                        </td>
                        <td className="px-2 py-2 text-gray-700">{EVENT_TYPE_LABELS[item.eventType] ?? item.eventType}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={item.status} />
                            {item.attempts > 1 && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
                                title={`Se reintentó ${item.attempts} veces`}
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                ×{item.attempts}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-400 max-w-[240px] truncate">
                          {item.lastErrorMessage && ['failed', 'invalid_recipient', 'blocked'].includes(item.status) ? (
                            <span className={`flex items-center gap-1 ${item.status === 'failed' ? 'text-red-500' : 'text-amber-600'}`}>
                              <Ban className="w-3 h-3 shrink-0" />
                              {item.lastErrorMessage}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Meta compliance notice ── */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Los mensajes se envían usando plantillas aprobadas por Meta desde el número de tu propia empresa. Nunca
            se usa este canal para publicidad — solo actualizaciones transaccionales de pedidos que el cliente
            aceptó recibir.
          </p>
        </div>

      </div>

      <ConfirmDialog
        open={showDisconnectConfirm}
        title="Desconectar WhatsApp Business"
        message="Dejarás de enviar confirmaciones de pedido por WhatsApp. Tu historial de mensajes se conserva y podrás reconectar en cualquier momento. Tu WhatsApp Business del celular no se ve afectado — esto solo desconecta la integración con Melosoft."
        confirmLabel="Desconectar"
        variant="danger"
        onConfirm={() => void handleDisconnect()}
        onCancel={() => setShowDisconnectConfirm(false)}
      />
    </AdminPanelShell>
  );
}
