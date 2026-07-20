import type { BenefitIconKey } from '@/lib/homeSections/benefitIcons';
import { BENEFIT_ICONS } from '@/lib/homeSections/benefitIcons';

/** Per-item visual settings for "Beneficios" items — stored in
 * store_home_section_items.settings (jsonb), same convention as
 * PromoBannerSettings in promoBanner.types.ts (default/parse/serialize,
 * defensive against missing/malformed jsonb). Deliberately per-item (not
 * section-level) so a "marcas" section can have one logo with a custom
 * dark background sitting next to a plain one. */
export interface BenefitItemSettings {
  /** Which lucide icon to show when the item has no `imageUrl` (a real
   * logo always wins over an icon). `null` under the section's default
   * icon (see resolveBenefitIconKey for the legacy-linkUrl bridge). */
  iconKey: BenefitIconKey | null;
  /** Overrides the section-level `style`'s background for this one item.
   * `null` = inherit whatever the section style resolves to. */
  customBackgroundColor: string | null;
  /** Overrides the section-level `style`'s text color for this one item.
   * `null` = inherit. */
  customTextColor: string | null;
}

export function defaultBenefitItemSettings(): BenefitItemSettings {
  return { iconKey: null, customBackgroundColor: null, customTextColor: null };
}

function isBenefitIconKey(value: unknown): value is BenefitIconKey {
  return typeof value === 'string' && value in BENEFIT_ICONS;
}

function parseOptionalHexColor(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function parseBenefitItemSettings(raw: unknown): BenefitItemSettings {
  const fallback = defaultBenefitItemSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const record = raw as Record<string, unknown>;
  return {
    iconKey: isBenefitIconKey(record.iconKey) ? record.iconKey : null,
    customBackgroundColor: parseOptionalHexColor(record.customBackgroundColor),
    customTextColor: parseOptionalHexColor(record.customTextColor),
  };
}

export function serializeBenefitItemSettings(settings: BenefitItemSettings): Record<string, unknown> {
  return { ...settings };
}

/** The subset of fields needed to resolve "which icon key does this item
 * use" — matches HomeSectionDraftItem, StoreHomeSectionItem, and
 * PublicHomeSectionItem exactly (same shared-shape convention as
 * RenderableItemLike in sectionRenderableContent.ts). */
export interface BenefitIconResolvable {
  linkUrl: string | null;
  settings: Record<string, unknown> | null;
}

/** Resolves an item's icon key AND its real link together, in one pass —
 * they can't be resolved independently because of the legacy hack: an
 * item saved before this shipped has its icon key sitting directly in
 * `linkUrl` (e.g. `"truck"`), which must NOT then also be treated as a
 * real navigable href (linking to "/truck" would be nonsensical). Icon
 * key: `settings.iconKey` first, falling back to `linkUrl` only when it's
 * a recognized icon key and no new-style setting is present. Link:
 * `item.linkUrl` as-is, *unless* it was just consumed as the legacy icon
 * key, in which case the effective link is `null`. This keeps every
 * benefits section saved before this shipped rendering its exact same
 * icons, while every new/edited item gets a real, usable link. */
export function resolveBenefitItemDisplay(item: BenefitIconResolvable): { iconKey: BenefitIconKey | null; linkUrl: string | null } {
  const settings = parseBenefitItemSettings(item.settings);
  if (settings.iconKey) return { iconKey: settings.iconKey, linkUrl: item.linkUrl };
  if (isBenefitIconKey(item.linkUrl)) return { iconKey: item.linkUrl, linkUrl: null };
  return { iconKey: null, linkUrl: item.linkUrl };
}
