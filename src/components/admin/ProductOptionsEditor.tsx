import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { ProductOptionGroupDraft } from '@/features/products/productOptionsService';

interface ProductOptionsEditorProps {
  currency: string;
  groups: ProductOptionGroupDraft[];
  onChange: (groups: ProductOptionGroupDraft[]) => void;
}

function createEmptyItem() {
  return {
    label: '',
    description: '',
    priceDelta: 0,
    isDefault: false,
    isActive: true,
  };
}

function createEmptyGroup(): ProductOptionGroupDraft {
  return {
    name: '',
    description: '',
    selectionType: 'single',
    minSelect: 0,
    maxSelect: 1,
    isRequired: false,
    isActive: true,
    items: [createEmptyItem()],
  };
}

export function ProductOptionsEditor({
  currency,
  groups,
  onChange,
}: ProductOptionsEditorProps) {
  function updateGroup(index: number, updater: (group: ProductOptionGroupDraft) => ProductOptionGroupDraft) {
    onChange(groups.map((group, currentIndex) => (currentIndex === index ? updater(group) : group)));
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Opciones y adicionales del plato</h3>
            <p className="mt-1 text-sm text-gray-500">
              Permite que el cliente elija salsas, acompañamientos, tamaños o extras antes de agregar el plato al carrito.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => onChange([...groups, createEmptyGroup()])}
          >
            Agregar grupo
          </Button>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5 text-xs text-amber-700">
          Los adicionales con precio extra (+$) se muestran en el carrito, pero el total del pedido web usa el precio base del plato. Úsalos sin costo adicional o para pedidos por WhatsApp hasta la próxima actualización.
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6 text-sm text-gray-500">
            Aún no hay opciones configuradas. Ejemplos: Salsas, Acompañamientos, Término de la carne, Tamaño, Bebida, Adiciones.
          </div>
        ) : null}

        <div className="space-y-4">
          {groups.map((group, groupIndex) => (
            <div key={`group-${groupIndex}`} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Grupo {groupIndex + 1}</p>
                  <p className="text-xs text-gray-500">
                    Selección única para tamaño o término; múltiple para salsas, extras o adiciones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white text-red-500 transition-colors hover:bg-red-50"
                  aria-label="Eliminar grupo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  id={`group-name-${groupIndex}`}
                  label="Nombre del grupo"
                  placeholder="Ej: Salsas"
                  value={group.name}
                  onChange={(event) => updateGroup(groupIndex, (current) => ({ ...current, name: event.target.value }))}
                />
                <Textarea
                  id={`group-description-${groupIndex}`}
                  label="Descripción"
                  rows={2}
                  placeholder="Ej: Elige hasta 2 salsas"
                  value={group.description ?? ''}
                  onChange={(event) => updateGroup(groupIndex, (current) => ({ ...current, description: event.target.value }))}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de selección</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'single', label: 'Única' },
                      { value: 'multiple', label: 'Múltiple' },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateGroup(groupIndex, (current) => ({
                          ...current,
                          selectionType: option.value,
                          maxSelect: option.value === 'single' ? 1 : current.maxSelect,
                        }))}
                        className={[
                          'rounded-lg border px-3 py-2 text-sm transition-colors',
                          group.selectionType === option.value
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                        ].join(' ')}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  id={`group-min-${groupIndex}`}
                  label="Mínimo"
                  type="number"
                  min="0"
                  value={group.minSelect}
                  onChange={(event) => updateGroup(groupIndex, (current) => ({
                    ...current,
                    minSelect: Number(event.target.value || 0),
                  }))}
                />

                <Input
                  id={`group-max-${groupIndex}`}
                  label="Máximo"
                  type="number"
                  min="1"
                  disabled={group.selectionType === 'single'}
                  value={group.maxSelect ?? ''}
                  onChange={(event) => updateGroup(groupIndex, (current) => ({
                    ...current,
                    maxSelect: event.target.value === '' ? null : Number(event.target.value),
                  }))}
                  hint={group.selectionType === 'single' ? 'Fijo en 1 para selección única' : 'Déjalo vacío si no hay tope'}
                />

                <div className="space-y-3 pt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={group.isRequired}
                      onChange={(event) => updateGroup(groupIndex, (current) => ({
                        ...current,
                        isRequired: event.target.checked,
                        minSelect: event.target.checked && current.minSelect === 0 ? 1 : current.minSelect,
                      }))}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Obligatorio
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={group.isActive}
                      onChange={(event) => updateGroup(groupIndex, (current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Visible en pedidos
                  </label>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Opciones del grupo</h4>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => updateGroup(groupIndex, (current) => ({
                      ...current,
                      items: [...current.items, createEmptyItem()],
                    }))}
                  >
                    Agregar opción
                  </Button>
                </div>

                <div className="space-y-3">
                  {group.items.map((item, itemIndex) => (
                    <div key={`group-${groupIndex}-item-${itemIndex}`} className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_140px_auto]">
                        <Input
                          id={`item-label-${groupIndex}-${itemIndex}`}
                          label="Nombre"
                          placeholder="Ej: BBQ"
                          value={item.label}
                          onChange={(event) => updateGroup(groupIndex, (current) => ({
                            ...current,
                            items: current.items.map((currentItem, currentIndex) => (
                              currentIndex === itemIndex
                                ? { ...currentItem, label: event.target.value }
                                : currentItem
                            )),
                          }))}
                        />
                        <Input
                          id={`item-description-${groupIndex}-${itemIndex}`}
                          label="Descripción"
                          placeholder="Ej: Salsa aparte"
                          value={item.description ?? ''}
                          onChange={(event) => updateGroup(groupIndex, (current) => ({
                            ...current,
                            items: current.items.map((currentItem, currentIndex) => (
                              currentIndex === itemIndex
                                ? { ...currentItem, description: event.target.value }
                                : currentItem
                            )),
                          }))}
                        />
                        <Input
                          id={`item-price-${groupIndex}-${itemIndex}`}
                          label={`Extra (${currency})`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.priceDelta}
                          onChange={(event) => updateGroup(groupIndex, (current) => ({
                            ...current,
                            items: current.items.map((currentItem, currentIndex) => (
                              currentIndex === itemIndex
                                ? { ...currentItem, priceDelta: Number(event.target.value || 0) }
                                : currentItem
                            )),
                          }))}
                        />
                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => updateGroup(groupIndex, (current) => ({
                              ...current,
                              items: current.items.filter((_, currentIndex) => currentIndex !== itemIndex),
                            }))}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 text-red-500 transition-colors hover:bg-red-50"
                            aria-label="Eliminar opción"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={item.isDefault}
                            onChange={(event) => updateGroup(groupIndex, (current) => ({
                              ...current,
                              items: current.items.map((currentItem, currentIndex) => {
                                if (currentIndex !== itemIndex) {
                                  if (group.selectionType === 'single' && event.target.checked) {
                                    return { ...currentItem, isDefault: false };
                                  }
                                  return currentItem;
                                }
                                return { ...currentItem, isDefault: event.target.checked };
                              }),
                            }))}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Marcada por defecto
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={item.isActive}
                            onChange={(event) => updateGroup(groupIndex, (current) => ({
                              ...current,
                              items: current.items.map((currentItem, currentIndex) => (
                                currentIndex === itemIndex
                                  ? { ...currentItem, isActive: event.target.checked }
                                  : currentItem
                              )),
                            }))}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Disponible
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
