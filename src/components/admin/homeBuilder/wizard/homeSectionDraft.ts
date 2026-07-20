import type { HomeSectionType, PublicHomeSection } from '@/types/common.types';
import {
  defaultHomeSectionContent,
  defaultHomeSectionHeading,
  defaultHomeSectionSubheading,
  type HomeSectionContent,
  type StoreHomeSection,
  type StoreHomeSectionItem,
} from '@/features/homeSections/homeSections.types';
import { sectionHasRenderableContent } from '@/components/admin/homeBuilder/previewFrame/sectionRenderableContent';
import { promoBannerCountForLayout, isPromoBannerContentEmpty } from '@/features/homeSections/promoBanner.types';

/** One item in a draft section — same shape the DB ultimately stores, plus
 * a stable `clientId` for React keys/selection before it has a real id, and
 * a `pendingImageFile` that only lives in memory: nothing is uploaded to
 * Supabase Storage until the wizard's final "Guardar sección" step, so
 * cancelling never leaves an orphaned file behind. `imageUrl` doubles as
 * the local preview (an object URL) while `pendingImageFile` is set. */
export interface HomeSectionDraftItem {
  clientId: string;
  id?: string;
  isActive: boolean;
  linkedEntityType: 'product' | 'category' | 'collection' | null;
  linkedEntityId: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  rating: number | null;
  /** Type-specific per-item visual settings (currently only promo_banners
   * — see promoBanner.types.ts). */
  settings: Record<string, unknown> | null;
  pendingImageFile?: File | null;
}

export interface HomeSectionDraft {
  sectionType: HomeSectionType;
  heading: string | null;
  subheading: string | null;
  isActive: boolean;
  content: HomeSectionContent;
  items: HomeSectionDraftItem[];
  /** Section-level pending image (image_text) — same deferred-upload rule. */
  pendingContentImageFile?: File | null;
  /** Per-field validation errors keyed by a step-chosen id (e.g.
   * "catalogMaxItems"), set by step components as the user types and
   * cleared to null once valid. Exists so a step can block "Siguiente"/
   * "Guardar sección" on a field the user is mid-typing (e.g. cleared a
   * required limit) without needing the persisted HomeSectionContent type
   * itself to model an in-progress "empty" state — see hasNoFieldErrors. */
  fieldErrors: Record<string, string | null>;
}

export function createEmptyDraftItem(): HomeSectionDraftItem {
  return {
    clientId: crypto.randomUUID(),
    isActive: true,
    linkedEntityType: null,
    linkedEntityId: null,
    title: null,
    subtitle: null,
    body: null,
    imageUrl: null,
    linkUrl: null,
    linkLabel: null,
    rating: null,
    settings: null,
    pendingImageFile: null,
  };
}

export function createDefaultDraft(sectionType: HomeSectionType): HomeSectionDraft {
  return {
    sectionType,
    heading: defaultHomeSectionHeading(sectionType),
    subheading: defaultHomeSectionSubheading(sectionType),
    isActive: true,
    content: defaultHomeSectionContent(sectionType),
    items: [],
    fieldErrors: {},
  };
}

/** The items that actually count for this draft right now — identical to
 * `draft.items` for every section type except promo_banners, where the
 * "Diseño" step's chosen count (1/2/3) can be *less* than `draft.items`
 * has stored. Reducing the count never truncates the array (so switching
 * back up restores whatever the owner already typed), it just means
 * anything past the current count is inert: not shown in the "Banners"
 * step, not part of the live preview, not persisted on save. This one
 * function is the single place that decides "what's really in this
 * section" — used identically by the preview, the empty-state check, the
 * step's own validation, and the save flow, so none of them can
 * disagree about it. */
export function effectiveDraftItems(draft: HomeSectionDraft): HomeSectionDraftItem[] {
  if (draft.content.sectionType !== 'promo_banners') return draft.items;
  return draft.items.slice(0, promoBannerCountForLayout(draft.content.layout));
}

/** Gate for a step's `isValid` — true only when every field error the step
 * (or a previous step) has recorded is cleared. Combine with content-shape
 * checks like `hasAtLeastOneItem` via `&&`. */
export function hasNoFieldErrors(draft: HomeSectionDraft): boolean {
  return Object.values(draft.fieldErrors).every((message) => !message);
}

export function draftFromExistingSection(
  section: StoreHomeSection,
  items: StoreHomeSectionItem[]
): HomeSectionDraft {
  return {
    sectionType: section.sectionType,
    heading: section.heading,
    subheading: section.subheading,
    isActive: section.isActive,
    content: section.content,
    items: items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        clientId: item.id,
        id: item.id,
        isActive: item.isActive,
        linkedEntityType: item.linkedEntityType,
        linkedEntityId: item.linkedEntityId,
        title: item.title,
        subtitle: item.subtitle,
        body: item.body,
        imageUrl: item.imageUrl,
        linkUrl: item.linkUrl,
        linkLabel: item.linkLabel,
        rating: item.rating,
        settings: item.settings,
        pendingImageFile: null,
      })),
    fieldErrors: {},
  };
}

/** Synthesizes an in-memory PublicHomeSection-shaped object from the live
 * draft — the exact type the *public* section renderers expect — so the
 * wizard's live preview panel can render the real `HomeSectionRenderer`
 * (same component the storefront uses) instead of a parallel, simplified
 * "draft preview" renderer. Never persisted, never passed to a service
 * call. Only active items are included, mirroring what
 * `public_store_home_section_items` would actually return once saved. */
export function draftToPublicPreviewSection(draft: HomeSectionDraft, storeId: string): PublicHomeSection {
  const isPromoBanners = draft.content.sectionType === 'promo_banners';
  return {
    id: 'draft-preview',
    storeId,
    sectionType: draft.sectionType,
    sortOrder: 0,
    heading: draft.heading,
    subheading: draft.subheading,
    content: draft.content as unknown as Record<string, unknown>,
    items: effectiveDraftItems(draft)
      // promo_banners additionally never previews a banner with none of
      // title/subtitle/image/CTA/eyebrow — matches the public renderer's
      // own filter exactly (isPromoBannerContentEmpty), so the live
      // preview never shows an empty card the real store would never
      // render either. Every other section type keeps its original
      // behavior (isActive only) — this never touches non-promo sections.
      .filter((item) => item.isActive && (!isPromoBanners || !isPromoBannerContentEmpty(item)))
      .map((item, index) => ({
        id: item.id ?? item.clientId,
        sectionId: 'draft-preview',
        sortOrder: index,
        linkedEntityType: item.linkedEntityType,
        linkedEntityId: item.linkedEntityId,
        title: item.title,
        subtitle: item.subtitle,
        body: item.body,
        imageUrl: item.imageUrl,
        linkUrl: item.linkUrl,
        linkLabel: item.linkLabel,
        rating: item.rating,
        settings: item.settings,
      })),
  };
}

/** Whether the public renderer would actually draw anything for this draft
 * right now — see sectionHasRenderableContent (shared with the canvas's
 * already-saved sections, so the two never disagree on what counts as
 * "empty"). */
export function draftHasRenderableContent(draft: HomeSectionDraft, publicProductsCount: number, rootCategoriesCount: number): boolean {
  return sectionHasRenderableContent(
    draft.content,
    draft.heading,
    draft.subheading,
    effectiveDraftItems(draft),
    publicProductsCount,
    rootCategoriesCount
  );
}
