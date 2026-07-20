import { createPortal } from 'react-dom';
import { X, Ruler } from 'lucide-react';
import type { PublicSizeChart } from '@/types/common.types';
import type { StorefrontTheme } from './storefrontTheme';

interface StorefrontSizeChartDialogProps {
  open: boolean;
  theme: StorefrontTheme;
  sizeChart: PublicSizeChart;
  onClose: () => void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function StorefrontSizeChartDialog({ open, theme, sizeChart, onClose }: StorefrontSizeChartDialogProps) {
  if (!open) return null;

  const rows = Array.isArray(sizeChart.content?.rows) ? (sizeChart.content.rows as Array<Record<string, unknown>>) : [];
  const columns = rows.length > 0 && isPlainObject(rows[0]) ? Object.keys(rows[0]) : [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: theme.surface }}
      >
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4" style={{ color: theme.primary }} />
            <h2 className="font-semibold" style={{ color: theme.text }}>
              {sizeChart.name || 'Guía de tallas'}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{ color: theme.mutedText }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {columns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderColor: theme.border }} className="border-b">
                    {columns.map((col) => (
                      <th key={col} className="px-2 py-2 text-left font-medium uppercase text-xs" style={{ color: theme.mutedText }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="border-b last:border-0" style={{ borderColor: `${theme.border}80` }}>
                      {columns.map((col) => (
                        <td key={col} className="px-2 py-2" style={{ color: theme.text }}>
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sizeChart.unit ? (
                <p className="mt-2 text-xs" style={{ color: theme.mutedText }}>
                  Medidas en {sizeChart.unit === 'cm' ? 'centímetros' : 'pulgadas'}.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm" style={{ color: theme.mutedText }}>
              Esta guía de tallas todavía no tiene datos.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
