import { useEffect, useMemo, useState } from 'react';
import { Mail, MessageCircle, Plus, Search, ShieldCheck, Users, UserRound } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { PageHeader } from '@/components/ui/PageHeader';
import { SwitchField } from '@/components/ui/SwitchField';
import { Textarea } from '@/components/ui/Textarea';
import { useAppSelector } from '@/app/hooks';
import { selectAuthProfile } from '@/features/auth/auth.selectors';
import { selectCurrentBusinessLimits, selectCurrentStore, selectMyMemberships } from '@/features/stores/stores.selectors';
import { customersService } from '@/features/customers/customersService';
import type { Customer, StoreCustomerSettings, StoreCustomerSettingsUpdate } from '@/features/customers/customers.types';
import { notify } from '@/lib/notifications';
import { formatCurrency } from '@/utils/formatCurrency';
import { canManageStore } from '@/utils/permissions';

interface CustomerFormState {
  fullName: string;
  email: string;
  phone: string;
  notes: string;
}

const EMPTY_CUSTOMER_FORM: CustomerFormState = { fullName: '', email: '', phone: '', notes: '' };

function formatDate(value: string | null) {
  if (!value) return 'Sin pedidos';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));
}

function sourceLabel(source: Customer['source']) {
  const labels: Record<Customer['source'], string> = {
    order: 'Pedido',
    storefront_form: 'Formulario público',
    manual: 'Agregado manualmente',
    import: 'Importado',
    mixed: 'Varios orígenes',
  };
  return labels[source];
}

function settingsToForm(settings: StoreCustomerSettings): StoreCustomerSettingsUpdate {
  return {
    captureEnabled: settings.captureEnabled,
    collectPhone: settings.collectPhone,
    captureTitle: settings.captureTitle,
    captureDescription: settings.captureDescription,
    incentiveText: settings.incentiveText ?? '',
    successMessage: settings.successMessage,
    emailMarketingEnabled: settings.emailMarketingEnabled,
    whatsappMarketingEnabled: settings.whatsappMarketingEnabled,
  };
}

