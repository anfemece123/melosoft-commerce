import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Globe2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { domainsService } from '@/features/domains/domainsService';
import type { DomainDnsRecord, StoreDomain, StoreDomainStatus } from '@/features/domains/domains.types';
import { notify } from '@/lib/notifications';
import { cn } from '@/utils/cn';

interface StoreDomainSettingsProps {
  storeId: string;
  storeSlug: string;
  canUseCustomDomain: boolean;
}

const STATUS_META: Record<StoreDomainStatus, {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  title: string;
  description: string;
}> = {
  pending_dns: {
    label: 'Esperando DNS',
    variant: 'warning',
    title: 'Conecta los registros DNS',
    description: 'Publica los registros indicados abajo y después verifica la configuración.',
  },
  pending_ssl: {
    label: 'Preparando SSL',
    variant: 'info',
    title: 'Certificado en proceso',
    description: 'El dominio ya responde correctamente. Estamos emitiendo su certificado HTTPS.',
  },
  active: {
    label: 'Activo',
    variant: 'success',
    title: 'Dominio conectado',
    description: 'La tienda está publicada con HTTPS y este es su dominio principal.',
  },
  error: {
    label: 'Requiere atención',
    variant: 'danger',
    title: 'No se pudo completar la conexión',
    description: 'Revisa los registros DNS y vuelve a verificar.',
  },
  disabled: {
    label: 'Desactivado',
    variant: 'neutral',
    title: 'Dominio desactivado',
    description: 'La URL gratuita de la plataforma continúa disponible.',
  },
};

