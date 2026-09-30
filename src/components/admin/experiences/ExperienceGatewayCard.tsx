import { useState } from 'react';
import { DoorOpen, ExternalLink } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SwitchField } from '@/components/ui/SwitchField';
import type { StoreExperienceGateway, StoreExperienceGatewayInput } from '@/features/categoryExperiences/categoryExperiences.types';
import type { ExperienceGatewayPlacement } from '@/types/common.types';
import { categoryExperiencesService } from '@/features/categoryExperiences/categoryExperiencesService';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import { notify } from '@/lib/notifications';

interface ExperienceGatewayCardProps {
  storeId: string;
  storeSlug: string;
  gateway: StoreExperienceGateway | null;
  activeExperienceCount: number;
  canManage: boolean;
  onSaved: (gateway: StoreExperienceGateway) => void;
}

function toInput(gateway: StoreExperienceGateway | null): StoreExperienceGatewayInput {
  return {
    isEnabled: gateway?.isEnabled ?? false,
    placement: gateway?.placement ?? 'replace_hero',
    title: gateway?.title ?? '',
    subtitle: gateway?.subtitle ?? '',
  };
}

/** Settings for the home "choose your experience" gateway — the entry point
 * of multi-brand companies such as two restaurants in one storefront. */
export function ExperienceGatewayCard({
  storeId,
  storeSlug,
  gateway,
  activeExperienceCount,
  canManage,
  onSaved,
}: ExperienceGatewayCardProps) {
  const [form, setForm] = useState<StoreExperienceGatewayInput>(() => toInput(gateway));
  const [saving, setSaving] = useState(false);
  const notEnough = activeExperienceCount < 2;

  async function save() {
    setSaving(true);
    try {
      const saved = await categoryExperiencesService.saveGateway(storeId, form);
      onSaved(saved);
      notify.success(saved.isEnabled ? 'Selector de experiencias publicado.' : 'Selector de experiencias guardado.');
    } catch (saveError) {
      notify.fromError(saveError, 'No pudimos guardar el selector.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardBody>
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-50 p-3 text-amber-600"><DoorOpen className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900">Portada de selección</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
              Ideal para varias marcas en una sola tienda, como dos restaurantes en un mismo lugar. La portada muestra cada experiencia con su foto, logo y colores, y el cliente elige a cuál entrar. Dentro de cada una verá un selector para cambiar de restaurante.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <SwitchField
            id="experience-gateway-enabled"
            label="Mostrar portada de selección"
            description={notEnough ? 'Necesitas al menos 2 experiencias activas para que se muestre.' : `${activeExperienceCount} experiencias activas listas para mostrar.`}
            checked={form.isEnabled}
            disabled={!canManage}
            onChange={(checked) => setForm((current) => ({ ...current, isEnabled: checked }))}
          />
          <Select
            label="Ubicación"
            value={form.placement}
            disabled={!canManage}
            onChange={(event) => setForm((current) => ({ ...current, placement: event.target.value as ExperienceGatewayPlacement }))}
            options={[
              { value: 'replace_hero', label: 'Reemplaza la portada principal' },
              { value: 'below_hero', label: 'Debajo de la portada principal' },
            ]}
          />
          <Input
            label="Título (opcional)"
            value={form.title ?? ''}
            maxLength={90}
            disabled={!canManage}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Ej. Dos cocinas, una mesa"
          />
          <Input
            label="Subtítulo (opcional)"
            value={form.subtitle ?? ''}
            maxLength={180}
            disabled={!canManage}
            onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
            placeholder="Ej. Elige dónde quieres pedir hoy"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          {canManage && <Button size="sm" isLoading={saving} onClick={() => void save()}>Guardar portada</Button>}
          <a href={buildStorefrontPath(storeSlug)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Ver tienda</Button>
          </a>
        </div>
      </CardBody>
    </Card>
  );
}
