import { useState } from 'react';
import { CirclePower, PowerOff, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { storesService } from '@/features/stores/storesService';
import type { Store } from '@/features/stores/stores.types';
import { notify } from '@/lib/notifications';

interface StoreActivationControlProps {
  store: Store;
  onChanged: (store: Store) => void;
}

export function StoreActivationControl({
  store,
  onChanged,
}: StoreActivationControlProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isActive = store.status === 'active';
  const isInactive = store.status === 'inactive';
  const isToggleable = isActive || isInactive;
  const nextIsActive = isInactive;

  async function handleConfirm() {
    if (!isToggleable || isSaving) return;

    setIsSaving(true);
    try {
      const updatedStore = await storesService.setStoreActivation(store.id, nextIsActive);
      onChanged(updatedStore);
      setConfirmationOpen(false);
      notify.success(
        nextIsActive
          ? `${store.name} fue activada correctamente.`
          : `${store.name} fue desactivada correctamente.`
      );
    } catch (error) {
      notify.fromError(error, 'No se pudo cambiar el estado de la empresa.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!isToggleable) {
    return (
      <div className="mt-4 flex items-start gap-2 border-t border-gray-100 pt-4">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs leading-5 text-gray-500">
          Este estado requiere una gestión administrativa específica y no puede
          cambiarse con el control de activación.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={[
                'h-2 w-2 shrink-0 rounded-full',
                isActive ? 'bg-emerald-500' : 'bg-gray-400',
              ].join(' ')}
            />
            <p className="text-sm font-medium text-gray-800">
              {isActive ? 'Empresa activa' : 'Empresa desactivada'}
            </p>
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {isActive
              ? 'Ecommerce público disponible'
              : 'Ecommerce público fuera de servicio'}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={
            isActive
              ? <PowerOff className="h-3.5 w-3.5" />
              : <CirclePower className="h-3.5 w-3.5" />
          }
          className={
            isActive
              ? 'border-red-200 text-red-700 hover:bg-red-50'
              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
          }
          onClick={() => setConfirmationOpen(true)}
        >
          {isActive ? 'Desactivar' : 'Activar'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmationOpen}
        title={nextIsActive ? 'Activar empresa' : 'Desactivar empresa'}
        message={
          nextIsActive
            ? `El ecommerce público de “${store.name}” volverá a estar disponible y podrá recibir nuevos pedidos según su configuración.`
            : `El ecommerce público de “${store.name}” dejará de estar disponible y no aceptará nuevos pedidos ni pagos. Sus datos no se eliminarán.`
        }
        confirmLabel={nextIsActive ? 'Sí, activar' : 'Sí, desactivar'}
        variant={nextIsActive ? 'warning' : 'danger'}
        isLoading={isSaving}
        onConfirm={() => void handleConfirm()}
        onCancel={() => {
          if (!isSaving) setConfirmationOpen(false);
        }}
      />
    </>
  );
}
