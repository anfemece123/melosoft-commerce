import { useParams } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export function PaymentsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  void storeId;

  return (
    <div>
      <PageHeader
        title="Pagos"
        description="Configuración de pasarela de pagos y transacciones de esta tienda."
      />

      <div className="max-w-2xl space-y-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Wompi</h2>
            </div>
            <p className="text-sm text-gray-500">
              Configura tus credenciales de Wompi para aceptar pagos en esta tienda.
              Las llaves privadas nunca se exponen en el frontend — se manejan de forma
              segura a través de Edge Functions en Supabase.
            </p>
            <div className="mt-4 p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-amber-700 font-medium">
                Configuración de pagos disponible en la siguiente fase.
                La arquitectura segura ya está lista en el backend.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="font-semibold text-gray-900 mb-3">Transacciones</h2>
            <p className="text-sm text-gray-500">
              El historial de transacciones aparecerá aquí cuando se active la pasarela de pagos.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
