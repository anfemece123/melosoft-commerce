import { Check, Images, LayoutList, Sparkles } from 'lucide-react';
import type { CartaNavigationMode, CartaTemplateKey } from '@/features/carta/carta.types';

const TEMPLATES: Array<{
  key: CartaTemplateKey;
  name: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  { key: 'signature', name: 'Firma', description: 'Editorial, elegante y con platos destacados.', icon: Sparkles },
  { key: 'gallery', name: 'Galería', description: 'Fotográfica, dinámica y muy visual.', icon: Images },
  { key: 'minimal', name: 'Esencial', description: 'Limpia, rápida y fácil de recorrer.', icon: LayoutList },
];

function TemplateMiniature({ template }: { template: CartaTemplateKey }) {
  if (template === 'gallery') {
    return (
      <div className="grid h-24 grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-2">
        <div className="col-span-3 h-4 rounded bg-indigo-200" />
        <div className="rounded bg-indigo-500/75" />
        <div className="rounded bg-violet-400/75" />
        <div className="rounded bg-sky-400/75" />
        <div className="h-2 rounded bg-slate-300" />
        <div className="h-2 rounded bg-slate-300" />
        <div className="h-2 rounded bg-slate-300" />
      </div>
    );
  }
  if (template === 'minimal') {
    return (
      <div className="h-24 rounded-xl bg-slate-50 p-3">
        <div className="mb-2 h-3 w-1/2 rounded bg-slate-700" />
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center justify-between border-b border-slate-200 py-1.5">
            <div className="h-1.5 w-1/2 rounded bg-slate-300" /><div className="h-1.5 w-8 rounded bg-indigo-400" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="h-24 rounded-xl bg-indigo-50 p-2.5 text-center">
      <div className="mx-auto h-3 w-3 rounded-full bg-indigo-500" />
      <div className="mx-auto mt-1.5 h-2 w-16 rounded bg-slate-600" />
      <div className="mx-auto mt-1 h-1.5 w-10 rounded bg-indigo-300" />
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="h-9 rounded bg-white shadow-sm" /><div className="h-9 rounded bg-white shadow-sm" />
      </div>
    </div>
  );
}

export function CartaTemplatePicker({ value, onChange }: { value: CartaTemplateKey; onChange: (value: CartaTemplateKey) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
      {TEMPLATES.map((template) => {
        const selected = template.key === value;
        const Icon = template.icon;
        return (
          <button
            key={template.key}
            type="button"
            onClick={() => onChange(template.key)}
            className={`relative grid grid-cols-[104px_1fr] items-center gap-3 rounded-2xl border p-3 text-left transition-all ${selected ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-100' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'} sm:block xl:grid`}
          >
            <TemplateMiniature template={template.key} />
            <div className="mt-0 min-w-0 sm:mt-3 xl:mt-0">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${selected ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span className="text-sm font-bold text-gray-900">{template.name}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-gray-500">{template.description}</p>
            </div>
            {selected && <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white"><Check className="h-3 w-3" /></span>}
          </button>
        );
      })}
    </div>
  );
}

export function CartaNavigationPicker({ value, onChange }: { value: CartaNavigationMode; onChange: (value: CartaNavigationMode) => void }) {
  const choices: Array<{ key: CartaNavigationMode; title: string; description: string }> = [
    { key: 'continuous', title: 'Carta continua', description: 'Todas las categorías una debajo de otra.' },
    { key: 'paginated', title: 'Por categorías', description: 'Una categoría por vista, con anterior y siguiente.' },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      {choices.map((choice) => {
        const selected = choice.key === value;
        return (
          <button
            key={choice.key}
            type="button"
            onClick={() => onChange(choice.key)}
            className={`rounded-xl border px-3.5 py-3 text-left transition ${selected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`text-sm font-semibold ${selected ? 'text-indigo-700' : 'text-gray-800'}`}>{choice.title}</span>
              <span className={`h-3.5 w-3.5 rounded-full border-2 ${selected ? 'border-indigo-600 bg-indigo-600 ring-2 ring-indigo-100' : 'border-gray-300'}`} />
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-500">{choice.description}</p>
          </button>
        );
      })}
    </div>
  );
}
