import { withAlpha, type StorefrontTheme } from './storefrontTheme';

export interface FragranceNotes {
  top: string;
  heart: string;
  base: string;
}

const BANDS: { key: keyof FragranceNotes; label: string; alpha: number }[] = [
  { key: 'top', label: 'Notas de salida', alpha: 0.16 },
  { key: 'heart', label: 'Notas de corazón', alpha: 0.5 },
  { key: 'base', label: 'Notas de fondo', alpha: 1 },
];

/** Visual fragrance pyramid (top/heart/base notes) — exclusive to stores
 * whose businessSubcategory is 'lociones_perfumes' (see ProductLandingPage).
 * Band shades are derived from the store's own primary color via withAlpha
 * so it stays on-brand per store instead of a fixed palette.
 *
 * Lives inside the buy-box column next to the gallery (not a full-width
 * section below it), so the layout is a compact, centered card — the
 * pyramid on top, notes stacked below — rather than the wider
 * side-by-side arrangement a full-bleed block would use. Spacing between
 * this and its siblings comes from the parent's `space-y-*`, not its own
 * margin. */
export function FragrancePyramid({ notes, theme }: { notes: FragranceNotes; theme: StorefrontTheme }) {
  return (
    <section
      className="rounded-2xl border p-5"
      style={{ borderColor: theme.border, backgroundColor: theme.surface }}
    >
      <p
        className="text-center text-xs font-semibold uppercase tracking-[0.16em]"
        style={{ color: theme.mutedText }}
      >
        Pirámide olfativa
      </p>

      <svg viewBox="0 0 220 200" className="mx-auto mt-4 h-28 w-28" aria-hidden="true">
        <polygon
          points="110,14 90,74 130,74"
          style={{ fill: withAlpha(theme.primary, 0.16), stroke: theme.border, strokeWidth: 1 }}
        />
        <polygon
          points="90,74 130,74 150,132 70,132"
          style={{ fill: withAlpha(theme.primary, 0.5), stroke: theme.border, strokeWidth: 1 }}
        />
        <polygon
          points="70,132 150,132 172,188 48,188"
          style={{ fill: theme.primary, stroke: theme.border, strokeWidth: 1 }}
        />
      </svg>

      <dl className="mt-4 flex flex-col gap-3 border-t pt-4" style={{ borderColor: theme.border }}>
        {BANDS.map((band) => (
          <div key={band.key} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: withAlpha(theme.primary, band.alpha) }}
            />
            <div>
              <dt className="text-sm font-semibold" style={{ color: theme.text }}>
                {band.label}
              </dt>
              <dd className="mt-0.5 text-sm" style={{ color: theme.mutedText }}>
                {notes[band.key]}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
