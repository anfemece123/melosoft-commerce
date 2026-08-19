import { useEffect, useMemo, useState } from 'react';
import { Handshake, Pencil, Plus, ShieldCheck, Tag, TrendingUp, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppSelector } from '@/app/hooks';
import { selectAuthProfile } from '@/features/auth/auth.selectors';
import { selectCurrentBusinessLimits, selectCurrentStore, selectMyMemberships } from '@/features/stores/stores.selectors';
import { partnersService } from '@/features/partners/partnersService';
import type {
  CreatePartnerCodeInput,
  PartnerCode,
  PartnerCommission,
  PartnerCommissionStatus,
  PartnerRuleType,
  UpdatePartnerCodeInput,
} from '@/features/partners/partners.types';
import { canManageStore, isPlatformAdmin } from '@/utils/permissions';
import { formatCurrency } from '@/utils/formatCurrency';
import { notify } from '@/lib/notifications';

interface FormState {
  partnerName: string;
  partnerEmail: string;
  partnerPhone: string;
  partnerNotes: string;
  code: string;
  discountType: PartnerRuleType;
  discountValue: string;
  maxDiscountAmount: string;
  minSubtotal: string;
  commissionType: PartnerRuleType;
  commissionValue: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  usageLimitPerCustomer: string;
}

const EMPTY_FORM: FormState = {
  partnerName: '',
  partnerEmail: '',
  partnerPhone: '',
  partnerNotes: '',
  code: '',
  discountType: 'percentage',
  discountValue: '10',
  maxDiscountAmount: '',
  minSubtotal: '0',
  commissionType: 'percentage',
  commissionValue: '10',
  startsAt: '',
  endsAt: '',
  usageLimit: '',
  usageLimitPerCustomer: '',
};

function toLocalDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formFromCode(code: PartnerCode): FormState {
  return {
    partnerName: code.partnerName,
    partnerEmail: code.partnerEmail ?? '',
    partnerPhone: code.partnerPhone ?? '',
    partnerNotes: code.partnerNotes ?? '',
    code: code.code,
    discountType: code.discountType,
    discountValue: String(code.discountValue),
    maxDiscountAmount: code.maxDiscountAmount == null ? '' : String(code.maxDiscountAmount),
    minSubtotal: String(code.minSubtotal),
    commissionType: code.commissionType,
    commissionValue: String(code.commissionValue),
    startsAt: toLocalDateTime(code.startsAt),
    endsAt: toLocalDateTime(code.endsAt),
    usageLimit: code.usageLimit == null ? '' : String(code.usageLimit),
    usageLimitPerCustomer: code.usageLimitPerCustomer == null ? '' : String(code.usageLimitPerCustomer),
  };
}

function numberOrNull(value: string) {
  const parsed = Number(value);
  return value.trim() === '' ? null : parsed;
}

function commissionStatusLabel(status: PartnerCommissionStatus) {
  return status === 'pending' ? 'Pendiente' : status === 'approved' ? 'Aprobada' : status === 'paid' ? 'Pagada' : 'Cancelada';
}

function commissionStatusVariant(status: PartnerCommissionStatus) {
  return status === 'paid' ? 'success' : status === 'cancelled' ? 'danger' : status === 'approved' ? 'info' : 'warning';
}