function CustomerRow({ customer, currency }: { customer: Customer; currency: string }) {
  return (
    <div className="grid gap-4 border-b border-gray-100 px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)] sm:items-center sm:px-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{customer.fullName}</p>
            <p className="truncate text-xs text-gray-500">{sourceLabel(customer.source)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 sm:pl-11">
          {customer.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}
          {customer.phone && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{customer.phone}</span>}
        </div>
      </div>
      <div className="text-sm text-gray-600">
        <p><span className="font-semibold text-gray-900">{customer.orderCount}</span> {customer.orderCount === 1 ? 'pedido' : 'pedidos'}</p>
        <p className="mt-1 text-xs text-gray-500">Último: {formatDate(customer.lastOrderAt)}</p>
        <p className="mt-1 text-xs text-gray-500">{formatCurrency(customer.totalSpent, 'es-CO', currency)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {customer.preferences?.emailMarketingStatus === 'subscribed' && <Badge variant="success"><Mail className="mr-1 h-3 w-3" />Correo autorizado</Badge>}
        {customer.preferences?.whatsappMarketingStatus === 'subscribed' && <Badge variant="success"><MessageCircle className="mr-1 h-3 w-3" />WhatsApp autorizado</Badge>}
        {!customer.preferences || (customer.preferences.emailMarketingStatus !== 'subscribed' && customer.preferences.whatsappMarketingStatus !== 'subscribed') ? <Badge variant="neutral">Sin autorización comercial</Badge> : null}
      </div>
    </div>
  );
}

export function CustomersPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const profile = useAppSelector(selectAuthProfile);
  const memberships = useAppSelector(selectMyMemberships);
  const store = useAppSelector(selectCurrentStore);
  const limits = useAppSelector(selectCurrentBusinessLimits);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<StoreCustomerSettings | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<StoreCustomerSettingsUpdate | null>(null);

  const canManage = Boolean(storeId && canManageStore(profile, memberships, storeId));
  const moduleEnabled = limits?.canUseCustomerBook === true;

  useEffect(() => {
    if (!storeId || !moduleEnabled) return;
    let cancelled = false;
    // A different store can already have rendered before this request starts.
    // Reset the request state so stale customer data is never presented as current.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadError(null);
    Promise.all([customersService.getCustomers(storeId), customersService.getSettings(storeId)])
      .then(([customerRows, customerSettings]) => {
        if (cancelled) return;
        setCustomers(customerRows);
        setSettings(customerSettings);
        setSettingsForm(customerSettings ? settingsToForm(customerSettings) : null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'No pudimos cargar los contactos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [storeId, moduleEnabled]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => [customer.fullName, customer.email, customer.phone, sourceLabel(customer.source)]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [customers, search]);

  async function handleCreateCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId || (!customerForm.email.trim() && !customerForm.phone.trim())) {
      notify.error('Escribe al menos un correo o un teléfono.');
      return;
    }
    setSavingCustomer(true);
    try {
      await customersService.createCustomer({ storeId, ...customerForm });
      const updatedCustomers = await customersService.getCustomers(storeId);
      setCustomers(updatedCustomers);
      setCustomerForm(EMPTY_CUSTOMER_FORM);
      setModalOpen(false);
      notify.success('Contacto guardado correctamente.');
    } catch (error) {
      notify.fromError(error, 'No pudimos guardar el contacto.');
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleSaveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId || !settingsForm) return;
    if (!settingsForm.emailMarketingEnabled && !settingsForm.whatsappMarketingEnabled) {
      notify.error('Activa al menos un canal comercial para mostrar el formulario público.');
      return;
    }
    setSavingSettings(true);
    try {
      const updated = await customersService.updateSettings(storeId, settingsForm);
      setSettings(updated);
      setSettingsForm(settingsToForm(updated));
      notify.success('Configuración de captación guardada.');
    } catch (error) {
      notify.fromError(error, 'No pudimos guardar la configuración.');
    } finally {
      setSavingSettings(false);
    }
  }

  if (!storeId || !limits || !store || (moduleEnabled && loading)) {
    return <AdminPanelShell top={<PageHeader title="Clientes y contactos" sticky={false} className="mb-4" />}><PanelLoadingState /></AdminPanelShell>;
  }

  if (!moduleEnabled) {
    return (
      <AdminPanelShell top={<PageHeader title="Clientes y contactos" description="Una ficha por persona, independiente de los pedidos." sticky={false} className="mb-4" />}>
        <Card><CardBody className="py-12"><EmptyState icon={<ShieldCheck className="h-12 w-12" />} title="Módulo no habilitado" description="El Super Admin puede habilitar este módulo para la empresa. Al activarlo, no altera el flujo actual de pedidos." /></CardBody></Card>
      </AdminPanelShell>
    );
  }

  const totalWithOrders = customers.filter((customer) => customer.orderCount > 0).length;
  const emailSubscribers = customers.filter((customer) => customer.preferences?.emailMarketingStatus === 'subscribed').length;

  return (
    <AdminPanelShell
      top={(
        <PageHeader
          title="Clientes y contactos"
          description="Centraliza clientes de pedidos y contactos que aceptaron recibir comunicaciones."
          sticky={false}
          action={canManage ? <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>Agregar contacto</Button> : undefined}
        />
      )}
    >
      <div className="space-y-6 pb-8">
        {loadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Contactos totales', value: customers.length, detail: 'En esta empresa', icon: <Users className="h-5 w-5" /> },
            { label: 'Con pedidos', value: totalWithOrders, detail: 'Con historial de compra', icon: <UserRound className="h-5 w-5" /> },
            { label: 'Correo autorizado', value: emailSubscribers, detail: 'Listos para comunicación comercial', icon: <Mail className="h-5 w-5" /> },
          ].map((metric) => (
            <Card key={metric.label}><CardBody className="flex items-start justify-between p-4"><div><p className="text-sm text-gray-500">{metric.label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{metric.value}</p><p className="mt-1 text-xs text-gray-400">{metric.detail}</p></div><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">{metric.icon}</div></CardBody></Card>
          ))}
        </div>

        {canManage && settings && settingsForm && (
          <Card>
            <CardBody>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600"><ShieldCheck className="h-5 w-5" /></div>
                <div><h2 className="font-semibold text-gray-900">Captación voluntaria en la tienda</h2><p className="mt-1 text-sm leading-6 text-gray-500">Muestra un formulario en el pie de tu tienda para que las personas se registren. La autorización comercial siempre queda separada de los pedidos.</p></div>
              </div>
              <form className="mt-5 space-y-4" onSubmit={handleSaveSettings}>
                <SwitchField id="customer-capture-enabled" label="Mostrar formulario público" description="Se mostrará únicamente cuando exista una política de privacidad publicada." checked={settingsForm.captureEnabled === true} onChange={(checked) => setSettingsForm({ ...settingsForm, captureEnabled: checked })} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Título" maxLength={140} value={String(settingsForm.captureTitle ?? '')} onChange={(event) => setSettingsForm({ ...settingsForm, captureTitle: event.target.value })} />
                  <Input label="Beneficio o incentivo (opcional)" maxLength={300} value={String(settingsForm.incentiveText ?? '')} onChange={(event) => setSettingsForm({ ...settingsForm, incentiveText: event.target.value })} placeholder="Ej.: Recibe acceso anticipado a promociones" />
                </div>
                <Textarea label="Descripción" maxLength={500} rows={2} value={String(settingsForm.captureDescription ?? '')} onChange={(event) => setSettingsForm({ ...settingsForm, captureDescription: event.target.value })} />
                <Input label="Mensaje después del registro" maxLength={300} value={String(settingsForm.successMessage ?? '')} onChange={(event) => setSettingsForm({ ...settingsForm, successMessage: event.target.value })} />
                <div className="grid gap-3 md:grid-cols-3">
                  <SwitchField id="customer-collect-phone" label="Solicitar teléfono" description="Lo deja disponible para contacto posterior." checked={settingsForm.collectPhone === true} onChange={(checked) => setSettingsForm({ ...settingsForm, collectPhone: checked })} />
                  <SwitchField id="customer-email-enabled" label="Permitir correo" description="El formulario puede solicitar autorización por email." checked={settingsForm.emailMarketingEnabled === true} onChange={(checked) => setSettingsForm({ ...settingsForm, emailMarketingEnabled: checked })} />
                  <SwitchField id="customer-whatsapp-enabled" label="Permitir WhatsApp" description="Requiere teléfono y autorización explícita." checked={settingsForm.whatsappMarketingEnabled === true} onChange={(checked) => setSettingsForm({ ...settingsForm, whatsappMarketingEnabled: checked, collectPhone: checked || settingsForm.collectPhone === true })} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4"><p className="text-xs leading-5 text-gray-500">Antes de activar, publica la política de privacidad en Configuración. El sistema guarda el canal y la versión de política aceptada.</p><Button type="submit" size="sm" isLoading={savingSettings}>Guardar configuración</Button></div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="border-b border-gray-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-gray-900">Base de contactos</h2><p className="mt-1 text-sm text-gray-500">Los datos de pedido siguen siendo el comprobante histórico; esta ficha sirve para relacionar la persona entre pedidos y consentimientos.</p></div><div className="w-full sm:w-72"><Input aria-label="Buscar contactos" placeholder="Buscar por nombre, correo o teléfono" value={search} onChange={(event) => setSearch(event.target.value)} endAdornment={<Search className="h-4 w-4 text-gray-400" />} /></div></div>
          </CardBody>
          {filteredCustomers.length === 0 ? <EmptyState icon={<Users className="h-12 w-12" />} title={search ? 'No encontramos contactos' : 'Aún no hay contactos'} description={search ? 'Prueba con otro nombre, correo o teléfono.' : 'Los contactos aparecerán cuando se registren o cuando un pedido cree su ficha.'} action={canManage && !search ? <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>Agregar el primero</Button> : undefined} /> : <div><div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-4 border-b border-gray-100 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:grid"><span>Contacto</span><span>Relación comercial</span><span className="text-right">Preferencias</span></div>{filteredCustomers.map((customer) => <CustomerRow key={customer.id} customer={customer} currency={store.currency} />)}</div>}
        </Card>
      </div>

      <Modal open={modalOpen} title="Agregar contacto" description="Guarda una persona aunque todavía no tenga pedidos." onClose={() => setModalOpen(false)} maxWidth="md" footer={<div className="flex justify-end gap-3"><Button variant="outline" disabled={savingCustomer} onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" form="new-customer-form" isLoading={savingCustomer}>Guardar contacto</Button></div>}>
        <form id="new-customer-form" className="space-y-4" onSubmit={handleCreateCustomer}>
          <Input label="Nombre" value={customerForm.fullName} maxLength={200} onChange={(event) => setCustomerForm({ ...customerForm, fullName: event.target.value })} placeholder="Nombre de la persona" />
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Correo electrónico" type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} placeholder="persona@correo.com" /><Input label="Teléfono" type="tel" value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} placeholder="300 000 0000" /></div>
          <Textarea label="Notas internas (opcional)" maxLength={2000} rows={3} value={customerForm.notes} onChange={(event) => setCustomerForm({ ...customerForm, notes: event.target.value })} placeholder="Preferencias, contexto o recordatorios…" />
          <p className="text-xs leading-5 text-gray-500">Agregar manualmente no suscribe a la persona a comunicaciones comerciales. El consentimiento se registra aparte cuando la persona lo autoriza.</p>
        </form>
      </Modal>
    </AdminPanelShell>
  );
}
