import { type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SwitchField } from '@/components/ui/SwitchField';
import { createEmptyDraftItem, type HomeSectionDraftItem } from '../homeSectionDraft';
import type { WizardStepProps } from '../sectionWizardSteps.types';

interface DraftItemListEditorProps extends WizardStepProps {
  emptyLabel: string;
  addLabel: string;
  newItemDefaults: () => Partial<HomeSectionDraftItem>;
  renderFields: (item: HomeSectionDraftItem, update: (patch: Partial<HomeSectionDraftItem>) => void) => ReactNode;
}

/** Local-only equivalent of the old HomeSectionItemListEditor — everything
 * lives in draft.items until the wizard's final save, so add/remove/
 * reorder/edit here never touch the DB. */
export function DraftItemListEditor({
  draft,
  updateDraft,
  emptyLabel,
  addLabel,
  newItemDefaults,
  renderFields,
}: DraftItemListEditorProps) {
  const items = draft.items;

  function setItems(next: HomeSectionDraftItem[]) {
    updateDraft({ items: next });
  }

  function updateItem(clientId: string, patch: Partial<HomeSectionDraftItem>) {
    setItems(items.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems([...items, { ...createEmptyDraftItem(), ...newItemDefaults() }]);
  }

  function removeItem(clientId: string) {
    setItems(items.filter((item) => item.clientId !== clientId));
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;
    const next = [...items];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setItems(next);
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {emptyLabel}
        </div>
      )}

      {items.map((item, index) => (
        <div key={item.clientId} className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveItem(index, 'up')}
                disabled={index === 0}
                className="rounded p-1 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                title="Subir"
              >
                <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 'down')}
                disabled={index === items.length - 1}
                className="rounded p-1 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                title="Bajar"
              >
                <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1" />
            <SwitchField
              id={`draft-item-active-${item.clientId}`}
              label="Activo"
              checked={item.isActive}
              onChange={(checked) => updateItem(item.clientId, { isActive: checked })}
            />
            <button
              type="button"
              onClick={() => removeItem(item.clientId)}
              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3 p-3">
            {renderFields(item, (patch) => updateItem(item.clientId, patch))}
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={addItem} className="w-full justify-center">
        {addLabel}
      </Button>
    </div>
  );
}
