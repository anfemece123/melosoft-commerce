import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  Calculator,
  FolderCog,
  Plus,
  Tags,
  Wallet,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAppSelector } from '@/app/hooks';
import { selectAuthProfile } from '@/features/auth/auth.selectors';
import { selectCurrentBusinessLimits, selectCurrentStore, selectMyMemberships } from '@/features/stores/stores.selectors';
import { accountingService } from '@/features/accounting/accountingService';
import type {
  AccountingCategory,
  AccountingCategoryEntryType,
  AccountingEntry,
  AccountingEntryType,
} from '@/features/accounting/accounting.types';
import { canManageStore, isPlatformAdmin } from '@/utils/permissions';
import { formatCurrency } from '@/utils/formatCurrency';
import { notify } from '@/lib/notifications';

interface EntryFormState {
  entryType: AccountingEntryType;
  description: string;
  categoryId: string;
  amount: string;
  occurredOn: string;
  notes: string;
}

interface CategoryFormState {
  name: string;
  entryType: AccountingCategoryEntryType;
}

type EntryFilter = 'all' | AccountingEntryType;

function getToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function createEmptyForm(categoryId = ''): EntryFormState {
  return {
    entryType: 'expense',
    description: '',
    categoryId,
    amount: '',
    occurredOn: getToday(),
    notes: '',
  };
}

function createEmptyCategoryForm(): CategoryFormState {
  return { name: '', entryType: 'both' };
}

function formatEntryDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function categoryTypeLabel(entryType: AccountingCategoryEntryType) {
  if (entryType === 'income') return 'Ingresos';
  if (entryType === 'expense') return 'Gastos';
  return 'Ingresos y gastos';
}

function categoryMatchesEntry(category: AccountingCategory, entryType: AccountingEntryType) {
  return category.isActive && (category.entryType === 'both' || category.entryType === entryType);
}