function DnsRecordRow({ record, copied, onCopy }: {
  record: DomainDnsRecord;
  copied: boolean;
  onCopy: (value: string, key: string) => void;
}) {
  const key = `${record.type}:${record.name}:${record.value}`;
  return (
    <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[90px_minmax(0,1fr)_minmax(0,1.4fr)]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Tipo</p>
        <p className="mt-1 font-mono text-sm font-semibold text-gray-900">{record.type}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Nombre</p>
        <button
          type="button"
          onClick={() => onCopy(record.name, `${key}:name`)}
          className="mt-1 flex max-w-full items-center gap-2 text-left font-mono text-xs text-gray-700 hover:text-indigo-600"
        >
          <span className="truncate">{record.name}</span>
          {copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Clipboard className="h-3.5 w-3.5 shrink-0" />}
        </button>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Destino / valor</p>
        <button
          type="button"
          onClick={() => onCopy(record.value, `${key}:value`)}
          className="mt-1 flex max-w-full items-center gap-2 text-left font-mono text-xs text-gray-700 hover:text-indigo-600"
        >
          <span className="truncate">{record.value}</span>
          <Clipboard className="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
}

export function StoreDomainSettings({
  storeId,
  storeSlug,
  canUseCustomDomain,
}: StoreDomainSettingsProps) {
  const [domains, setDomains] = useState<StoreDomain[]>([]);
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<StoreDomain | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const platformUrl = domainsService.getPlatformStoreUrl(storeSlug);
  const domain = domains[0] ?? null;
  const statusMeta = domain ? STATUS_META[domain.status] : null;

  const dnsRecords = useMemo<DomainDnsRecord[]>(() => {
    if (!domain) return [];
    const records: DomainDnsRecord[] = [domain.dnsRecord];
    if (domain.ownershipVerification) records.push(domain.ownershipVerification);
    for (const record of domain.sslValidationRecords) {
      if (!records.some((current) => (
        current.type === record.type &&
        current.name === record.name &&
        current.value === record.value
      ))) {
        records.push(record);
      }
    }
    return records;
  }, [domain]);

  useEffect(() => {
    let cancelled = false;
    domainsService.list(storeId)
      .then((data) => {
        if (!cancelled) setDomains(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) notify.fromError(error, 'No se pudo cargar la configuración de dominio.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [storeId]);

  useEffect(() => {
    if (!domain || !['pending_dns', 'pending_ssl'].includes(domain.status)) return;
    let inFlight = false;
    const intervalId = window.setInterval(() => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      domainsService.refresh(domain.id)
        .then((updated) => setDomains([updated]))
        .catch(() => undefined)
        .finally(() => { inFlight = false; });
    }, 20_000);
    return () => window.clearInterval(intervalId);
  }, [domain]);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      notify.error('No se pudo copiar. Selecciona el valor manualmente.');
    }
  }

  async function handleConnect() {
    const normalized = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '');
    if (!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)) {
      setFieldError('Escribe un dominio válido, por ejemplo: www.miempresa.com');
      return;
    }

    setFieldError(null);
    setConnecting(true);
    try {
      const created = await domainsService.connect(storeId, normalized);
      setDomains([created]);
      setHostname('');
      notify.success('Dominio agregado. Ahora configura los registros DNS.');
    } catch (error) {
      notify.fromError(error, 'No se pudo conectar el dominio.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleRefresh() {
    if (!domain) return;
    setRefreshing(true);
    try {
      const updated = await domainsService.refresh(domain.id);
      setDomains([updated]);
      if (updated.status === 'active') notify.success('Dominio conectado y HTTPS activo.');
      else if (updated.status === 'pending_ssl') notify.info('DNS verificado. El certificado HTTPS está en proceso.');
      else notify.info('Aún no detectamos todos los registros. La propagación DNS puede tardar.');
    } catch (error) {
      notify.fromError(error, 'No se pudo verificar el dominio.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      await domainsService.remove(removeTarget.id);
      setDomains([]);
      setRemoveTarget(null);
      notify.success('Dominio desconectado. La URL de la plataforma sigue funcionando.');
    } catch (error) {
      notify.fromError(error, 'No se pudo desconectar el dominio.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Dirección pública de la empresa</h2>
                <p className="mt-1 text-sm text-gray-500">
                  La URL de la plataforma nunca se pierde, incluso si el dominio propio presenta un problema.
                </p>
              </div>
            </div>
            <Badge variant="success">Siempre disponible</Badge>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Subdominio incluido</p>
              <p className="mt-1 truncate font-mono text-sm text-emerald-950">{platformUrl}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => void copy(platformUrl, 'platform-url')}
                className="rounded-lg border border-emerald-200 bg-white p-2 text-emerald-700 hover:bg-emerald-50"
                aria-label="Copiar URL"
              >
                {copiedKey === 'platform-url' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              </button>
              <a
                href={platformUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-emerald-200 bg-white p-2 text-emerald-700 hover:bg-emerald-50"
                aria-label="Abrir tienda"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-gray-900">Dominio personalizado</h2>
                <Badge variant={canUseCustomDomain ? 'info' : 'neutral'}>
                  {canUseCustomDomain ? 'Incluido en el plan' : 'No incluido en el plan'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Publica la tienda en tu propio dominio con certificado SSL automático y URLs limpias.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-12 rounded-xl bg-gray-100" />
              <div className="h-24 rounded-xl bg-gray-100" />
            </div>
          ) : !canUseCustomDomain && !domain ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Activa la función de dominio propio</p>
                <p className="mt-1 text-sm text-amber-800">
                  Un administrador de la plataforma debe habilitar “Dominio propio” en el plan de esta empresa.
                  Mientras tanto, la URL gratuita continúa activa.
                </p>
              </div>
            </div>
          ) : !domain ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <Input
                  id="custom-domain"
                  label="Dominio de la empresa"
                  value={hostname}
                  onChange={(event) => {
                    setHostname(event.target.value);
                    setFieldError(null);
                  }}
                  placeholder="www.miempresa.com"
                  hint="Recomendamos usar www. También puedes usar un subdominio como tienda.miempresa.com."
                  error={fieldError ?? undefined}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  onClick={() => void handleConnect()}
                  isLoading={connecting}
                  className="sm:mb-5"
                >
                  Conectar dominio
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className={cn(
                'rounded-2xl border p-5',
                domain.status === 'active' ? 'border-emerald-200 bg-emerald-50/60' :
                  domain.status === 'error' ? 'border-red-200 bg-red-50/60' : 'border-blue-200 bg-blue-50/50',
              )}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-mono text-base font-semibold text-gray-950">{domain.hostname}</p>
                      <Badge variant={statusMeta?.variant}>{statusMeta?.label}</Badge>
                      {domain.isPrimary ? <Badge variant="neutral">Principal</Badge> : null}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-900">{statusMeta?.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{statusMeta?.description}</p>
                    {domain.failureReason ? (
                      <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-sm text-red-700">{domain.failureReason}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {domain.status === 'active' ? (
                      <a
                        href={`https://${domain.hostname}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Abrir <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleRefresh()}
                      isLoading={refreshing}
                      leftIcon={<RefreshCw className="h-4 w-4" />}
                    >
                      Verificar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setRemoveTarget(domain)}
                      disabled={removing}
                      className="text-red-600 hover:bg-red-50"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                      Desconectar
                    </Button>
                  </div>
                </div>
              </div>

              {domain.status !== 'active' ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Registros que debes crear en tu proveedor DNS</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Copia exactamente estos valores. En dominios raíz, algunos proveedores muestran “@” en lugar del nombre completo.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {dnsRecords.map((record) => (
                      <DnsRecordRow
                        key={`${record.type}:${record.name}:${record.value}`}
                        record={record}
                        copied={copiedKey === `${record.type}:${record.name}:${record.value}:name`}
                        onCopy={(value, key) => void copy(value, key)}
                      />
                    ))}
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    <p className="font-medium text-gray-900">Antes de verificar</p>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                      <li>Elimina registros A, AAAA o CNAME anteriores que usen el mismo nombre.</li>
                      <li>Guarda los registros y espera la propagación DNS; normalmente toma minutos, pero puede tardar hasta 24 horas.</li>
                      <li>Presiona “Verificar”. La tienda seguirá disponible en la URL de la plataforma durante todo el proceso.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">HTTPS administrado automáticamente</p>
                    <p className="mt-1 text-sm text-emerald-800">
                      El certificado se renueva automáticamente. La URL de la plataforma permanece como respaldo seguro.
                    </p>
                  </div>
                </div>
              )}

              {domain.lastCheckedAt ? (
                <p className="text-xs text-gray-400">
                  Última verificación: {new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(domain.lastCheckedAt))}
                </p>
              ) : null}
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Desconectar dominio"
        message={`La tienda dejará de responder en ${removeTarget?.hostname ?? 'este dominio'}, pero continuará disponible inmediatamente en la URL de la plataforma.`}
        confirmLabel={removing ? 'Desconectando…' : 'Sí, desconectar'}
        onConfirm={() => void handleRemove()}
        onCancel={() => {
          if (!removing) setRemoveTarget(null);
        }}
      />
    </div>
  );
}
