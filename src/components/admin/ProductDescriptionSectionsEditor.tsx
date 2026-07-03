import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';
import type { ProductDescriptionSection } from '@/types/common.types';
import type { BusinessVertical } from '@/types/common.types';
import { getProductIcon, PRODUCT_ICON_LIST } from '@/features/products/productDescriptionIcons';
import { getSuggestedSections } from '@/features/products/productDescriptionSuggestions';

interface Props {
  sections: ProductDescriptionSection[];
  onChange: (sections: ProductDescriptionSection[]) => void;
  vertical?: BusinessVertical | null;
  subcategory?: string | null;
}

interface SectionEditorProps {
  section: ProductDescriptionSection;
  index: number;
  total: number;
  onChange: (updated: ProductDescriptionSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SectionEditor({ section, index, total, onChange, onDelete, onMoveUp, onMoveDown }: SectionEditorProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);

  return (
    <div className={clsx(
      'border rounded-lg bg-white',
      section.isVisible ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'
    )}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />

        <button
          type="button"
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="flex items-center justify-center w-7 h-7 rounded border border-gray-200 bg-white hover:bg-gray-100 flex-shrink-0"
          title="Cambiar ícono"
        >
          {getProductIcon(section.icon, { className: 'h-4 w-4 text-gray-600' })}
        </button>

        <input
          type="text"
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          placeholder="Título de la sección"
          className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-gray-800 placeholder-gray-400"
        />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Subir"
          >
            <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Bajar"
          >
            <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...section, isVisible: !section.isVisible })}
            className="p-1 rounded hover:bg-gray-200"
            title={section.isVisible ? 'Ocultar sección' : 'Mostrar sección'}
          >
            {section.isVisible
              ? <Eye className="h-3.5 w-3.5 text-gray-500" />
              : <EyeOff className="h-3.5 w-3.5 text-gray-400" />
            }
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
            title="Eliminar sección"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showIconPicker && (
        <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-1.5">
          {PRODUCT_ICON_LIST.map((item) => (
            <button
              key={item.key}
              type="button"
              title={item.label}
              onClick={() => { onChange({ ...section, icon: item.key }); setShowIconPicker(false); }}
              className={clsx(
                'flex items-center gap-1 px-2 py-1 rounded border text-xs',
                section.icon === item.key
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {getProductIcon(item.key, { className: 'h-3.5 w-3.5' })}
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="px-3 py-2">
        <textarea
          value={section.content}
          onChange={(e) => onChange({ ...section, content: e.target.value })}
          rows={3}
          placeholder="Contenido de la sección..."
          className="w-full text-sm text-gray-700 bg-transparent border-none outline-none resize-none placeholder-gray-400"
        />
      </div>
    </div>
  );
}

export function ProductDescriptionSectionsEditor({ sections, onChange, vertical, subcategory }: Props) {
  const suggestions = vertical ? getSuggestedSections(vertical, subcategory) : [];
  const usedTitles = new Set(sections.map((s) => s.title.toLowerCase()));

  function addSection(title = '', icon = 'info', placeholder = '') {
    const newSection: ProductDescriptionSection = {
      id: crypto.randomUUID(),
      title,
      icon,
      content: placeholder ? '' : '',
      sortOrder: sections.length,
      isVisible: true,
    };
    onChange([...sections, newSection]);
  }

  function updateSection(index: number, updated: ProductDescriptionSection) {
    const next = [...sections];
    next[index] = updated;
    onChange(next);
  }

  function deleteSection(index: number) {
    onChange(sections.filter((_, i) => i !== index));
  }

  function moveSection(from: number, to: number) {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next.map((s, i) => ({ ...s, sortOrder: i })));
  }

  return (
    <div className="space-y-3">
      {suggestions.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Sugerencias para este tipo de negocio:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => {
              const alreadyAdded = usedTitles.has(s.title.toLowerCase());
              return (
                <button
                  key={s.title}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addSection(s.title, s.icon, s.placeholder)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                    alreadyAdded
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                      : 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                  )}
                >
                  {getProductIcon(s.icon, { className: 'h-3.5 w-3.5' })}
                  {s.title}
                  {alreadyAdded && <span className="text-gray-300">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sections.map((section, index) => (
          <SectionEditor
            key={section.id}
            section={section}
            index={index}
            total={sections.length}
            onChange={(updated) => updateSection(index, updated)}
            onDelete={() => deleteSection(index)}
            onMoveUp={() => moveSection(index, index - 1)}
            onMoveDown={() => moveSection(index, index + 1)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => addSection()}
        className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors w-full justify-center"
      >
        <Plus className="h-4 w-4" />
        Agregar sección
      </button>
    </div>
  );
}