export function AccountingPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const profile = useAppSelector(selectAuthProfile);
  const memberships = useAppSelector(selectMyMemberships);
  const store = useAppSelector(selectCurrentStore);
  const limits = useAppSelector(selectCurrentBusinessLimits);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [form, setForm] = useState<EntryFormState>(createEmptyForm);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(createEmptyCategoryForm);
  const [voidingEntry, setVoidingEntry] = useState<AccountingEntry | null>(null);
  const [dateFrom, setDateFrom] = useState(getMonthStart);
  const [dateTo, setDateTo] = useState(getToday);
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all');

  const canManage = Boolean(storeId) && canManageStore(profile, memberships, storeId as string);
  const isAdmin = isPlatformAdmin(profile);
  const currency = store?.currency ?? 'COP';

  async function loadData() {
    if (!storeId || !limits?.canUseAccounting) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextEntries, nextCategories] = await Promise.all([
        accountingService.getEntries(storeId, { dateFrom, dateTo }),
        accountingService.getCategories(storeId),
      ]);
      setEntries(nextEntries);
      setCategories(nextCategories);
    } catch (error) {
      notify.fromError(error, 'No pudimos cargar la información contable.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    if (!storeId) return;
    try {
      setCategories(await accountingService.getCategories(storeId));
    } catch (error) {
      notify.fromError(error, 'No pudimos cargar las categorías.');
    }
  }

  useEffect(() => {
    // Route-scoped data synchronization; this pattern is used throughout the
    // admin pages when the current store or date filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, limits?.canUseAccounting, dateFrom, dateTo]);

  const activeCategoriesForForm = useMemo(
    () => categories.filter((category) => categoryMatchesEntry(category, form.entryType)),
    [categories, form.entryType],
  );

  const filteredEntries = useMemo(
    () => entryFilter === 'all' ? entries : entries.filter((entry) => entry.entryType === entryFilter),
    [entries, entryFilter],
  );
  const postedEntries = useMemo(() => filteredEntries.filter((entry) => entry.status === 'posted'), [filteredEntries]);
  const totalIncome = useMemo(
    () => postedEntries.filter((entry) => entry.entryType === 'income').reduce((sum, entry) => sum + entry.amount, 0),
    [postedEntries],
  );
  const totalExpenses = useMemo(
    () => postedEntries.filter((entry) => entry.entryType === 'expense').reduce((sum, entry) => sum + entry.amount, 0),
    [postedEntries],
  );
  const balance = totalIncome - totalExpenses;

  const categorySummary = useMemo(() => {
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const summary = new Map<string, { label: string; income: number; expense: number }>();
    for (const entry of postedEntries) {
      const key = entry.categoryId ?? `legacy:${entry.category}`;
      const current = summary.get(key) ?? { label: entry.category, income: 0, expense: 0 };
      current.label = entry.categoryId ? categoryNames.get(entry.categoryId) ?? entry.category : entry.category;
      if (entry.entryType === 'income') current.income += entry.amount;
      else current.expense += entry.amount;
      summary.set(key, current);
    }
    return [...summary.values()].sort((left, right) => (
      (right.income + right.expense) - (left.income + left.expense)
    ));
  }, [categories, postedEntries]);

  function updateForm<K extends keyof EntryFormState>(key: K, value: EntryFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateCategoryForm<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    setCategoryForm((current) => ({ ...current, [key]: value }));
  }

  function getDefaultCategoryId(entryType: AccountingEntryType) {
    return categories.find((category) => categoryMatchesEntry(category, entryType))?.id ?? '';
  }

  function openCreate() {
    setForm(createEmptyForm(getDefaultCategoryId('expense')));
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setForm(createEmptyForm());
  }

  function handleEntryTypeChange(entryType: AccountingEntryType) {
    setForm((current) => ({
      ...current,
      entryType,
      categoryId: categories.some((category) => category.id === current.categoryId && categoryMatchesEntry(category, entryType))
        ? current.categoryId
        : getDefaultCategoryId(entryType),
    }));
  }

  function validateForm() {
    if (form.description.trim().length < 2) return 'Describe el movimiento.';
    const selectedCategory = categories.find((category) => category.id === form.categoryId);
    if (!selectedCategory || !categoryMatchesEntry(selectedCategory, form.entryType)) return 'Selecciona una categoría activa.';
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Ingresa un valor mayor que cero.';
    if (!form.occurredOn) return 'Selecciona la fecha del movimiento.';
    return null;
  }

  async function saveEntry() {
    const validationError = validateForm();
    const selectedCategory = categories.find((category) => category.id === form.categoryId);
    if (validationError || !storeId || !selectedCategory) {
      notify.error(validationError ?? 'No se encontró la empresa.');
      return;
    }
    setSaving(true);
    try {
      await accountingService.createManualEntry({
        storeId,
        entryType: form.entryType,
        description: form.description,
        category: selectedCategory.name,
        categoryId: selectedCategory.id,
        amount: Number(form.amount),
        currency,
        occurredOn: form.occurredOn,
        notes: form.notes || null,
      });
      notify.success(form.entryType === 'income' ? 'Ingreso registrado.' : 'Gasto registrado.');
      setFormOpen(false);
      setForm(createEmptyForm());
      await loadData();
    } catch (error) {
      notify.fromError(error, 'No pudimos guardar el movimiento.');
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory() {
    if (!storeId) return;
    if (categoryForm.name.trim().length < 2) {
      notify.error('La categoría debe tener al menos 2 caracteres.');
      return;
    }
    setCategorySaving(true);
    try {
      await accountingService.createCategory({ storeId, ...categoryForm });
      notify.success('Categoría creada.');
      setCategoryForm(createEmptyCategoryForm());
      await loadCategories();
    } catch (error) {
      notify.fromError(error, 'No pudimos crear la categoría. Verifica que no esté repetida.');
    } finally {
      setCategorySaving(false);
    }
  }

  async function toggleCategory(category: AccountingCategory) {
    if (category.isSystem && category.name.toLowerCase() === 'ventas' && category.isActive) {
      notify.info('La categoría Ventas se mantiene activa para clasificar las ventas automáticas.');
      return;
    }
    setUpdatingCategoryId(category.id);
    try {
      await accountingService.setCategoryStatus(category.id, !category.isActive);
      setCategories((current) => current.map((item) => (
        item.id === category.id ? { ...item, isActive: !item.isActive } : item
      )));
      notify.success(category.isActive ? 'Categoría desactivada.' : 'Categoría activada.');
    } catch (error) {
      notify.fromError(error, 'No pudimos actualizar la categoría.');
    } finally {
      setUpdatingCategoryId(null);
    }
  }

  async function confirmVoid() {
    if (!voidingEntry) return;
    try {
      await accountingService.voidEntry(voidingEntry.id);
      setEntries((current) => current.map((entry) => (
        entry.id === voidingEntry.id
          ? { ...entry, status: 'voided', voidedAt: new Date().toISOString() }
          : entry
      )));
      notify.success('Movimiento anulado.');
    } catch (error) {
      notify.fromError(error, 'No pudimos anular el movimiento.');
    } finally {
      setVoidingEntry(null);
    }
  }

  if (!storeId || !store) return <LoadingScreen label="Cargando contabilidad…" />;

  if (!canManage) {
    return (
      <AdminPanelShell top={<PageHeader title="Contabilidad" description="Ingresos, gastos y balance de la empresa." />}>
        <Card><CardBody><p className="text-sm text-gray-600">No tienes permisos para consultar la contabilidad de esta empresa.</p></CardBody></Card>
      </AdminPanelShell>
    );
  }

  if (!limits?.canUseAccounting) {
    return (
      <AdminPanelShell top={<PageHeader title="Contabilidad" description="Ingresos, gastos y balance de la empresa." />}>
        <Card className="border-amber-200 bg-amber-50">
          <CardBody>
            <div className="flex items-start gap-3">
              <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold text-amber-900">Módulo no habilitado</p>
                <p className="mt-1 text-sm text-amber-800">El super administrador debe habilitar Contabilidad para esta empresa.</p>
                {isAdmin && <p className="mt-2 text-sm text-amber-900">Puedes activarlo desde la configuración de la empresa.</p>}
              </div>
            </div>
          </CardBody>
        </Card>
      </AdminPanelShell>
    );
  }

  return (
    <AdminPanelShell
      top={(
        <PageHeader
          title="Contabilidad"
          description="Una vista simple para saber cuánto entra, cuánto sale y cuál es tu balance."
          action={(
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" leftIcon={<FolderCog className="h-4 w-4" />} onClick={() => setCategoriesOpen(true)}>
                Gestionar categorías
              </Button>
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Registrar movimiento</Button>
            </div>
          )}
        />
      )}
    >
      <div className="max-w-6xl space-y-6 pb-8">
        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <Input label="Desde" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input label="Hasta" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <Select
              label="Mostrar"
              value={entryFilter}
              onChange={(event) => setEntryFilter(event.target.value as EntryFilter)}
              options={[{ value: 'all', label: 'Ingresos y gastos' }, { value: 'income', label: 'Solo ingresos' }, { value: 'expense', label: 'Solo gastos' }]}
            />
            <Button variant="outline" onClick={() => { setDateFrom(getMonthStart()); setDateTo(getToday()); }}>Este mes</Button>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card><CardBody><div className="flex items-center gap-2 text-sm text-gray-500"><ArrowDownLeft className="h-4 w-4 text-emerald-600" />Ingresos</div><p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(totalIncome, 'es-CO', currency)}</p></CardBody></Card>
          <Card><CardBody><div className="flex items-center gap-2 text-sm text-gray-500"><ArrowUpRight className="h-4 w-4 text-rose-600" />Gastos</div><p className="mt-2 text-2xl font-bold text-rose-700">{formatCurrency(totalExpenses, 'es-CO', currency)}</p></CardBody></Card>
          <Card><CardBody><div className="flex items-center gap-2 text-sm text-gray-500"><Wallet className="h-4 w-4 text-indigo-600" />Balance</div><p className={`mt-2 text-2xl font-bold ${balance >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatCurrency(balance, 'es-CO', currency)}</p></CardBody></Card>
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">Resumen por categoría</h2>
                  <p className="mt-1 text-sm text-gray-500">Identifica rápidamente en qué se generan tus ingresos y gastos.</p>
                </div>
                <Badge variant="neutral">{categories.filter((category) => category.isActive).length} activas</Badge>
              </div>
            </div>
            {categorySummary.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-500">No hay movimientos publicados para agrupar en este periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr><th className="px-5 py-3">Categoría</th><th className="px-5 py-3 text-right">Ingresos</th><th className="px-5 py-3 text-right">Gastos</th><th className="px-5 py-3 text-right">Resultado</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categorySummary.map((item) => (
                      <tr key={item.label}>
                        <td className="px-5 py-3 font-medium text-gray-800">{item.label}</td>
                        <td className="px-5 py-3 text-right text-emerald-700">{item.income ? formatCurrency(item.income, 'es-CO', currency) : '—'}</td>
                        <td className="px-5 py-3 text-right text-rose-700">{item.expense ? formatCurrency(item.expense, 'es-CO', currency) : '—'}</td>
                        <td className={`px-5 py-3 text-right font-semibold ${item.income - item.expense >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatCurrency(item.income - item.expense, 'es-CO', currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-semibold text-gray-900">Movimientos</h2>
              <p className="mt-1 text-sm text-gray-500">Las ventas aparecen automáticamente. Los demás ingresos y gastos los puedes registrar tú.</p>
            </div>
            {loading ? <LoadingScreen label="Cargando movimientos…" /> : filteredEntries.length === 0 ? (
              <EmptyState icon={<Wallet className="h-10 w-10" />} title="No hay movimientos en este periodo" description="Las ventas aparecerán aquí automáticamente o registra un ingreso/gasto adicional." action={<Button onClick={openCreate}>Registrar movimiento</Button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Movimiento</th><th className="px-5 py-3">Categoría</th><th className="px-5 py-3">Origen</th><th className="px-5 py-3 text-right">Valor</th><th className="px-5 py-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className={entry.status === 'voided' ? 'bg-gray-50 text-gray-400' : undefined}>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-500">{formatEntryDate(entry.occurredOn)}</td>
                        <td className="px-5 py-4"><p className={`font-medium ${entry.status === 'voided' ? 'line-through' : 'text-gray-900'}`}>{entry.description}</p>{entry.orderNumber && <p className="mt-1 text-xs text-gray-400">Pedido {entry.orderNumber}</p>}</td>
                        <td className="px-5 py-4 text-gray-600">{entry.category}</td>
                        <td className="px-5 py-4"><Badge variant={entry.status === 'voided' ? 'neutral' : entry.source === 'sale' ? 'info' : 'neutral'}>{entry.status === 'voided' ? 'Anulado' : entry.source === 'sale' ? 'Venta automática' : 'Manual'}</Badge></td>
                        <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${entry.status === 'voided' ? 'text-gray-400 line-through' : entry.entryType === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>{entry.entryType === 'income' ? '+' : '-'}{formatCurrency(entry.amount, 'es-CO', currency)}</td>
                        <td className="px-5 py-4 text-right">{entry.source === 'manual' && entry.status === 'posted' && <Button variant="ghost" size="sm" aria-label={`Anular ${entry.description}`} onClick={() => setVoidingEntry(entry)}><Ban className="h-4 w-4 text-gray-400" /></Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={formOpen}
        title="Registrar movimiento"
        description="Agrega un ingreso o gasto que no provenga directamente de una venta."
        maxWidth="lg"
        dismissible={!saving}
        onClose={closeForm}
        footer={(
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={saving} onClick={closeForm}>Cancelar</Button>
            <Button type="submit" form="accounting-entry-form" isLoading={saving}>Guardar movimiento</Button>
          </div>
        )}
      >
        <form id="accounting-entry-form" onSubmit={(event) => { event.preventDefault(); void saveEntry(); }} className="space-y-4">
          <Select
            label="Tipo de movimiento"
            value={form.entryType}
            onChange={(event) => handleEntryTypeChange(event.target.value as AccountingEntryType)}
            options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Descripción" value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Ej. Compra de insumos" autoFocus />
            <Input label="Valor" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => updateForm('amount', event.target.value)} placeholder="0" hint={`En ${currency}`} />
            <Select
              label="Categoría"
              value={form.categoryId}
              onChange={(event) => updateForm('categoryId', event.target.value)}
              options={activeCategoriesForForm.map((category) => ({ value: category.id, label: category.name }))}
              placeholder="Selecciona una categoría"
              hint={activeCategoriesForForm.length === 0 ? 'Crea una categoría desde Gestionar categorías.' : 'La categoría permite agrupar y analizar tus movimientos.'}
            />
            <Input label="Fecha" type="date" value={form.occurredOn} onChange={(event) => updateForm('occurredOn', event.target.value)} />
          </div>
          <Textarea label="Notas (opcional)" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Información adicional para recordar este movimiento" rows={3} />
        </form>
      </Modal>

      <Modal
        open={categoriesOpen}
        title="Gestionar categorías"
        description="Organiza tus ingresos y gastos con un catálogo propio para esta empresa."
        maxWidth="lg"
        onClose={() => setCategoriesOpen(false)}
        footer={<div className="flex justify-end"><Button variant="outline" onClick={() => setCategoriesOpen(false)}>Cerrar</Button></div>}
      >
        <div className="space-y-6">
          <form onSubmit={(event) => { event.preventDefault(); void saveCategory(); }} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="mb-3 flex items-center gap-2"><Tags className="h-4 w-4 text-indigo-600" /><h3 className="font-semibold text-gray-900">Nueva categoría</h3></div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Input label="Nombre" value={categoryForm.name} onChange={(event) => updateCategoryForm('name', event.target.value)} placeholder="Ej. Transporte" />
              <Select
                label="Aplica para"
                value={categoryForm.entryType}
                onChange={(event) => updateCategoryForm('entryType', event.target.value as AccountingCategoryEntryType)}
                options={[{ value: 'both', label: 'Ingresos y gastos' }, { value: 'income', label: 'Solo ingresos' }, { value: 'expense', label: 'Solo gastos' }]}
              />
              <Button type="submit" isLoading={categorySaving} leftIcon={<Plus className="h-4 w-4" />}>Crear</Button>
            </div>
          </form>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold text-gray-900">Categorías de la empresa</h3><span className="text-xs text-gray-500">Las inactivas no aparecen en nuevos movimientos.</span></div>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {categories.map((category) => (
                <div key={category.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${category.isActive ? '' : 'bg-gray-50 opacity-70'}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-gray-900">{category.name}</p>{category.isSystem && <Badge variant="info">Predeterminada</Badge>}{!category.isActive && <Badge variant="neutral">Inactiva</Badge>}</div>
                    <p className="mt-1 text-xs text-gray-500">{categoryTypeLabel(category.entryType)}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={updatingCategoryId === category.id || (category.isSystem && category.name.toLowerCase() === 'ventas' && category.isActive)}
                    onClick={() => void toggleCategory(category)}
                  >
                    {category.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(voidingEntry)}
        title="Anular movimiento"
        message={voidingEntry ? `¿Quieres anular “${voidingEntry.description}”? No se borrará, pero dejará de afectar el balance.` : ''}
        confirmLabel="Anular movimiento"
        variant="warning"
        onCancel={() => setVoidingEntry(null)}
        onConfirm={() => void confirmVoid()}
      />
    </AdminPanelShell>
  );
}
