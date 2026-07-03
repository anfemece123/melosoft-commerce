import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import {
  CreditCard, CheckCircle, AlertCircle, Settings, Eye, EyeOff,
  Loader2, Shield, ToggleLeft, ToggleRight, RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScrollToFirstFormikError } from '@/hooks/useScrollToFirstFormikError';
import { Card, CardBody } from '@/components/ui/Card';
import { notify } from '@/lib/notifications';
import { paymentsService } from '@/features/payments/paymentsService';
import { wompiSettingsSchema, type WompiSettingsFormValues } from '@/schemas/paymentSettings.schema';
import type { StorePaymentSettings } from '@/features/payments/payments.types';

// ── Masked secret display ──────────────────────────────────────

function maskSecret(value: string | null | undefined): string {
  if (!value) return '';
  if (value.length <= 6) return '••••••';
  return '••••••••' + value.slice(-4);
}

// ── Secret field with show/hide toggle ────────────────────────

interface SecretFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  savedMasked: string;
  placeholder?: string;
  hint?: string;
}

function SecretField({
  label, name, value, onChange, onBlur, error, touched,
  savedMasked, placeholder, hint,
}: SecretFieldProps) {
  const [show, setShow] = useState(false);
  const isEmpty = !value;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {savedMasked && isEmpty && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
          <Shield className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="font-mono text-gray-500 text-xs">{savedMasked}</span>
          <span className="text-xs text-gray-400 ml-auto">Guardado · escribe para reemplazar</span>
        </div>
      )}
      <div className="relative">
        <input
          id={name}
          name={name}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder ?? (savedMasked ? 'Escribe para reemplazar...' : '')}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-10 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {touched && error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────

function WompiStatusBadge({ settings }: { settings: StorePaymentSettings | null }) {
  if (!settings || !settings.publicKey) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        No configurado
      </span>
    );
  }
  if (!settings.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Configurado · inactivo
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
      settings.environment === 'production'
        ? 'bg-green-50 border-green-200 text-green-700'
        : 'bg-blue-50 border-blue-200 text-blue-700'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        settings.environment === 'production' ? 'bg-green-500' : 'bg-blue-500'
      }`} />
      Activo · {settings.environment === 'production' ? 'Producción' : 'Sandbox'}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────

export function PaymentsPage() {
  const { storeId } = useParams<{ storeId: string }>();

  const [settings, setSettings] = useState<StorePaymentSettings | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    void Promise.all([
      paymentsService.getStorePaymentSettings(storeId),
      paymentsService.getWompiProviderId(),
    ])
      .then(([s, pid]) => {
        setSettings(s);
        setProviderId(pid);
      })
      .catch(() => notify.error('Error cargando configuración de pagos'))
      .finally(() => setLoading(false));
  }, [storeId]);

  const formik = useFormik<WompiSettingsFormValues>({
    initialValues: {
      environment:     settings?.environment ?? 'sandbox',
      publicKey:       '',
      privateKey:      '',
      integritySecret: '',
      eventsSecret:    '',
      isActive:        settings?.isActive ?? false,
    },
    enableReinitialize: true,
    validationSchema: wompiSettingsSchema,
    onSubmit: async (values, helpers) => {
      if (!storeId || !providerId) return;
      try {
        const saved = await paymentsService.upsertStorePaymentSettings({
          storeId,
          providerId,
          environment:     values.environment as 'sandbox' | 'production',
          publicKey:       values.publicKey || settings?.publicKey || null,
          privateKey:      values.privateKey || settings?.privateKey || null,
          integritySecret: values.integritySecret || settings?.integritySecret || null,
          eventsSecret:    values.eventsSecret || settings?.eventsSecret || null,
          isActive:        values.isActive,
        });
        setSettings(saved);
        helpers.resetForm();
        notify.success('Configuración de Wompi guardada');
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

  async function handleToggleActive() {
    if (!storeId || !settings) return;
    if (!settings.publicKey || !settings.integritySecret) {
      notify.error('Configura la llave pública y el secreto de integridad antes de activar Wompi.');
      return;
    }
    setToggling(true);
    try {
      const updated = await paymentsService.updateStorePaymentSettings(
        storeId,
        settings.providerId,
        { isActive: !settings.isActive },
      );
      setSettings(updated);
      notify.success(updated.isActive ? 'Wompi activado' : 'Wompi desactivado');
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error actualizando estado');
    } finally {
      setToggling(false);
    }
  }

  const isConfigured = !!(settings?.publicKey && settings.integritySecret);
  const hasChanges = formik.dirty;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pagos"
        description="Configura Wompi como pasarela de pagos online para esta tienda."
      />

      <div className="max-w-2xl space-y-6">

        {/* ── Status card ── */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2.5">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Wompi</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Pagos online por tarjeta, PSE y más</p>
                </div>
              </div>
              <WompiStatusBadge settings={settings} />
            </div>

            {isConfigured && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {settings?.isActive ? 'Pago online activo' : 'Pago online inactivo'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {settings?.isActive
                      ? 'Los clientes pueden pagar online en tu tienda.'
                      : 'Activa Wompi para que tus clientes puedan pagar online.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleActive}
                  disabled={toggling}
                  className="shrink-0 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
                  style={{
                    backgroundColor: settings?.isActive ? '#fee2e2' : '#dcfce7',
                    color: settings?.isActive ? '#991b1b' : '#166534',
                  }}
                >
                  {toggling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : settings?.isActive ? (
                    <><ToggleRight className="w-4 h-4" /> Desactivar</>
                  ) : (
                    <><ToggleLeft className="w-4 h-4" /> Activar</>
                  )}
                </button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Security notice ── */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Seguridad de llaves</p>
            <p>Las llaves privadas y secretos se guardan de forma segura en la base de datos con acceso restringido. Solo las Edge Functions del servidor las leen para generar firmas. Nunca llegan al navegador del cliente.</p>
          </div>
        </div>

        {/* ── Configuration form ── */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-5">
              <Settings className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Credenciales Wompi</h3>
              {hasChanges && (
                <span className="ml-auto text-xs text-amber-600 font-medium">Cambios sin guardar</span>
              )}
            </div>

            <form onSubmit={formik.handleSubmit} className="space-y-5">

              {/* Environment */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">Modo</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['sandbox', 'production'] as const).map(env => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => void formik.setFieldValue('environment', env)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                        formik.values.environment === env
                          ? env === 'production'
                            ? 'border-green-400 bg-green-50 text-green-800'
                            : 'border-blue-400 bg-blue-50 text-blue-800'
                          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {env === 'sandbox' ? (
                        <>
                          <span>🧪</span>
                          <span>Sandbox</span>
                          <span className="text-xs font-normal opacity-70">Pruebas</span>
                        </>
                      ) : (
                        <>
                          <span>🚀</span>
                          <span>Producción</span>
                          <span className="text-xs font-normal opacity-70">Pagos reales</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
                {formik.values.environment === 'production' && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mt-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Modo producción. Usa llaves reales de Wompi. Los pagos serán procesados.
                    </p>
                  </div>
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Public key */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Llave pública <span className="text-red-500">*</span>
                </label>
                <input
                  name="publicKey"
                  type="text"
                  value={formik.values.publicKey ?? ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder={settings?.publicKey ?? 'pub_test_...'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {settings?.publicKey && !formik.values.publicKey && (
                  <p className="text-xs text-gray-400">Guardado: <span className="font-mono">{settings.publicKey.slice(0, 20)}...</span></p>
                )}
                <p className="text-xs text-gray-400">
                  Comienza con <code className="font-mono">pub_test_</code> (sandbox) o <code className="font-mono">pub_prod_</code> (producción).
                </p>
              </div>

              {/* Private key */}
              <SecretField
                label="Llave privada"
                name="privateKey"
                value={formik.values.privateKey ?? ''}
                onChange={v => void formik.setFieldValue('privateKey', v)}
                onBlur={() => void formik.setFieldTouched('privateKey', true)}
                savedMasked={maskSecret(settings?.privateKey)}
                placeholder="prv_test_..."
                hint="Necesaria para consultar transacciones. Comienza con prv_test_ o prv_prod_."
              />

              {/* Integrity secret */}
              <SecretField
                label={<>Secreto de integridad <span className="text-red-500">*</span></> as unknown as string}
                name="integritySecret"
                value={formik.values.integritySecret ?? ''}
                onChange={v => void formik.setFieldValue('integritySecret', v)}
                onBlur={() => void formik.setFieldTouched('integritySecret', true)}
                savedMasked={maskSecret(settings?.integritySecret)}
                hint="Se usa para firmar los parámetros del checkout. Requerido para activar pagos online."
              />

              {/* Events secret */}
              <SecretField
                label="Secreto de eventos (webhook)"
                name="eventsSecret"
                value={formik.values.eventsSecret ?? ''}
                onChange={v => void formik.setFieldValue('eventsSecret', v)}
                onBlur={() => void formik.setFieldTouched('eventsSecret', true)}
                savedMasked={maskSecret(settings?.eventsSecret)}
                hint="Se usa para validar la autenticidad de los webhooks de Wompi. Recomendado."
              />

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formik.isSubmitting || (!hasChanges && !!settings)}
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

        {/* ── Webhook URL ── */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-3">URL del Webhook</h3>
            <p className="text-sm text-gray-500 mb-3">
              Registra esta URL en el panel de Wompi → Configuración → Webhooks para recibir actualizaciones de pago automáticamente.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-mono text-gray-700 break-all">
                https://omgkiynnpaygxulugxmc.supabase.co/functions/v1/wompi-webhook
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    'https://omgkiynnpaygxulugxmc.supabase.co/functions/v1/wompi-webhook'
                  );
                  notify.success('URL copiada');
                }}
                className="shrink-0 rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </CardBody>
        </Card>

        {/* ── Help ── */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-3">¿Dónde encuentro mis llaves Wompi?</h3>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2"><span className="font-semibold text-indigo-600 shrink-0">1.</span> Ingresa a <a href="https://comercios.wompi.co" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">comercios.wompi.co</a></li>
              <li className="flex gap-2"><span className="font-semibold text-indigo-600 shrink-0">2.</span> Ve a <strong>Configuración → Llaves de API</strong></li>
              <li className="flex gap-2"><span className="font-semibold text-indigo-600 shrink-0">3.</span> Copia la <strong>Llave pública</strong>, <strong>Llave privada</strong> y el <strong>Secreto de integridad</strong></li>
              <li className="flex gap-2"><span className="font-semibold text-indigo-600 shrink-0">4.</span> Para el webhook, ve a <strong>Configuración → Webhooks</strong> y copia el <strong>Secreto de eventos</strong></li>
            </ol>
          </CardBody>
        </Card>

      </div>
    </div>
  );
}
