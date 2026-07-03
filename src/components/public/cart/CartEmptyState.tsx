import { ShoppingBag } from 'lucide-react';

export function CartEmptyState() {
  return (
    <div className="py-16 text-center">
      <ShoppingBag className="mx-auto h-12 w-12 opacity-20" />
      <p className="mt-3 text-sm font-medium opacity-60">Tu pedido está vacío</p>
      <p className="mt-1 text-xs opacity-40">Aún no has agregado productos.</p>
    </div>
  );
}
