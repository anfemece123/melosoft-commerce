import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Store } from '@/features/stores/stores.types';

interface DeleteStoreDialogProps {
  store: Store | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteStoreDialog({ store, isLoading, onClose, onConfirm }: DeleteStoreDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const matchesSlug = Boolean(store && confirmation.trim() === store.slug);

  return (
    <Modal
      open={store !== null}
      title="Eliminar empresa definitivamente"
      description="Esta acción no se puede deshacer. Se eliminarán los datos, usuarios exclusivos, archivos y configuración de esta empresa."
      maxWidth="md"
      dismissible={!isLoading}
      onClose={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isLoading} onClick={onClose}>Cancelar</Button>
          <Button variant="danger" isLoading={isLoading} disabled={!matchesSlug} onClick={onConfirm}>
            Eliminar definitivamente
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm leading-5 text-red-800">
            Se borrará la empresa completa de forma permanente. Los pedidos, productos, imágenes, videos, configuraciones y datos contables no podrán recuperarse.
          </p>
        </div>
        {store && (
          <Input
            label={`Escribe ${store.slug} para confirmar`}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoFocus
            disabled={isLoading}
            autoComplete="off"
          />
        )}
      </div>
    </Modal>
  );
}
