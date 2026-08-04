import { useEffect, useMemo, useState } from 'react';
import { CopyPlus, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ProductOptionsEditor } from '@/components/admin/ProductOptionsEditor';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { categoriesService } from '@/features/categories/categoriesService';
import type { ProductOptionGroupDraft } from '@/features/products/productOptionsService';
import {
  cloneTemplateGroups,
  restaurantMerchandisingService,
  type CartUpsellRule,
  type ProductOptionTemplate,
} from '@/features/restaurants/restaurantMerchandisingService';
import { notify } from '@/lib/notifications';
import type { PublicStoreCategory } from '@/types/common.types';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentStore } from '@/features/stores/stores.selectors';

interface RuleForm {
  title: string;
  sourceCategoryId: string;
  targetCategoryId: string;
  onlyIfMissing: boolean;
  maxItems: number;
  isActive: boolean;
}

const EMPTY_RULE: RuleForm = {
  title: 'Completa tu pedido',
  sourceCategoryId: '',
  targetCategoryId: '',
  onlyIfMissing: true,
  maxItems: 3,
  isActive: true,
};

function categoryLabel(category: PublicStoreCategory, categories: PublicStoreCategory[]): string {
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

export function RestaurantMerchandisingPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const currentStore = useAppSelector(selectCurrentStore);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [rules, setRules] = useState<CartUpsellRule[]>([]);
  const [templates, setTemplates] = useState<ProductOptionTemplate[]>([]);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm>(EMPTY_RULE);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateGroups, setTemplateGroups] = useState<ProductOptionGroupDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load(): Promise<void> {
    if (!storeId) return;
    try {
      const [categoryRows, ruleRows, templateRows] = await Promise.all([
        categoriesService.getStoreCategories(storeId),
        restaurantMerchandisingService.getRules(storeId),
        restaurantMerchandisingService.getTemplates(storeId),
      ]);
      setCategories(categoryRows);
      setRules(ruleRows);
      setTemplates(templateRows);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No pudimos cargar la venta adicional.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void Promise.all([
      categoriesService.getStoreCategories(storeId),
      restaurantMerchandisingService.getRules(storeId),
      restaurantMerchandisingService.getTemplates(storeId),
    ])
      .then(([categoryRows, ruleRows, templateRows]) => {
        if (cancelled) return;
        setCategories(categoryRows);
        setRules(ruleRows);
        setTemplates(templateRows);
      })
      .catch((error: unknown) => {
        if (!cancelled) notify.error(error instanceof Error ? error.message : 'No pudimos cargar la venta adicional.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [storeId]);

  const categoryOptions = useMemo(() => categories
    .map((category) => ({ value: category.id, label: categoryLabel(category, categories) }))
    .sort((a, b) => a.label.localeCompare(b.label)), [categories]);
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, categoryLabel(category, categories)])),
    [categories],
  );

  if (!storeId) return null;
  if (loading) return <PanelLoadingState />;

  function openNewRule(): void {
    setEditingRuleId(null);
    setRuleForm(EMPTY_RULE);
    setRuleFormOpen(true);
  }

  function openRule(rule: CartUpsellRule): void {
    setEditingRuleId(rule.id);
    setRuleForm({
      title: rule.title,
      sourceCategoryId: rule.sourceCategoryId ?? '',
      targetCategoryId: rule.targetCategoryId ?? '',
      onlyIfMissing: rule.onlyIfMissing,
      maxItems: rule.maxItems,
      isActive: rule.isActive,
    });
    setRuleFormOpen(true);
  }

  async function saveRule(): Promise<void> {
    if (!storeId) return;
    if (!ruleForm.targetCategoryId) {
      notify.error('Selecciona la categoría que quieres recomendar.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: ruleForm.title,
        sourceCategoryId: ruleForm.sourceCategoryId || null,
        targetCategoryId: ruleForm.targetCategoryId,
        onlyIfMissing: ruleForm.onlyIfMissing,
        maxItems: ruleForm.maxItems,
        isActive: ruleForm.isActive,
      };
      if (editingRuleId) {
        await restaurantMerchandisingService.updateRule(editingRuleId, payload);
        notify.success('Regla actualizada');
      } else {
        await restaurantMerchandisingService.createRule(storeId, { ...payload, priority: rules.length });
        notify.success('Regla creada');
      }
      setRuleFormOpen(false);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No pudimos guardar la regla.');
    } finally {
      setSaving(false);
    }
  }

  function openNewTemplate(): void {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateGroups([]);
    setTemplateFormOpen(true);
  }

  function openTemplate(template: ProductOptionTemplate): void {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description ?? '');
    setTemplateGroups(cloneTemplateGroups(template.groups));
    setTemplateFormOpen(true);
  }

  async function saveTemplate(): Promise<void> {
    if (!storeId) return;
    setSaving(true);
    try {
      const payload = {
        name: templateName,
        description: templateDescription,
        groups: templateGroups,
        isActive: true,
      };
      if (editingTemplateId) {
        await restaurantMerchandisingService.updateTemplate(editingTemplateId, payload);
        notify.success('Plantilla actualizada');
      } else {
        await restaurantMerchandisingService.createTemplate(storeId, payload);
        notify.success('Plantilla creada');
      }
      setTemplateFormOpen(false);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No pudimos guardar la plantilla.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(kind: 'rule' | 'template', id: string): Promise<void> {
    if (!window.confirm('¿Seguro que quieres eliminarlo?')) return;
    setDeletingId(id);
    try {
      if (kind === 'rule') await restaurantMerchandisingService.deleteRule(id);
      else await restaurantMerchandisingService.deleteTemplate(id);
      notify.success('Eliminado');
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No pudimos eliminarlo.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Venta adicional</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configura bebidas, acompañamientos y extras sin duplicar inventario ni depender de recomendaciones genéricas.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Recomendaciones del carrito</h3>
            <p className="mt-1 text-sm text-gray-500">Muestra productos relevantes según lo que ya pidió el cliente.</p>
          </div>
          <Button onClick={openNewRule} leftIcon={<Sparkles className="h-4 w-4" />}>Nueva regla</Button>
        </div>

        {ruleFormOpen ? (
          <Card>
            <CardBody className="space-y-4">
              <h4 className="font-semibold text-gray-900">{editingRuleId ? 'Editar regla' : 'Nueva regla'}</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Título para el cliente"
                  value={ruleForm.title}
                  onChange={(event) => setRuleForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ej: ¿Algo para tomar?"
                />
                <Select
                  label="Se activa cuando el carrito tiene"
                  value={ruleForm.sourceCategoryId}
                  onChange={(event) => setRuleForm((current) => ({ ...current, sourceCategoryId: event.target.value }))}
                  options={[{ value: '', label: 'Cualquier producto' }, ...categoryOptions]}
                />
                <Select
                  label="Recomendar productos de"
                  value={ruleForm.targetCategoryId}
                  onChange={(event) => setRuleForm((current) => ({ ...current, targetCategoryId: event.target.value }))}
                  options={[{ value: '', label: 'Selecciona una categoría' }, ...categoryOptions]}
                />
                <Select
                  label="Cantidad de sugerencias"
                  value={String(ruleForm.maxItems)}
                  onChange={(event) => setRuleForm((current) => ({ ...current, maxItems: Number(event.target.value) }))}
                  options={[1, 2, 3, 4, 5, 6].map((value) => ({ value: String(value), label: String(value) }))}
                />
              </div>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={ruleForm.onlyIfMissing} onChange={(event) => setRuleForm((current) => ({ ...current, onlyIfMissing: event.target.checked }))} className="rounded border-gray-300 text-indigo-600" />
                  Ocultar si ya hay un producto de esa categoría
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={ruleForm.isActive} onChange={(event) => setRuleForm((current) => ({ ...current, isActive: event.target.checked }))} className="rounded border-gray-300 text-indigo-600" />
                  Regla activa
                </label>
              </div>
              <div className="flex gap-2">
                <Button isLoading={saving} onClick={() => void saveRule()}>Guardar regla</Button>
                <Button variant="ghost" onClick={() => setRuleFormOpen(false)}>Cancelar</Button>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">Aún no hay reglas. Crea una para ofrecer bebidas o acompañamientos en el carrito.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardBody className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{rule.title}</p>
                      <Badge variant={rule.isActive ? 'success' : 'neutral'}>{rule.isActive ? 'Activa' : 'Pausada'}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      {rule.sourceCategoryId ? `Si pide ${categoryNames.get(rule.sourceCategoryId) ?? 'una categoría'}` : 'Con cualquier pedido'}
                      {' → '}{categoryNames.get(rule.targetCategoryId ?? '') ?? 'Productos seleccionados'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Hasta {rule.maxItems} sugerencias</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openRule(rule)} aria-label="Editar regla"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" disabled={deletingId === rule.id} onClick={() => void remove('rule', rule.id)} aria-label="Eliminar regla"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 border-t border-gray-200 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Plantillas de opciones y combos</h3>
            <p className="mt-1 text-sm text-gray-500">Crea una vez “Elige tu bebida” o “Salsas” y aplícala a varios platos.</p>
          </div>
          <Button onClick={openNewTemplate} leftIcon={<CopyPlus className="h-4 w-4" />}>Nueva plantilla</Button>
        </div>

        {templateFormOpen ? (
          <div className="space-y-4">
            <Card>
              <CardBody className="grid gap-4 md:grid-cols-2">
                <Input label="Nombre de la plantilla" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Ej: Bebidas para combos" />
                <Textarea label="Descripción interna" rows={2} value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} placeholder="Cuándo conviene usarla" />
              </CardBody>
            </Card>
            <ProductOptionsEditor currency={currentStore?.currency ?? 'COP'} storeId={storeId} groups={templateGroups} onChange={setTemplateGroups} showTemplatePicker={false} />
            <div className="flex gap-2">
              <Button isLoading={saving} onClick={() => void saveTemplate()}>Guardar plantilla</Button>
              <Button variant="ghost" onClick={() => setTemplateFormOpen(false)}>Cancelar</Button>
            </div>
          </div>
        ) : null}

        {templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">Aún no hay plantillas reutilizables.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardBody className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <div className="flex items-center gap-2"><p className="font-semibold text-gray-900">{template.name}</p><Badge variant="info">{template.groups.length} grupos</Badge></div>
                    {template.description ? <p className="mt-2 text-sm text-gray-500">{template.description}</p> : null}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openTemplate(template)} aria-label="Editar plantilla"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" disabled={deletingId === template.id} onClick={() => void remove('template', template.id)} aria-label="Eliminar plantilla"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