export function PartnersPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const profile = useAppSelector(selectAuthProfile);
  const memberships = useAppSelector(selectMyMemberships);
  const store = useAppSelector(selectCurrentStore);
  const limits = useAppSelector(selectCurrentBusinessLimits);
  const [items, setItems] = useState<PartnerCode[]>([]);
  const [commissions, setCommissions] = useState<PartnerCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerCode | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const canManage = Boolean(storeId) && canManageStore(profile, memberships, storeId as string);
  const isAdmin = isPlatformAdmin(profile);
  const currency = store?.currency ?? 'COP';

  async function loadData() {
    if (!storeId) return;
    setLoading(true);
    try {
      const [codes, commissionRows] = await Promise.all([
        partnersService.getPartnerCodes(storeId),
        partnersService.getPartnerCommissions(storeId),
      ]);
      setItems(codes);
      setCommissions(commissionRows);
    } catch (error) {
      notify.fromError(error, 'No pudimos cargar los partners.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Loading the route-scoped data is the external synchronization this
    // effect is responsible for; the repository enables this pattern broadly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // The route guarantees storeId stability while this page is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const activeCount = useMemo(() => items.filter((item) => item.status === 'active').length, [items]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function startEdit(item: PartnerCode) {
    setEditing(item);
    setForm(formFromCode(item));
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateForm(): string | null {
    if (form.partnerName.trim().length < 2) return 'Ingresa el nombre del partner.';
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,39}$/.test(form.code.trim())) return 'El código debe tener entre 3 y 40 caracteres: letras, números, guion o guion bajo.';
    const discount = Number(form.discountValue);
    const commission = Number(form.commissionValue);
    if (!Number.isFinite(discount) || discount < 0 || (form.discountType === 'percentage' && discount > 100)) return 'El descuento no es válido.';
    if (!Number.isFinite(commission) || commission < 0 || (form.commissionType === 'percentage' && commission > 100)) return 'La comisión no es válida.';
    if (Number(form.minSubtotal) < 0) return 'El subtotal mínimo no puede ser negativo.';
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) return 'La fecha final debe ser posterior a la inicial.';
    return null;
  }

  function buildPayload(storeIdValue: string): CreatePartnerCodeInput {
    return {
      storeId: storeIdValue,
      partnerName: form.partnerName,
      partnerEmail: form.partnerEmail || null,
      partnerPhone: form.partnerPhone || null,
      partnerNotes: form.partnerNotes || null,
      code: form.code,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscountAmount: numberOrNull(form.maxDiscountAmount),
      minSubtotal: Number(form.minSubtotal || 0),
      commissionType: form.commissionType,
      commissionValue: Number(form.commissionValue),
      startsAt: toIsoDateTime(form.startsAt),
      endsAt: toIsoDateTime(form.endsAt),
      usageLimit: numberOrNull(form.usageLimit),
      usageLimitPerCustomer: numberOrNull(form.usageLimitPerCustomer),
    };
  }

  async function save() {
    const validationError = validateForm();
    if (validationError || !storeId) {
      notify.error(validationError ?? 'No se encontró la empresa.');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(storeId);
      if (editing) {
        const updatePayload: UpdatePartnerCodeInput = payload;
        await partnersService.updatePartnerCode(editing.id, updatePayload);
        notify.success('Código actualizado.');
      } else {
        await partnersService.createPartnerCode(payload);
        notify.success('Partner y código creados.');
      }
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await loadData();
    } catch (error) {
      notify.fromError(error, 'No pudimos guardar el código.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: PartnerCode) {
    try {
      await partnersService.setCodeStatus(item.id, item.status === 'active' ? 'inactive' : 'active');
      await loadData();
      notify.success(item.status === 'active' ? 'Código desactivado.' : 'Código activado.');
    } catch (error) {
      notify.fromError(error, 'No pudimos cambiar el estado del código.');
    }
  }

  async function updateCommissionStatus(id: string, status: PartnerCommissionStatus) {
    try {
      await partnersService.setCommissionStatus(id, status);
      setCommissions((current) => current.map((commission) => (
        commission.id === id ? { ...commission, status } : commission
      )));
      notify.success('Estado de comisión actualizado.');
    } catch (error) {
      notify.fromError(error, 'No pudimos actualizar la comisión.');
    }
  }

  if (!storeId || !store) return <LoadingScreen label="Cargando partners…" />;

  if (!canManage) {
    return (
      <AdminPanelShell top={<PageHeader title="Partners y códigos" description="Gestiona atribución, descuentos y comisiones." />}>
        <Card><CardBody><p className="text-sm text-gray-600">No tienes permisos para administrar partners en esta empresa.</p></CardBody></Card>
      </AdminPanelShell>
    );
  }

  return (
    <AdminPanelShell
      top={(
        <PageHeader
          title="Partners y códigos"
          description="Atribuye ventas a influencers y controla el descuento y la comisión de cada código."
          action={limits?.canUsePartnerCodes ? (
            <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={startCreate}>
              Nuevo código
            </Button>
          ) : undefined}
        />
      )}
    >
      <div className="max-w-6xl space-y-6 pb-8">
        {!limits?.canUsePartnerCodes && (
          <Card className="border-amber-200 bg-amber-50">
            <CardBody className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold text-amber-900">Módulo no habilitado</p>
                <p className="mt-1 text-sm text-amber-800">El super administrador debe activar Partners y códigos para esta empresa antes de crear campañas.</p>
                {isAdmin && <Link className="mt-2 inline-block text-sm font-semibold text-amber-900 underline" to={`/admin/stores/${storeId}`}>Ir a configuración de la empresa</Link>}
              </div>
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card><CardBody><div className="flex items-center gap-2 text-sm text-gray-500"><Users className="h-4 w-4" />Códigos activos</div><p className="mt-2 text-2xl font-bold text-gray-900">{activeCount}</p></CardBody></Card>
          <Card><CardBody><div className="flex items-center gap-2 text-sm text-gray-500"><TrendingUp className="h-4 w-4" />Ventas atribuidas</div><p className="mt-2 text-2xl font-bold text-gray-900">{items.reduce((sum, item) => sum + item.redeemedCount, 0)}</p></CardBody></Card>
          <Card><CardBody><div className="flex items-center gap-2 text-sm text-gray-500"><Tag className="h-4 w-4" />Comisiones generadas</div><p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(items.reduce((sum, item) => sum + item.commissionAmount, 0), 'es-CO', currency)}</p></CardBody></Card>
        </div>

        {limits?.canUsePartnerCodes && (
          <Modal
            open={formOpen}
            title={editing ? 'Editar código de partner' : 'Crear partner y código'}
            description="Define por separado el beneficio del cliente y la comisión del partner."
            maxWidth="2xl"
            dismissible={!saving}
            onClose={() => {
              if (saving) return;
              setFormOpen(false);
              setEditing(null);
              setForm(EMPTY_FORM);
            }}
            footer={(
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setFormOpen(false);
                    setEditing(null);
                    setForm(EMPTY_FORM);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" form="partner-code-form" isLoading={saving}>
                  {editing ? 'Guardar cambios' : 'Crear código'}
                </Button>
              </div>
            )}
          >
            <form id="partner-code-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Nombre del partner" value={form.partnerName} onChange={(event) => updateForm('partnerName', event.target.value)} placeholder="Ej. Laura Gómez" />
              <Input label="Código" value={form.code} onChange={(event) => updateForm('code', event.target.value.toUpperCase())} placeholder="Ej. LAURA10" className="uppercase" />
              <Input label="Email (opcional)" type="email" value={form.partnerEmail} onChange={(event) => updateForm('partnerEmail', event.target.value)} />
              <Input label="Teléfono (opcional)" value={form.partnerPhone} onChange={(event) => updateForm('partnerPhone', event.target.value)} />
              <label className="space-y-1 text-sm font-medium text-gray-700">Tipo de descuento<select value={form.discountType} onChange={(event) => updateForm('discountType', event.target.value as PartnerRuleType)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="percentage">Porcentaje</option><option value="fixed">Valor fijo</option></select></label>
              <Input label={form.discountType === 'percentage' ? 'Descuento (%)' : 'Descuento fijo'} type="number" min="0" max={form.discountType === 'percentage' ? 100 : undefined} value={form.discountValue} onChange={(event) => updateForm('discountValue', event.target.value)} />
              <Input label="Tope de descuento (opcional)" type="number" min="0" value={form.maxDiscountAmount} onChange={(event) => updateForm('maxDiscountAmount', event.target.value)} hint={`En ${currency}`} />
              <Input label="Subtotal mínimo" type="number" min="0" value={form.minSubtotal} onChange={(event) => updateForm('minSubtotal', event.target.value)} hint={`En ${currency}`} />
              <label className="space-y-1 text-sm font-medium text-gray-700">Tipo de comisión<select value={form.commissionType} onChange={(event) => updateForm('commissionType', event.target.value as PartnerRuleType)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="percentage">Porcentaje</option><option value="fixed">Valor fijo</option></select></label>
              <Input label={form.commissionType === 'percentage' ? 'Comisión (%)' : 'Comisión fija'} type="number" min="0" max={form.commissionType === 'percentage' ? 100 : undefined} value={form.commissionValue} onChange={(event) => updateForm('commissionValue', event.target.value)} />
              <Input label="Inicio (opcional)" type="datetime-local" value={form.startsAt} onChange={(event) => updateForm('startsAt', event.target.value)} />
              <Input label="Vencimiento (opcional)" type="datetime-local" value={form.endsAt} onChange={(event) => updateForm('endsAt', event.target.value)} />
              <Input label="Límite total de usos" type="number" min="1" value={form.usageLimit} onChange={(event) => updateForm('usageLimit', event.target.value)} hint="Vacío = ilimitado" />
              <Input label="Límite por cliente" type="number" min="1" value={form.usageLimitPerCustomer} onChange={(event) => updateForm('usageLimitPerCustomer', event.target.value)} hint="Vacío = ilimitado" />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700" htmlFor="partner-notes">Notas internas</label>
              <textarea id="partner-notes" value={form.partnerNotes} onChange={(event) => updateForm('partnerNotes', event.target.value)} className="mt-1 block min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Acuerdo comercial, fecha de pago, observaciones…" />
            </div>
            </form>
          </Modal>
        )}

        {loading ? <LoadingScreen label="Cargando códigos…" /> : items.length === 0 ? (
          <EmptyState
            icon={<Handshake className="h-10 w-10 text-gray-300" />}
            title="Aún no hay partners"
            description={limits?.canUsePartnerCodes ? 'Crea el primer código para comenzar a medir ventas atribuidas y comisiones.' : 'El módulo debe ser habilitado por el super administrador antes de crear campañas.'}
            action={limits?.canUsePartnerCodes ? <Button onClick={startCreate}>Crear primer código</Button> : undefined}
          />
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr><th className="px-5 py-3">Partner / código</th><th className="px-5 py-3">Beneficio cliente</th><th className="px-5 py-3">Comisión</th><th className="px-5 py-3">Uso / ventas</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-4"><p className="font-semibold text-gray-900">{item.partnerName}</p><p className="mt-1 font-mono text-xs text-indigo-700">{item.code}</p></td>
                        <td className="px-5 py-4 text-gray-700">{item.discountType === 'percentage' ? `${item.discountValue}%` : formatCurrency(item.discountValue, 'es-CO', currency)}{item.maxDiscountAmount != null ? <span className="block text-xs text-gray-400">Tope {formatCurrency(item.maxDiscountAmount, 'es-CO', currency)}</span> : null}</td>
                        <td className="px-5 py-4 text-gray-700">{item.commissionType === 'percentage' ? `${item.commissionValue}%` : formatCurrency(item.commissionValue, 'es-CO', currency)}<span className="block text-xs text-gray-400">{formatCurrency(item.commissionAmount, 'es-CO', currency)} acumulado</span></td>
                        <td className="px-5 py-4 text-gray-700">{item.redeemedCount}{item.usageLimit != null ? ` / ${item.usageLimit}` : ''}<span className="block text-xs text-gray-400">{formatCurrency(item.revenueAmount, 'es-CO', currency)} neto</span></td>
                        <td className="px-5 py-4"><Badge variant={item.status === 'active' ? 'success' : 'neutral'}>{item.status === 'active' ? 'Activo' : item.status === 'inactive' ? 'Inactivo' : 'Archivado'}</Badge></td>
                        <td className="px-5 py-4"><div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => startEdit(item)} aria-label={`Editar ${item.code}`}><Pencil className="h-4 w-4" /></Button>{item.status !== 'archived' && <Button variant="outline" size="sm" onClick={() => void toggleStatus(item)}>{item.status === 'active' ? 'Pausar' : 'Activar'}</Button>}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}

        {commissions.length > 0 && (
          <Card>
            <CardBody className="p-0">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="font-semibold text-gray-900">Ledger de comisiones</h2>
                <p className="mt-1 text-sm text-gray-500">Cada venta queda registrada y puede pasar de pendiente a aprobada o pagada.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr><th className="px-5 py-3">Partner / código</th><th className="px-5 py-3">Pedido</th><th className="px-5 py-3">Base</th><th className="px-5 py-3">Comisión</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Fecha</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {commissions.map((commission) => (
                      <tr key={commission.id}>
                        <td className="px-5 py-4"><p className="font-semibold text-gray-900">{commission.partnerNameSnapshot}</p><p className="mt-1 font-mono text-xs text-indigo-700">{commission.partnerCodeSnapshot}</p></td>
                        <td className="px-5 py-4 font-mono text-xs text-gray-600" title={commission.orderId}>{commission.orderId.slice(0, 8).toUpperCase()}</td>
                        <td className="px-5 py-4 text-gray-700">{formatCurrency(commission.commissionBaseAmount, 'es-CO', currency)}</td>
                        <td className="px-5 py-4 font-semibold text-gray-900">{formatCurrency(commission.commissionAmount, 'es-CO', currency)}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <Badge variant={commissionStatusVariant(commission.status)}>{commissionStatusLabel(commission.status)}</Badge>
                            {commission.status !== 'paid' && commission.status !== 'cancelled' && (
                              <select
                                value={commission.status}
                                aria-label={`Estado de comisión del pedido ${commission.orderId.slice(0, 8)}`}
                                onChange={(event) => void updateCommissionStatus(commission.id, event.target.value as PartnerCommissionStatus)}
                                className="rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-700"
                              >
                                <option value="pending">Pendiente</option>
                                <option value="approved">Aprobada</option>
                                <option value="paid">Pagada</option>
                                <option value="cancelled">Cancelada</option>
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">{new Date(commission.createdAt).toLocaleDateString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </AdminPanelShell>
  );
}
