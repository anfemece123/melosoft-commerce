import { useEffect, useState } from 'react';
import { Edit3, Layers, Users, Package, Tag, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { plansService } from '@/features/plans/plansService';
import type { SubscriptionPlan, SubscriptionPlanUpdate } from '@/features/plans/plans.types';
import { notify } from '@/lib/notifications';

interface PlanFormState {
  name: string;
  description: string;
  maxProducts: string;
  maxStaff: string;
  maxActiveOffers: string;
  maxMonthlyOrders: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: PlanFormState = {
  name: '',
  description: '',
  maxProducts: '0',
  maxStaff: '0',
  maxActiveOffers: '0',
  maxMonthlyOrders: '',
  isActive: true,
  sortOrder: '0',
};

function formFromPlan(plan: SubscriptionPlan): PlanFormState {
  return {
    name: plan.name,
    description: plan.description,
    maxProducts: String(plan.maxProducts),
    maxStaff: String(plan.maxStaff),
    maxActiveOffers: String(plan.maxActiveOffers),
    maxMonthlyOrders: plan.maxMonthlyOrders === null ? '' : String(plan.maxMonthlyOrders),
    isActive: plan.isActive,
    sortOrder: String(plan.sortOrder),
  };
}

function parseNonNegative(value: string, label: string): number {
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} debe ser un número entero igual o mayor que cero.`);
  return Number(value);
}

function toUpdate(form: PlanFormState): SubscriptionPlanUpdate {
  const maxMonthlyOrders = form.maxMonthlyOrders.trim() === ''
    ? null
    : parseNonNegative(form.maxMonthlyOrders, 'Los pedidos mensuales');
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    maxProducts: parseNonNegative(form.maxProducts, 'Los productos'),
    maxStaff: parseNonNegative(form.maxStaff, 'El personal'),
    maxActiveOffers: parseNonNegative(form.maxActiveOffers, 'Las ofertas activas'),
    maxMonthlyOrders,
    isActive: form.isActive,
    sortOrder: parseNonNegative(form.sortOrder, 'El orden'),
  };
}

export function PlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setPlans(await plansService.getPlans());
      } catch (error) {
        notify.fromError(error, 'No pudimos cargar los planes.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function openEdit(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setForm(formFromPlan(plan));
  }

  async function handleSave() {
    if (!editingPlan) return;
    if (!form.name.trim()) {
      notify.error('El plan debe tener un nombre.');
      return;
    }
    setSaving(true);
    try {
      const updated = await plansService.updatePlan(editingPlan.id, toUpdate(form));
      setPlans((current) => current.map((plan) => plan.id === updated.id ? updated : plan));
      setEditingPlan(null);
      notify.success(`Plan ${updated.name} actualizado. Sus empresas asignadas recibieron los nuevos límites.`);
    } catch (error) {
      notify.fromError(error, 'No pudimos actualizar el plan.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen label="Cargando planes…" />;

  return (
    <div>
      <PageHeader
        title="Planes"
        description="Define la capacidad de cada plan y controla qué reciben las empresas asignadas."
      />

      <Card className="mb-6 border-indigo-100 bg-indigo-50/50">
        <CardBody>
          <div className="flex items-start gap-3">
            <Layers className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-indigo-950">Cómo funcionan los planes</p>
              <p className="mt-1 text-sm leading-5 text-indigo-800">
                Los límites de capacidad se actualizan automáticamente en las empresas que usan el plan. Los módulos opcionales se siguen administrando por empresa desde su configuración.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={!plan.isActive ? 'opacity-70' : undefined}>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{plan.planKey}</p>
                  <h2 className="mt-1 text-lg font-bold text-gray-900">{plan.name}</h2>
                </div>
                <Badge variant={plan.isActive ? 'success' : 'neutral'}>{plan.isActive ? 'Activo' : 'Inactivo'}</Badge>
              </div>
              <p className="mt-2 min-h-10 text-sm leading-5 text-gray-500">{plan.description || 'Sin descripción.'}</p>

              <div className="mt-5 space-y-3 border-t border-gray-100 pt-4 text-sm">
                <Metric icon={<Package className="h-4 w-4" />} label="Productos" value={plan.maxProducts} />
                <Metric icon={<Users className="h-4 w-4" />} label="Personal" value={plan.maxStaff} />
                <Metric icon={<Tag className="h-4 w-4" />} label="Ofertas activas" value={plan.maxActiveOffers} />
                <Metric icon={<ShoppingCart className="h-4 w-4" />} label="Pedidos al mes" value={plan.maxMonthlyOrders === null ? 'Ilimitados' : plan.maxMonthlyOrders} />
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-5 w-full"
                leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                onClick={() => openEdit(plan)}
              >
                Editar plan
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        open={editingPlan !== null}
        title={editingPlan ? `Editar plan ${editingPlan.name}` : 'Editar plan'}
        description="Los cambios de capacidad se reflejarán en las empresas que tengan asignado este plan."
        maxWidth="lg"
        onClose={() => setEditingPlan(null)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingPlan(null)}>Cancelar</Button>
            <Button isLoading={saving} onClick={() => void handleSave()}>Guardar cambios</Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Nombre del plan" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <Input label="Orden de visualización" type="number" min="0" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
          </div>
          <Input label="Descripción" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Máximo de productos" type="number" min="0" value={form.maxProducts} onChange={(event) => setForm((current) => ({ ...current, maxProducts: event.target.value }))} hint="Los productos archivados no ocupan espacio." />
            <Input label="Máximo de personal" type="number" min="0" value={form.maxStaff} onChange={(event) => setForm((current) => ({ ...current, maxStaff: event.target.value }))} />
            <Input label="Máximo de ofertas activas" type="number" min="0" value={form.maxActiveOffers} onChange={(event) => setForm((current) => ({ ...current, maxActiveOffers: event.target.value }))} />
            <Input label="Pedidos mensuales" type="number" min="0" value={form.maxMonthlyOrders} onChange={(event) => setForm((current) => ({ ...current, maxMonthlyOrders: event.target.value }))} hint="Déjalo vacío para permitirlos sin límite." />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Plan disponible para nuevas asignaciones
          </label>
        </div>
      </Modal>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-gray-500">{icon}{label}</span>
      <strong className="text-gray-900">{value}</strong>
    </div>
  );
}
