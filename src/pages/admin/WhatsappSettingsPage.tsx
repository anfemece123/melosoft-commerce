import { useEffect, useRef, useState } from 'react';
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
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { scrollToFirstError, useScrollToFirstFormikError } from '@/hooks/useScrollToFirstFormikError';
import { notify } from '@/lib/notifications';
import { whatsappService } from '@/features/whatsapp/whatsappService';
import { EmbeddedSignupError, launchWhatsAppEmbeddedSignup } from '@/lib/whatsapp/embeddedSignup';
import { isStorefrontHostnameMode, useStorefrontDomain } from '@/lib/storefront/storefrontDomainContext';
import { whatsappSettingsSchema, type WhatsappSettingsFormValues } from '@/schemas/whatsappSettings.schema';
import {
  COLOMBIAN_MOBILE_MESSAGE,
  isValidColombianMobile,
  normalizeColombianMobile,
  sanitizePhoneInput,
} from '@/lib/phone/phoneValidation';
import type {
  StoreWhatsappSettings,
  WhatsappNotification,
  WhatsappNotificationStatus,
  StoreWhatsappConnection,
  WhatsappConnectionStatus,
} from '@/features/whatsapp/whatsapp.types';

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

const REGISTRATION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:      { label: 'Preparando', className: 'bg-blue-50 text-blue-700' },
  registering:  { label: 'Registrando…', className: 'bg-blue-50 text-blue-700' },
  registered:   { label: 'Listo para enviar', className: 'bg-green-50 text-green-700' },
  requires_pin: { label: 'Requiere PIN', className: 'bg-amber-50 text-amber-700' },
  failed:       { label: 'Registro pendiente', className: 'bg-red-50 text-red-700' },
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
  COEXISTENCE_NOT_AVAILABLE:
    'Meta no habilitó el flujo de coexistencia para esta conexión. Tu número y WhatsApp Business no fueron modificados; contacta al soporte de Melosoft.',
  EMBEDDED_SIGNUP_NO_SESSION_INFO: 'Meta autorizó la cuenta, pero no devolvió la información de WhatsApp necesaria.',
  EMBEDDED_SIGNUP_MISSING_SESSION_DATA:
    'Meta no envió los datos de la cuenta de WhatsApp Business (WABA o número). Intenta de nuevo y confirma que seleccionaste una cuenta y un número.',
  PHONE_NUMBER_ALREADY_CONNECTED: 'Ese número de WhatsApp ya está conectado a otra tienda de Melosoft.',
  META_TOKEN_EXCHANGE_FAILED: 'No se pudo completar la conexión con Meta. Intenta de nuevo.',
  META_WABA_RESOLUTION_FAILED:
    'Meta autorizó la cuenta, pero no indicó qué cuenta de WhatsApp seleccionaste. Revisa la configuración de Embedded Signup.',
  MULTIPLE_WABAS_FOUND:
    'Meta autorizó más de una cuenta de WhatsApp y no fue posible determinar cuál seleccionaste.',
  META_WABA_VERIFICATION_FAILED: 'No se pudo verificar la cuenta de WhatsApp Business con Meta.',
  PHONE_NOT_IN_WABA: 'El número indicado no pertenece a esa cuenta de WhatsApp Business.',
  META_PHONE_DETAIL_FAILED: 'No se pudo obtener el número verificado desde Meta.',
  META_APP_SUBSCRIPTION_FAILED:
    'La conexión con Meta se validó, pero no se pudo suscribir la app a tu cuenta de WhatsApp Business. Intenta reconectar.',
  CONNECTION_SAVE_FAILED: 'No se pudo guardar la conexión.',
  REGISTRATION_SAVE_FAILED: 'No se pudo guardar el estado de habilitación del número.',
  NO_PHONE_NUMBER_FOUND: 'La cuenta de WhatsApp Business no tiene ningún número registrado.',
  MULTIPLE_PHONE_NUMBERS_FOUND: 'Esta cuenta de WhatsApp Business tiene más de un número. Selecciona uno específico e intenta de nuevo.',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  order_received: 'Pedido recibido',
  order_confirmed: 'Pedido confirmado',
  payment_approved: 'Pago aprobado',
  payment_declined: 'Pago rechazado',
  order_preparing: 'En preparación',
  order_ready_for_pickup: 'Listo para recoger',
  order_out_for_delivery: 'En camino',
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
  const [registeringPhone, setRegisteringPhone] = useState(false);
  const [registrationPin, setRegistrationPin] = useState('');
  const [registrationPinTouched, setRegistrationPinTouched] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testPhoneTouched, setTestPhoneTouched] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const templateSyncStoreRef = useRef<string | null>(null);
  const automaticRegistrationStoreRef = useRef<string | null>(null);
  const allowsNationalShipping = connection?.nationalShipmentTemplateRequired ?? false;

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

  useEffect(() => {
    if (!storeId) return;
    return whatsappService.subscribeToConnection(storeId, (latestConnection) => {
      setConnection((currentConnection) => ({
        ...latestConnection,
        nationalShipmentTemplateRequired: currentConnection?.nationalShipmentTemplateRequired ?? false,
      }));
    });
  }, [storeId]);

  // Create a missing template after a new WABA is connected, and recover a
  // template that Meta approved before its status webhook arrived. This keeps
  // onboarding automatic: merchants never need to create templates by hand.
  useEffect(() => {
    const templateNeedsSync = connection?.templateStatus === 'not_created' ||
      connection?.templateStatus === 'pending' ||
      connection?.statusTemplateStatus === 'not_created' ||
      connection?.statusTemplateStatus === 'pending' ||
      (allowsNationalShipping && (
        connection?.shipmentTemplateStatus === 'not_created' ||
        connection?.shipmentTemplateStatus === 'pending'
      ));
    if (
      !storeId ||
      connection?.connectionStatus !== 'connected' ||
      !templateNeedsSync
    ) {
      if (!templateNeedsSync) {
        templateSyncStoreRef.current = null;
      }
      return;
    }
    if (templateSyncStoreRef.current === storeId) return;

    templateSyncStoreRef.current = storeId;
    let cancelled = false;
    void whatsappService.syncTemplate(storeId)
      .then(() => whatsappService.getConnection(storeId))
      .then((latestConnection) => {
        if (!cancelled) setConnection(latestConnection);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    storeId,
    connection?.connectionStatus,
    connection?.templateStatus,
    connection?.statusTemplateStatus,
    connection?.shipmentTemplateStatus,
    allowsNationalShipping,
  ]);

  // Repair only genuinely pending pre-registration connections once
  // when their owner opens the page. A failed coexistence connection
  // must never retry in the background: its recovery requires a new,
  // user-initiated Embedded Signup flow and the authoritative Meta
  // coexistence finish event.
  useEffect(() => {
    if (
      !storeId ||
      connection?.connectionStatus !== 'connected' ||
      connection.registrationStatus !== 'pending' ||
      automaticRegistrationStoreRef.current === storeId
    ) return;

    automaticRegistrationStoreRef.current = storeId;
    setRegisteringPhone(true);
    void whatsappService.registerPhone(storeId)
      .then(() => whatsappService.getConnection(storeId))
      .then((latestConnection) => {
        if (automaticRegistrationStoreRef.current === storeId) {
          setConnection(latestConnection);
          notify.success('Número habilitado para enviar mensajes');
        }
      })
      .catch((error: unknown) => {
        if (automaticRegistrationStoreRef.current === storeId) {
          void whatsappService.getConnection(storeId).then(setConnection).catch(() => undefined);
          if (
            error instanceof Error &&
            !['WHATSAPP_REGISTRATION_PIN_REQUIRED', 'COEXISTENCE_ONBOARDING_INCOMPLETE'].includes(error.message)
          ) {
            notify.error('Meta no pudo terminar de habilitar el número. Puedes reintentarlo aquí.');
          }
        }
      })
      .finally(() => {
        if (automaticRegistrationStoreRef.current === storeId) setRegisteringPhone(false);
      });
  }, [storeId, connection?.connectionStatus, connection?.registrationStatus]);

  const formik = useFormik<WhatsappSettingsFormValues>({
    initialValues: {
      enabled: settings?.enabled ?? false,
      customerOrderConfirmationEnabled: settings?.customerOrderConfirmationEnabled ?? true,
      fulfillmentUpdateEnabled:
        (settings?.orderReadyForPickupEnabled ?? false) || (settings?.orderShippedEnabled ?? false),
      orderDeliveredEnabled: settings?.orderDeliveredEnabled ?? false,
      orderCancelledEnabled: settings?.orderCancelledEnabled ?? false,
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
          orderConfirmedEnabled: false,
          paymentApprovedEnabled: false,
          paymentDeclinedEnabled: false,
          orderPreparingEnabled: false,
          orderReadyForPickupEnabled: values.fulfillmentUpdateEnabled ?? false,
          orderShippedEnabled: values.fulfillmentUpdateEnabled ?? false,
          orderDeliveredEnabled: values.orderDeliveredEnabled ?? false,
          orderCancelledEnabled: values.orderCancelledEnabled ?? false,
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

  async function handleConnect(forceCoexistence?: boolean) {
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
      const useCoexistence = forceCoexistence ?? coexistence;
      const { code, session } = await launchWhatsAppEmbeddedSignup({ coexistence: useCoexistence });
      // Meta sometimes returns the valid OAuth code without emitting the
      // browser-side WA_EMBEDDED_SIGNUP event. Send the code regardless;
      // the Edge Function resolves the WABA from the exchanged token's
      // granular scopes when session.wabaId is absent.
      const completion = await whatsappService.completeEmbeddedSignup({
        storeId,
        code,
        wabaId: session.wabaId,
        phoneNumberId: session.phoneNumberId,
        businessId: session.businessId,
        coexistence: useCoexistence,
      });
      if (completion.registrationStatus === 'registered') {
        notify.success(completion.phoneReassigned
          ? 'WhatsApp Business conectado y listo para enviar. La conexión anterior de este número en Melosoft se cerró automáticamente.'
          : 'WhatsApp Business conectado y listo para enviar');
      } else if (completion.registrationStatus === 'requires_pin') {
        notify.warning('Número conectado. Meta solicita el PIN existente para habilitar los envíos.');
      } else if (completion.onboardingType === 'coexistence') {
        notify.warning('Falta confirmar la conexión desde WhatsApp Business en el celular.');
      } else {
        notify.warning('Número conectado, pero Meta todavía no terminó de habilitar los envíos.');
      }
      await reloadAll(storeId);
    } catch (err) {
      // EmbeddedSignupError (thrown by launchWhatsAppEmbeddedSignup) carries
      // a stable .code plus a per-attempt .correlationId — appended to the
      // message so a displayed error can be traced back to the exact
      // console log sequence for that attempt. Errors from
      // whatsappService.completeEmbeddedSignup (the Edge Function) are
      // plain Errors keyed by the same message map, with no correlation id.
      const code = err instanceof EmbeddedSignupError ? err.code : err instanceof Error ? err.message : '';
      const correlationId = err instanceof EmbeddedSignupError ? err.correlationId : null;
      const friendlyMessage = EMBEDDED_SIGNUP_ERROR_MESSAGES[code];
      const withReference = (text: string) => (correlationId ? `${text} (Referencia: ${correlationId})` : text);
      if (code === 'EMBEDDED_SIGNUP_CANCELLED') {
        notify.warning(friendlyMessage);
      } else if (friendlyMessage) {
        notify.error(withReference(friendlyMessage));
      } else {
        notify.error(withReference('No se pudo completar la conexión con WhatsApp.'));
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleRegisterPhone() {
    if (!storeId) return;
    const requiresPin = connection?.registrationStatus === 'requires_pin';
    const pin = registrationPin.trim();
    if (requiresPin && !/^\d{6}$/.test(pin)) {
      setRegistrationPinTouched(true);
      notify.error('Escribe el PIN actual de seis números.');
      scrollToFirstError({ fieldName: 'registrationPin' });
      return;
    }

    setRegisteringPhone(true);
    try {
      await whatsappService.registerPhone(storeId, requiresPin ? pin : undefined);
      setRegistrationPin('');
      setRegistrationPinTouched(false);
      notify.success('Número habilitado para enviar mensajes');
      await reloadAll(storeId);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'WHATSAPP_REGISTRATION_PIN_REQUIRED') {
        notify.warning('Meta solicita el PIN actual de verificación en dos pasos de este número.');
        await reloadAll(storeId);
      } else if (code === 'INVALID_REGISTRATION_PIN') {
        notify.error('El PIN debe contener exactamente seis números.');
      } else if (code === 'COEXISTENCE_ONBOARDING_INCOMPLETE') {
        notify.warning('Meta aún no confirmó la coexistencia. Completa la vinculación desde WhatsApp Business en el celular.');
      } else {
        notify.error('Meta no pudo habilitar el número. Intenta nuevamente.');
      }
    } finally {
      setRegisteringPhone(false);
    }
  }

  async function handleSyncTemplate() {
    if (!storeId) return;
    setSyncingTemplate(true);
    try {
      await whatsappService.syncTemplate(storeId);
      notify.success('Estado de las plantillas actualizado');
      await reloadAll(storeId);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'No se pudieron sincronizar las plantillas');
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
    setTestPhoneTouched(true);
    const normalizedPhone = normalizeColombianMobile(testPhone);
    if (!storeId || !normalizedPhone) {
      notify.error(COLOMBIAN_MOBILE_MESSAGE);
      scrollToFirstError({ fieldName: 'testPhone' });
      return;
    }
    setSendingTest(true);
    try {
      await whatsappService.sendTestMessage(storeId, normalizedPhone);
      notify.success('Mensaje de prueba en cola. Puede tardar hasta un minuto en llegar.');
      setTestPhone('');
      setTestPhoneTouched(false);
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
  const isPhoneRegistered = connection?.registrationStatus === 'registered';
  const canSendTest = isConnected && isPhoneRegistered && connection?.templateStatus === 'approved';

  if (loading) {
    return <PanelLoadingState label="Cargando configuración de WhatsApp…" />;
  }

  const statusInfo = CONNECTION_STATUS_LABELS[connection?.connectionStatus ?? 'not_connected'];
  const templateInfo = TEMPLATE_STATUS_LABELS[connection?.templateStatus ?? 'not_created'];
  const statusTemplateInfo = TEMPLATE_STATUS_LABELS[connection?.statusTemplateStatus ?? 'not_created'];
  const shipmentTemplateInfo = TEMPLATE_STATUS_LABELS[connection?.shipmentTemplateStatus ?? 'not_created'];
  const registrationInfo = REGISTRATION_STATUS_LABELS[connection?.registrationStatus ?? 'pending'];
  const statusUpdatesReady = isConnected && connection?.statusTemplateStatus === 'approved';
  const fulfillmentUpdatesReady = statusUpdatesReady && (
    !allowsNationalShipping || connection?.shipmentTemplateStatus === 'approved'
  );

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
                    <span className="text-gray-500 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Pedido recibido</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${templateInfo.className}`}>
                      {templateInfo.label}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-500 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Actualizaciones</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusTemplateInfo.className}`}>
                      {statusTemplateInfo.label}
                    </span>
                  </div>
                  {allowsNationalShipping && (
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-500 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Despacho nacional y rastreo</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${shipmentTemplateInfo.className}`}>
                        {shipmentTemplateInfo.label}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-500">Envíos desde el número</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${registrationInfo.className}`}>
                      {registrationInfo.label}
                    </span>
                  </div>
                  {connection?.templateRejectedReason && (
                    <p className="text-xs text-red-600 pt-1">{connection.templateRejectedReason}</p>
                  )}
                  {connection?.statusTemplateRejectedReason && (
                    <p className="text-xs text-red-600 pt-1">{connection.statusTemplateRejectedReason}</p>
                  )}
                  {allowsNationalShipping && connection?.shipmentTemplateRejectedReason && (
                    <p className="text-xs text-red-600 pt-1">{connection.shipmentTemplateRejectedReason}</p>
                  )}
                </div>

                {connection?.registrationStatus === 'requires_pin' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
                    <div className="flex items-start gap-2 text-xs text-amber-800">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>
                        Este número ya tenía verificación en dos pasos antes de conectarse. Escribe una sola vez su
                        PIN actual; Melosoft lo enviará directamente a Meta y lo guardará de forma segura.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        id="registrationPin"
                        name="registrationPin"
                        type="password"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={registrationPin}
                        onChange={(event) => setRegistrationPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        onBlur={() => setRegistrationPinTouched(true)}
                        placeholder="PIN de 6 números"
                        aria-label="PIN de verificación en dos pasos"
                        aria-invalid={registrationPinTouched && registrationPin.length !== 6}
                        aria-describedby="registration-pin-help"
                        className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => void handleRegisterPhone()}
                        disabled={registeringPhone}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {registeringPhone && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Habilitar
                      </button>
                    </div>
                    <p
                      id="registration-pin-help"
                      data-error-for={registrationPinTouched && registrationPin.length !== 6 ? 'registrationPin' : undefined}
                      role={registrationPinTouched && registrationPin.length !== 6 ? 'alert' : undefined}
                      className={`text-xs ${registrationPinTouched && registrationPin.length !== 6 ? 'text-red-600' : 'text-amber-700'}`}
                    >
                      {registrationPinTouched && registrationPin.length !== 6
                        ? 'Escribe exactamente los 6 números del PIN actual.'
                        : 'El PIN se envía de forma segura directamente a Meta.'}
                    </p>
                  </div>
                )}

                {connection?.registrationStatus === 'failed' && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-xs text-red-700">
                      {connection.coexistenceEnabled
                        ? 'Meta no confirmó el flujo oficial de coexistencia. Tu número continúa funcionando en WhatsApp Business y no fue modificado. Contacta al soporte de Melosoft.'
                        : 'Meta no terminó de registrar el número para enviar mensajes.'}
                      {!connection.coexistenceEnabled && connection.registrationLastErrorMessage
                        ? ` (${connection.registrationLastErrorMessage})`
                        : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => connection.coexistenceEnabled
                        ? void handleConnect(true)
                        : void handleRegisterPhone()}
                      disabled={registeringPhone || connecting}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {registeringPhone || connecting
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RefreshCw className="w-3.5 h-3.5" />}
                      {connection.coexistenceEnabled ? 'Reintentar conexión' : 'Reintentar'}
                    </button>
                  </div>
                )}

                {(connection?.registrationStatus === 'pending' || connection?.registrationStatus === 'registering') && (
                  <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                    Melosoft está habilitando el número automáticamente para enviar mensajes.
                  </div>
                )}

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
                    Verificar plantillas
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

            <form onSubmit={formik.handleSubmit} noValidate className="space-y-5">
              <label className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={formik.values.enabled ?? false}
                  onChange={formik.handleChange}
                  className="mt-0.5 h-4 w-4 rounded"
                />
                <div>
                  <p className="text-sm font-semibold text-indigo-900">Activar notificaciones automáticas</p>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    Habilita los envíos seleccionados cuando el número esté conectado y la plantilla esté aprobada.
                  </p>
                </div>
              </label>

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

              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-900">Flujo recomendado: máximo 3 mensajes normales</p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  Recibido, listo/enviado y entregado. La cancelación solo se envía cuando ocurre. Confirmación,
                  pago y preparación son cambios internos y no generan mensajes repetidos.
                </p>
              </div>

              <label className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                fulfillmentUpdatesReady ? 'border-gray-200 cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}>
                <input
                  type="checkbox"
                  name="fulfillmentUpdateEnabled"
                  checked={formik.values.fulfillmentUpdateEnabled ?? false}
                  onChange={formik.handleChange}
                  disabled={!fulfillmentUpdatesReady}
                  className="mt-0.5 h-4 w-4 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Pedido listo, en camino o enviado</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Recogida y domicilio local usan una actualización breve. Solo el envío nacional incluye transportadora, guía, fecha y rastreo.
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                statusUpdatesReady ? 'border-gray-200 cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}>
                <input
                  type="checkbox"
                  name="orderDeliveredEnabled"
                  checked={formik.values.orderDeliveredEnabled ?? false}
                  onChange={formik.handleChange}
                  disabled={!statusUpdatesReady}
                  className="mt-0.5 h-4 w-4 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Pedido entregado</p>
                  <p className="text-xs text-gray-500 mt-0.5">Cierra el ciclo con una confirmación breve al cliente.</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                statusUpdatesReady ? 'border-gray-200 cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}>
                <input
                  type="checkbox"
                  name="orderCancelledEnabled"
                  checked={formik.values.orderCancelledEnabled ?? false}
                  onChange={formik.handleChange}
                  disabled={!statusUpdatesReady}
                  className="mt-0.5 h-4 w-4 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Pedido cancelado</p>
                  <p className="text-xs text-gray-500 mt-0.5">Avisa únicamente si el pedido realmente fue cancelado.</p>
                </div>
              </label>

              {(!statusUpdatesReady || !fulfillmentUpdatesReady) && (
                <p className="text-xs text-amber-600">
                  Verifica {allowsNationalShipping ? 'las tres plantillas' : 'las plantillas'} y espera la aprobación de Meta para activar todas las actualizaciones.
                </p>
              )}

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
                  disabled={formik.isSubmitting}
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
                id="testPhone"
                name="testPhone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                autoComplete="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(sanitizePhoneInput(e.target.value))}
                onBlur={() => setTestPhoneTouched(true)}
                placeholder="3001234567"
                aria-invalid={testPhoneTouched && !isValidColombianMobile(testPhone)}
                aria-describedby="test-phone-help"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => void handleSendTest()}
                disabled={sendingTest || !canSendTest}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar
              </button>
            </div>
            <p
              id="test-phone-help"
              data-error-for={testPhoneTouched && !isValidColombianMobile(testPhone) ? 'testPhone' : undefined}
              role={testPhoneTouched && !isValidColombianMobile(testPhone) ? 'alert' : undefined}
              className={`mt-2 text-xs ${testPhoneTouched && !isValidColombianMobile(testPhone) ? 'text-red-600' : 'text-gray-400'}`}
            >
              {testPhoneTouched && !isValidColombianMobile(testPhone)
                ? COLOMBIAN_MOBILE_MESSAGE
                : 'Celular colombiano de 10 dígitos; solo números.'}
            </p>
            {!isConnected && (
              <p className="text-xs text-amber-600 mt-2">Conecta tu WhatsApp Business para poder enviar una prueba.</p>
            )}
            {isConnected && connection?.templateStatus !== 'approved' && (
              <p className="text-xs text-amber-600 mt-2">La plantilla de prueba todavía no está aprobada por Meta.</p>
            )}
            {isConnected && !isPhoneRegistered && (
              <p className="text-xs text-amber-600 mt-2">Meta todavía está habilitando este número para enviar mensajes.</p>
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
